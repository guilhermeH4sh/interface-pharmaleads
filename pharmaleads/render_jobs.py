"""Cliente da API Render e adaptação dos One-Off Jobs para o painel."""
from __future__ import annotations

import base64
import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, build_opener

from .supabase import SemRedirecionamento

COMANDO_JOB = '/opt/pharmaleads-venv/bin/python -m pharmaleads.render_one_off '
MARCADOR_JOB = 'PHARMALEADS_JOB_STATE '
ATIVOS = ('pending', 'running')
ESTADOS = {'pending': 'queued', 'running': 'in_progress'}
CONCLUSOES = {'succeeded': 'success', 'failed': 'failure', 'canceled': 'cancelled'}
ETAPAS = {'queued', 'preparing', 'searching', 'retrying', 'importing', 'enriching', 'syncing'}


class ErroRender(Exception):
    """Falha de comunicação com o Render, sem expor a credencial."""


def codificar_entrada(entrada: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(entrada, ensure_ascii=False).encode()).decode().rstrip('=')


def decodificar_entrada(texto: str) -> dict:
    if len(texto) > 16_384 or not re.fullmatch(r'[A-Za-z0-9_-]+', texto):
        raise ValueError('Argumento inválido.')
    dados = base64.urlsafe_b64decode(texto + '=' * (-len(texto) % 4))
    entrada = json.loads(dados)
    if not isinstance(entrada, dict):
        raise ValueError('Entrada inválida.')
    return entrada


class RenderJobs:
    def __init__(self, servico: str, chave: str):
        if not re.fullmatch(r'srv-[a-z0-9]+', servico) or not chave or not chave.isascii():
            raise ErroRender('Configuração de One-Off Jobs incompleta no Render ou na Vercel.')
        self.servico = servico
        self.caminho = f'/services/{servico}/jobs'
        self.chave = chave
        self.opener = build_opener(SemRedirecionamento())

    def _api(self, caminho: str, *, metodo='GET', dados=None, parametros=()):
        url = 'https://api.render.com/v1' + caminho
        if parametros:
            url += '?' + urlencode(parametros)
        headers = {'Authorization': f'Bearer {self.chave}', 'Accept': 'application/json'}
        corpo = None
        if dados is not None:
            corpo = json.dumps(dados).encode()
            headers['Content-Type'] = 'application/json'
        try:
            with self.opener.open(Request(url, data=corpo, method=metodo, headers=headers), timeout=6) as resposta:
                conteudo = resposta.read()
                return json.loads(conteudo) if conteudo else None
        except HTTPError as erro:
            raise ErroRender(f'A API do Render respondeu HTTP {erro.code}.') from None
        except (URLError, OSError, ValueError):
            raise ErroRender('Não foi possível consultar a API do Render. Verifique One-off Jobs antes de repetir um início.') from None

    def _listar(self, parametros):
        return [item['job'] for item in self._api(self.caminho, parametros=parametros) or []]

    def ativos(self) -> list[dict]:
        return self._listar([('limit', 20), *[('status', estado) for estado in ATIVOS]])

    def iniciar(self, entrada: dict) -> dict:
        job = self._api(self.caminho, metodo='POST', dados={
            'planId': 'plan-srv-008',
            'startCommand': COMANDO_JOB + codificar_entrada(entrada),
        })
        return self.resumir(job)

    def cancelar(self, job: dict) -> dict:
        try:
            self._api(f"{self.caminho}/{job['id']}/cancel", metodo='POST')
        except ErroRender:
            atual = self._api(f"{self.caminho}/{job['id']}")
            if atual['status'] in ATIVOS:
                raise
            return self.resumir(atual)
        return {**self.resumir(job), 'status': 'cancelling', 'can_stop': True}

    def status(self) -> dict | None:
        ativos = [job for job in self.ativos() if self.e_coleta(job)]
        if ativos:
            return self.resumir(ativos[0], consultar_progresso=True)
        recentes = self._listar([('limit', 20)])
        job = next((item for item in recentes if self.e_coleta(item)), None)
        return self.resumir(job, consultar_progresso=True) if job else None

    @classmethod
    def e_coleta(cls, job: dict) -> bool:
        """Inclui a coleta manual anterior à integração do painel."""
        return cls.entrada_do_job(job) is not None or 'pharmaleads.cloud_job' in (job.get('startCommand') or '')

    @staticmethod
    def entrada_do_job(job: dict) -> dict | None:
        comando = job.get('startCommand') or ''
        if not comando.startswith(COMANDO_JOB):
            return None
        try:
            return decodificar_entrada(comando[len(COMANDO_JOB):])
        except ValueError:
            return None

    def resumir(self, job: dict, consultar_progresso=False) -> dict:
        entrada = self.entrada_do_job(job)
        acompanhavel = entrada is not None
        entrada = entrada or {}
        nacional = entrada.get('modo') == 'nacional'
        rodada = int(entrada['rodada']) if nacional else 1
        total = int(entrada['total_rodadas']) if nacional else 1
        titulo = f'Nacional {rodada}/{total}' if nacional else ('Coleta' if acompanhavel else 'Coleta iniciada fora do painel')
        if entrada.get('resumo'):
            titulo += f" · {entrada['resumo']}"
        estado = job['status']
        status = ESTADOS.get(estado, 'completed')
        concluiu = estado == 'succeeded'
        total_execucao = total - rodada + 1
        run = {
            'id': job['id'], 'status': status, 'conclusion': CONCLUSOES.get(estado),
            'url': '', 'created_at': job['createdAt'], 'title': titulo,
            'round': rodada, 'total_rounds': total_execucao,
            'can_stop': acompanhavel,
        }
        # O estado terminal do Render confirma que o job terminou, mas não que
        # todas as rodadas planejadas foram executadas. A contagem real vem dos
        # eventos de progresso; não preencher 100% por inferência.
        if estado == 'pending':
            run['completed_rounds'] = 0
        if consultar_progresso and acompanhavel and estado != 'pending':
            run.update(self._progresso(job, total_execucao, status))
        return run

    def _progresso(self, job: dict, total: int, status: str) -> dict:
        try:
            servico = self._api(f'/services/{self.servico}')
            logs = self._api('/logs', parametros=[
                ('ownerId', servico['ownerId']), ('resource', job['id']),
                ('startTime', job['createdAt']), ('direction', 'backward'),
                ('text', MARCADOR_JOB.strip() + '*'), ('limit', 20),
            ])
        except (ErroRender, KeyError):
            return {}
        for log in (logs or {}).get('logs', []):
            mensagem = log.get('message', '')
            if not mensagem.startswith(MARCADOR_JOB):
                continue
            try:
                dados = json.loads(mensagem[len(MARCADOR_JOB):])
            except ValueError:
                continue
            if not isinstance(dados, dict):
                continue
            progresso = {}
            titulo = dados.get('title')
            if isinstance(titulo, str):
                progresso['title'] = titulo[:220]
            for campo in ('round', 'completed_rounds', 'synced_leads', 'new_supabase_leads',
                          'goal_leads', 'new_leads_per_hour', 'queries_completed',
                          'queries_with_results', 'local_duplicates', 'found_leads',
                          'new_leads', 'with_email', 'without_email'):
                valor = dados.get(campo)
                if type(valor) is int and valor >= 0:
                    if campo == 'completed_rounds':
                        valor = total if job['status'] == 'succeeded' else min(valor, total)
                    progresso[campo] = valor
            if status == 'in_progress' and dados.get('stage') in ETAPAS:
                progresso['stage'] = dados['stage']
            return progresso
        return {}
