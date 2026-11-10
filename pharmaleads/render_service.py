"""Web Service do Render que supervisiona uma única coleta por vez."""
from __future__ import annotations

import hmac
import json
import os
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from .cobertura import entradas_seguintes
from .cloud_job import MARCADOR_PROGRESSO
from .gerador import montar_consultas, validar_segmentos
from .config import ErroPharmaLeads

ATIVOS = {'queued', 'in_progress', 'cancelling'}
ETAPAS_RODADA = {'searching', 'retrying', 'importing', 'enriching', 'syncing'}
MAX_BODY = 16_384


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def validar_entrada(body: dict) -> dict[str, str]:
    """Aceita somente os campos necessários para uma rodada do PharmaLeads."""
    if not isinstance(body, dict):
        raise ErroPharmaLeads('Configuração inválida.')
    locais = [item.strip() for item in str(body.get('locais', '')).splitlines() if item.strip()]
    segmentos = [item.strip() for item in str(body.get('segmentos', '')).split(',') if item.strip()]
    try:
        profundidade = int(body.get('profundidade', 1))
    except (TypeError, ValueError):
        raise ErroPharmaLeads('Profundidade inválida.') from None
    if (not locais or len(locais) > 20 or
            any(len(item) > 100 or '#!#' in item or any(ord(c) < 32 for c in item) for item in locais)):
        raise ErroPharmaLeads('Informe de 1 a 20 locais válidos.')
    segmentos = validar_segmentos(segmentos)
    if not segmentos or not 1 <= profundidade <= 10 or len(montar_consultas(locais, segmentos)) > 20:
        raise ErroPharmaLeads('Esta coleta excede os limites permitidos.')
    modo = 'nacional' if body.get('modo') == 'nacional' else 'avulsa'
    rodada = str(body.get('rodada', '1' if modo == 'nacional' else '0'))
    total = str(body.get('total_rodadas', '1' if modo == 'nacional' else '0'))
    if modo == 'nacional':
        try:
            if int(rodada) < 1 or int(total) < int(rodada):
                raise ValueError()
        except ValueError:
            raise ErroPharmaLeads('Rodada nacional inválida.') from None
    return {
        'locais': '\n'.join(dict.fromkeys(locais)),
        'segmentos': ','.join(segmentos),
        'profundidade': str(profundidade),
        'emails': 'true',
        'enriquecer_sites': 'true' if str(body.get('enriquecer_sites', 'true')).lower() == 'true' else 'false',
        'modo': modo,
        'rodada': rodada,
        'total_rodadas': total,
        'resumo': str(body.get('resumo', ' · '.join(locais)))[:180],
        'request_id': str(body.get('request_id') or f'render-{int(time.time())}')[:100],
    }


class ColetorRender:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._parar = threading.Event()
        self._processo: subprocess.Popen | None = None
        self._run: dict | None = None

    def status(self) -> dict | None:
        with self._lock:
            return dict(self._run) if self._run else None

    def iniciar(self, entrada: dict) -> dict:
        entrada = validar_entrada(entrada)
        with self._lock:
            if self._run and self._run['status'] in ATIVOS:
                raise ErroPharmaLeads('Já existe uma coleta online em andamento.')
            self._parar.clear()
            nacional = entrada['modo'] == 'nacional'
            rodada = int(entrada['rodada']) if nacional else 1
            self._run = {
                'id': int(time.time() * 1000),
                'status': 'queued',
                'conclusion': None,
                'url': self._url_publica(),
                'created_at': _agora(),
                'title': self._titulo(entrada),
                'stage': 'queued',
                'round': rodada,
                'total_rounds': int(entrada['total_rodadas']) - rodada + 1 if nacional else 1,
                'completed_rounds': 0,
                'synced_leads': 0,
            }
            thread = threading.Thread(target=self._executar, args=(entrada,), daemon=True,
                                      name='pharmaleads-render-worker')
            thread.start()
            return dict(self._run)

    def solicitar_parada(self) -> tuple[bool, dict | None]:
        with self._lock:
            ativo = bool(self._run and self._run['status'] in ATIVOS)
            if ativo:
                self._parar.set()
                self._run['status'] = 'cancelling'
                processo = self._processo
                if processo and processo.poll() is None:
                    try:
                        processo.terminate()
                    except ProcessLookupError:
                        pass
            run = dict(self._run) if self._run else None
        return ativo, run

    @staticmethod
    def _url_publica() -> str:
        hostname = os.environ.get('RENDER_EXTERNAL_HOSTNAME', '').strip()
        return f'https://{hostname}/health' if hostname else ''

    @staticmethod
    def _titulo(entrada: dict) -> str:
        if entrada['modo'] == 'nacional':
            return f"Nacional {entrada['rodada']}/{entrada['total_rodadas']} · {entrada['resumo']}"
        return f"Coleta · {entrada['resumo']}"

    def _atualizar(self, **campos) -> None:
        with self._lock:
            if self._run:
                self._run.update(campos)

    def _executar(self, entrada: dict) -> None:
        atual = entrada
        concluidas = enviados = 0
        resultado = 'success'
        try:
            while atual and not self._parar.is_set():
                ambiente = os.environ.copy()
                ambiente.update({
                    'LOCAIS': atual['locais'],
                    'SEGMENTOS': atual['segmentos'],
                    'PROFUNDIDADE': atual['profundidade'],
                    'EMAILS': 'true',
                    'ENRIQUECER_SITES': atual['enriquecer_sites'],
                    'GOSOM_BIN': ambiente.get('GOSOM_BIN', '/usr/bin/google-maps-scraper'),
                    'PHARMALEADS_HOME': ambiente.get('PHARMALEADS_HOME', '/tmp/pharmaleads'),
                    'PHARMALEADS_PROGRESS': '1',
                })
                with self._lock:
                    if self._parar.is_set():
                        break
                    rodada = int(atual['rodada']) if atual['modo'] == 'nacional' else 1
                    self._atualizar(status='in_progress', stage='preparing', round=rodada, title=self._titulo(atual))
                    processo = subprocess.Popen(
                        [sys.executable, '-m', 'pharmaleads.cloud_job'], env=ambiente,
                        stdout=subprocess.PIPE, text=True, encoding='utf-8', errors='replace',
                    )
                    self._processo = processo
                with processo.stdout as saida:
                    for linha in saida:
                        if not linha.startswith(MARCADOR_PROGRESSO):
                            print(linha, end='', flush=True)
                            continue
                        evento = json.loads(linha[len(MARCADOR_PROGRESSO):])
                        etapa = evento.get('stage')
                        if etapa in ETAPAS_RODADA:
                            self._atualizar(stage=etapa)
                        elif etapa == 'synced':
                            enviados += evento['synced_leads']
                            self._atualizar(synced_leads=enviados)
                codigo = processo.wait()
                with self._lock:
                    self._processo = None
                if self._parar.is_set():
                    break
                if codigo != 0:
                    resultado = 'failure'
                    break
                concluidas += 1
                self._atualizar(completed_rounds=concluidas)
                if atual['modo'] != 'nacional':
                    atual = None
                    continue
                atual = entradas_seguintes(
                    int(atual['rodada']), atual['segmentos'].split(','), atual['profundidade'],
                    'true', atual['enriquecer_sites'], atual['request_id'])
                if atual:
                    atual['modo'] = 'nacional'
        except Exception as exc:  # mantém o servidor vivo e registra o erro nos logs do Render
            print(f'Falha no supervisor da coleta: {exc}', file=sys.stderr, flush=True)
            resultado = 'failure'
        finally:
            with self._lock:
                self._processo = None
                if self._parar.is_set():
                    resultado = 'cancelled'
                self._atualizar(status='completed', conclusion=resultado, stage=resultado)


class Handler(BaseHTTPRequestHandler):
    server_version = 'PharmaLeadsRender/1.0'

    def _json(self, status: int, body: dict) -> None:
        data = json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def _autorizado(self) -> bool:
        esperado = os.environ.get('RENDER_COLLECTOR_TOKEN', '')
        recebido = self.headers.get('Authorization', '')
        return bool(esperado) and hmac.compare_digest(recebido, f'Bearer {esperado}')

    def _body(self) -> dict:
        tamanho = int(self.headers.get('Content-Length', '0'))
        if tamanho < 1 or tamanho > MAX_BODY:
            raise ErroPharmaLeads('Configuração muito grande ou vazia.')
        return json.loads(self.rfile.read(tamanho))

    @property
    def coletor(self) -> ColetorRender:
        return self.server.coletor  # type: ignore[attr-defined]

    def do_GET(self) -> None:
        caminho = urlsplit(self.path).path
        if caminho == '/health':
            self._json(HTTPStatus.OK, {'ok': True, 'service': 'pharmaleads-collector'})
            return
        if caminho != '/v1/status':
            self._json(HTTPStatus.NOT_FOUND, {'error': 'Rota não encontrada.'})
            return
        if not self._autorizado():
            self._json(HTTPStatus.UNAUTHORIZED, {'error': 'Token inválido.'})
            return
        self._json(HTTPStatus.OK, {'run': self.coletor.status()})

    def do_POST(self) -> None:
        caminho = urlsplit(self.path).path
        if caminho not in ('/v1/start', '/v1/stop'):
            self._json(HTTPStatus.NOT_FOUND, {'error': 'Rota não encontrada.'})
            return
        if not self._autorizado():
            self._json(HTTPStatus.UNAUTHORIZED, {'error': 'Token inválido.'})
            return
        try:
            if caminho == '/v1/start':
                run = self.coletor.iniciar(self._body())
                self._json(HTTPStatus.ACCEPTED, {'queued': True, 'run': run})
            else:
                ativo, run = self.coletor.solicitar_parada()
                self._json(HTTPStatus.ACCEPTED, {'cancelling': ativo, 'run': run})
        except (ErroPharmaLeads, json.JSONDecodeError, UnicodeDecodeError) as exc:
            codigo = HTTPStatus.CONFLICT if 'andamento' in str(exc) else HTTPStatus.BAD_REQUEST
            self._json(codigo, {'error': str(exc), 'run': self.coletor.status()})

    def log_message(self, formato: str, *args) -> None:
        print(f'{self.address_string()} - {formato % args}', flush=True)


def main() -> None:
    if not os.environ.get('RENDER_COLLECTOR_TOKEN'):
        raise SystemExit('Configure RENDER_COLLECTOR_TOKEN antes de iniciar o serviço.')
    porta = int(os.environ.get('PORT', '10000'))
    servidor = ThreadingHTTPServer(('0.0.0.0', porta), Handler)
    coletor = ColetorRender()
    servidor.coletor = coletor  # type: ignore[attr-defined]

    def encerrar(_signum=None, _frame=None):
        coletor.solicitar_parada()
        threading.Thread(target=servidor.shutdown, daemon=True).start()

    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, encerrar)
    if hasattr(signal, 'SIGINT'):
        signal.signal(signal.SIGINT, encerrar)
    print(f'Coletor PharmaLeads ouvindo na porta {porta}.', flush=True)
    try:
        servidor.serve_forever()
    finally:
        servidor.server_close()


if __name__ == '__main__':
    main()
