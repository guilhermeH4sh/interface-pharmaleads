"""API HTTP local e execução do Gosom para a interface PharmaLeads."""
from __future__ import annotations

import csv
import io
import json
import mimetypes
import os
import re
import subprocess
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from . import config, gerador
from .banco import Banco, COLUNAS_EXPORTACAO, _agora
from .coletor import Opcoes, localizar_gosom, montar_comando

HOST = '127.0.0.1'
PORT = 8765
MAX_BODY = 65536
DIST = config.raiz() / 'apps' / 'web' / 'dist'


class Controlador:
    def __init__(self):
        self.lock = threading.Lock()
        self.parar = threading.Event()
        self.thread = None
        with BancoContext() as db:
            # Uma queda da API não pode deixar uma execução eternamente ativa.
            db.con.execute("UPDATE consultas SET estado='interrompida' WHERE estado='executando'")
            db.con.execute("UPDATE execucoes SET estado='interrompida', terminado_em=?, erro='API encerrada durante a coleta.' WHERE estado IN ('executando','parando')", (_agora(),))
            db.con.commit()

    def iniciar(self, payload):
        locais = payload.get('locais')
        segmentos = payload.get('segmentos')
        profundidade = payload.get('profundidade', 1)
        if not isinstance(locais, list) or not locais or len(locais) > 100:
            raise ValueError('Informe entre 1 e 100 cidades ou regiões.')
        if any(not isinstance(x, str) or not x.strip() or len(x) > 150 or '\n' in x or '\r' in x or '#!#' in x for x in locais):
            raise ValueError('Cada local deve ser uma linha de até 150 caracteres.')
        if not isinstance(segmentos, list) or not segmentos or any(not isinstance(x, str) or x not in config.SEGMENTOS for x in segmentos):
            raise ValueError('Selecione ao menos um segmento válido.')
        if type(profundidade) is not int or not 1 <= profundidade <= 10:
            raise ValueError('A profundidade deve ser de 1 a 10.')
        if type(payload.get('emails', False)) is not bool:
            raise ValueError('Opção de e-mail inválida.')
        linhas = gerador.montar_consultas(list(dict.fromkeys(x.strip() for x in locais)), list(dict.fromkeys(segmentos)))
        # Verifica o executável antes de gravar a execução.
        comando = localizar_gosom()
        with self.lock:
            if self.thread and self.thread.is_alive():
                raise RuntimeError('Já existe uma coleta em andamento.')
            self.parar.clear()
            with BancoContext() as db:
                cur = db.con.execute("INSERT INTO execucoes(estado,criado_em,total,profundidade,emails) VALUES('executando',?,?,?,?)", (_agora(), len(linhas), profundidade, int(payload.get('emails', False))))
                run_id = cur.lastrowid
                db.con.executemany("INSERT INTO consultas(execucao_id,texto) VALUES(?,?)", [(run_id, x) for x in linhas])
                db.con.commit()
            self.thread = threading.Thread(target=self._executar, args=(run_id, comando, profundidade, payload.get('emails', False)), daemon=True)
            self.thread.start()
        return run_id

    def solicitar_parada(self):
        with self.lock:
            if not self.thread or not self.thread.is_alive():
                return False
            self.parar.set()
            with BancoContext() as db:
                db.con.execute("UPDATE execucoes SET estado='parando' WHERE id=(SELECT max(id) FROM execucoes) AND estado='executando'")
                db.con.commit()
            return True

    def _executar(self, run_id, comando, profundidade, emails):
        pasta = config.pasta_dados() / 'execucoes' / str(run_id)
        try:
            pasta.mkdir(parents=True, exist_ok=True)
            with BancoContext() as db:
                consultas = db.con.execute('SELECT id,texto FROM consultas WHERE execucao_id=? ORDER BY id', (run_id,)).fetchall()
                for consulta in consultas:
                    if self.parar.is_set(): break
                    qid = consulta['id']; entrada = pasta / f'consulta_{qid}.txt'; saida = pasta / f'consulta_{qid}.csv'; log = pasta / f'consulta_{qid}.log'
                    entrada.write_text(consulta['texto'] + '\n', encoding='utf-8')
                    db.con.execute("UPDATE consultas SET estado='executando' WHERE id=?", (qid,)); db.con.commit()
                    erro = ''; concluido = False
                    for tentativa in range(1, 3):
                        if self.parar.is_set(): break
                        db.con.execute('UPDATE consultas SET tentativas=? WHERE id=?', (tentativa, qid)); db.con.commit()
                        # Cada tentativa tem arquivo próprio: nenhuma saída parcial é apagada.
                        saida = pasta / f'consulta_{qid}_tentativa_{tentativa}.csv'
                        try:
                            op = Opcoes(bin=comando, concorrencia=1, profundidade=profundidade, emails=emails)
                            with log.open('ab') as log_file:
                                proc = subprocess.Popen(montar_comando(op, entrada, saida), stdout=log_file, stderr=subprocess.STDOUT)
                                inicio = time.monotonic()
                                while proc.poll() is None:
                                    if self.parar.wait(0.5) or time.monotonic() - inicio > 1800:
                                        proc.terminate()
                                        try: proc.wait(timeout=5)
                                        except subprocess.TimeoutExpired: proc.kill(); proc.wait()
                                        if not self.parar.is_set(): erro = 'Tempo limite de 30 minutos atingido.'
                                        break
                            if self.parar.is_set(): break
                            if proc.returncode != 0:
                                if not erro: erro = f'Gosom encerrou com código {proc.returncode}; veja {log.name}.'
                                raise RuntimeError(erro)
                            if not saida.exists(): raise RuntimeError('Gosom não criou o CSV de resultados.')
                            db.importar_csv(saida)
                            concluido = True; erro = ''; break
                        except (OSError, ValueError, RuntimeError, config.ErroPharmaLeads) as exc:
                            erro = str(exc)[:300]
                            if tentativa < 2: self.parar.wait(2 * tentativa)
                    estado = 'interrompida' if self.parar.is_set() else 'concluida' if concluido else 'falhou'
                    db.con.execute('UPDATE consultas SET estado=?,erro=? WHERE id=?', (estado, erro, qid))
                    db.con.execute('UPDATE execucoes SET concluidas=concluidas+?,falhas=falhas+?,erro=? WHERE id=?', (int(concluido),int(estado == 'falhou'),erro,run_id)); db.con.commit()
                    if self.parar.wait(1): break
                falhas = db.con.execute('SELECT falhas FROM execucoes WHERE id=?', (run_id,)).fetchone()[0]
                estado = 'parada' if self.parar.is_set() else 'concluida_com_falhas' if falhas else 'concluida'
                db.con.execute('UPDATE execucoes SET estado=?,terminado_em=? WHERE id=?', (estado,_agora(),run_id)); db.con.commit()
        except Exception as exc:
            with BancoContext() as db:
                db.con.execute("UPDATE execucoes SET estado='falhou', terminado_em=?, erro=? WHERE id=?", (_agora(),str(exc)[:300],run_id)); db.con.commit()


class BancoContext:
    def __enter__(self): self.banco=Banco(); return self.banco
    def __exit__(self, *args): self.banco.fechar()


def obter_filtros(query):
    q = query.get('q', [''])[0].strip()[:120]
    uf = query.get('uf', [''])[0].strip().upper()
    segmento = query.get('segmento', [''])[0].strip()
    situacao = query.get('situacao', [''])[0].strip()
    cond=[]; valores=[]
    if q:
        cond.append('(nome LIKE ? OR endereco LIKE ? OR local_busca LIKE ? OR telefone LIKE ?)')
        valores.extend(['%' + q + '%'] * 4)
    if uf:
        if not re.fullmatch(r'[A-Z]{2}', uf): raise ValueError('UF inválida.')
        cond.append('upper(local_busca) LIKE ?'); valores.append('%, ' + uf)
    if segmento:
        if segmento not in config.SEGMENTOS: raise ValueError('Segmento inválido.')
        cond.append('segmento=?'); valores.append(segmento)
    if situacao:
        if situacao not in ('ativa_ou_desconhecida','fechada_temporariamente','fechada_permanentemente','fechada'): raise ValueError('Situação inválida.')
        cond.append('situacao=?'); valores.append(situacao)
    return (' WHERE ' + ' AND '.join(cond) if cond else ''), valores


class Handler(BaseHTTPRequestHandler):
    server_version = 'PharmaLeadsLocal/1'

    def permitido(self):
        host = self.headers.get('Host', '')
        origem = self.headers.get('Origin')
        return host in (f'127.0.0.1:{PORT}', f'localhost:{PORT}') and (not origem or origem in (f'http://127.0.0.1:{PORT}',f'http://localhost:{PORT}','http://127.0.0.1:5173','http://localhost:5173'))

    def responder(self, codigo, data, tipo='application/json; charset=utf-8', extra=None):
        corpo = json.dumps(data, ensure_ascii=False).encode('utf-8') if tipo.startswith('application/json') else data
        self.send_response(codigo); self.send_header('Content-Type',tipo); self.send_header('Content-Length',str(len(corpo))); self.send_header('Cache-Control','no-store'); self.send_header('X-Content-Type-Options','nosniff')
        for k,v in (extra or {}).items(): self.send_header(k,v)
        self.end_headers(); self.wfile.write(corpo)

    def do_GET(self):
        if not self.permitido(): return self.responder(403, {'error':'Origem não permitida.'})
        url=urlsplit(self.path); q=parse_qs(url.query)
        try:
            if url.path == '/api/config':
                return self.responder(200, {'segmentos': [{'id': k, 'descricao': v['descricao']} for k,v in config.SEGMENTOS.items()]})
            if url.path == '/api/status':
                with BancoContext() as db:
                    total=db.con.execute('SELECT count(*) FROM lugares').fetchone()[0]
                    pendentes=db.con.execute('SELECT count(*) FROM sync_pendente').fetchone()[0]
                    run=db.con.execute('SELECT * FROM execucoes ORDER BY id DESC LIMIT 1').fetchone()
                    consulta=db.con.execute("SELECT texto FROM consultas WHERE execucao_id=? AND estado='executando' LIMIT 1",(run['id'],)).fetchone() if run else None
                    return self.responder(200, {'total_leads':total,'sync_pendente':pendentes,'execucao':dict(run) if run else None,'consulta_atual':consulta[0].split(' #!#')[0] if consulta else None})
            if url.path in ('/api/leads','/api/exportar'):
                where,args=obter_filtros(q)
                with BancoContext() as db:
                    total=db.con.execute('SELECT count(*) FROM lugares'+where,args).fetchone()[0]
                    if url.path == '/api/exportar':
                        rows=db.con.execute('SELECT '+','.join(COLUNAS_EXPORTACAO)+' FROM lugares'+where+' ORDER BY nome',args)
                        saida=io.StringIO(newline=''); w=csv.writer(saida); w.writerow(COLUNAS_EXPORTACAO)
                        for r in rows:
                            w.writerow([("'"+v if isinstance(v,str) and v.lstrip().startswith(('=','+','-','@')) else v) for v in r])
                        return self.responder(200, ('\ufeff'+saida.getvalue()).encode('utf-8'), 'text/csv; charset=utf-8', {'Content-Disposition':'attachment; filename="pharmaleads.csv"'})
                    try: offset=int(q.get('offset',['0'])[0])
                    except ValueError: raise ValueError('Página inválida.') from None
                    if not 0<=offset<=1000000: raise ValueError('Página inválida.')
                    rows=db.con.execute('SELECT chave,nome,segmento,categoria,endereco,local_busca,telefone,telefone_normalizado,celular,whatsapp_link,site,emails,situacao,avaliacao,qtd_avaliacoes,latitude,longitude,link FROM lugares'+where+' ORDER BY nome,chave LIMIT 50 OFFSET ?',(*args,offset)).fetchall()
                    return self.responder(200, {'items':[dict(r) for r in rows],'total':total,'next_offset':offset+len(rows) if offset+len(rows)<total else None})
            if url.path.startswith('/api/'):
                return self.responder(404, {'error':'Rota não encontrada.'})
            arquivo=(DIST / url.path.lstrip('/')).resolve()
            if not arquivo.is_relative_to(DIST.resolve()): return self.responder(403, {'error':'Caminho inválido.'})
            if not arquivo.is_file(): arquivo=DIST / 'index.html'
            if not arquivo.is_file(): return self.responder(404, {'error':'Interface não compilada; execute npm run dev em apps/web.'})
            return self.responder(200, arquivo.read_bytes(), mimetypes.guess_type(arquivo.name)[0] or 'application/octet-stream')
        except (ValueError, config.ErroPharmaLeads) as exc: return self.responder(400, {'error':str(exc)})
        except Exception: return self.responder(500, {'error':'Falha ao consultar os dados locais.'})

    def do_POST(self):
        if not self.permitido(): return self.responder(403, {'error':'Origem não permitida.'})
        try:
            tamanho=int(self.headers.get('Content-Length','0'))
            if tamanho < 0 or tamanho > MAX_BODY: return self.responder(413, {'error':'Dados muito grandes.'})
            if self.path == '/api/coletas/parar': return self.responder(200, {'parando':self.server.controlador.solicitar_parada()})
            if self.path == '/api/coletas':
                dados=json.loads(self.rfile.read(tamanho))
                if not isinstance(dados, dict): raise ValueError('Dados inválidos.')
                run_id=self.server.controlador.iniciar(dados)
                return self.responder(202, {'id':run_id})
            return self.responder(404, {'error':'Rota não encontrada.'})
        except (ValueError, json.JSONDecodeError, config.ErroPharmaLeads) as exc: return self.responder(400, {'error':str(exc)})
        except RuntimeError as exc: return self.responder(409, {'error':str(exc)})
        except Exception: return self.responder(500, {'error':'Falha ao iniciar a coleta.'})

    def log_message(self, formato, *args):
        print('%s - %s' % (self.address_string(), formato % args), flush=True)


def main():
    servidor=ThreadingHTTPServer((HOST,PORT),Handler)
    servidor.controlador=Controlador()
    print(f'PharmaLeads API: http://{HOST}:{PORT}', flush=True)
    try: servidor.serve_forever()
    except KeyboardInterrupt: pass
    finally:
        servidor.controlador.solicitar_parada()
        if servidor.controlador.thread: servidor.controlador.thread.join(timeout=10)
        servidor.server_close()


if __name__ == '__main__': main()
