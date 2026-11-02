import csv
import io
import json
import os
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from http.server import ThreadingHTTPServer

from pharmaleads import api
from pharmaleads.banco import Banco

FALSO = Path(__file__).resolve().parent / 'gosom_falso.py'


class TestAPILocal(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'PHARMALEADS_HOME': self.tmp.name})
        self.env.start()
        self.port = api.PORT
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), api.Handler)
        api.PORT = self.server.server_port
        self.server.controlador = api.Controlador()
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f'http://127.0.0.1:{api.PORT}'
        self.gosom = patch('pharmaleads.api.localizar_gosom', return_value=[sys.executable, str(FALSO)])
        self.gosom.start()

    def tearDown(self):
        self.server.controlador.solicitar_parada()
        if self.server.controlador.thread: self.server.controlador.thread.join(timeout=8)
        self.server.shutdown(); self.server.server_close(); self.thread.join(timeout=3)
        self.gosom.stop(); api.PORT = self.port; self.env.stop(); self.tmp.cleanup()

    def req(self,path,data=None,headers=None):
        payload = json.dumps(data).encode() if data is not None else None
        req = Request(self.url+path, data=payload, headers=headers or {}, method='POST' if data is not None else 'GET')
        with urlopen(req,timeout=5) as r:
            return r.status, r.read(), r.headers

    def aguardar(self):
        fim=time.monotonic()+15
        while time.monotonic()<fim:
            status=json.loads(self.req('/api/status')[1])
            if status['execucao'] and status['execucao']['estado'] not in ('executando','parando'):
                return status
            time.sleep(.1)
        self.fail('Coleta não terminou no prazo')

    def test_coleta_filtros_exportacao_e_deduplicacao(self):
        _,raw,_=self.req('/api/coletas',{'locais':['Curitiba, PR'],'segmentos':['manipulacao'],'profundidade':1})
        self.assertGreater(json.loads(raw)['id'],0)
        status=self.aguardar(); self.assertEqual(status['execucao']['estado'],'concluida'); self.assertEqual(status['total_leads'],3)
        self.req('/api/coletas',{'locais':['Curitiba, PR'],'segmentos':['manipulacao'],'profundidade':1})
        status=self.aguardar(); self.assertEqual(status['total_leads'],3)
        page=json.loads(self.req('/api/leads?uf=PR&q=Curitiba')[1]); self.assertEqual(page['total'],3)
        page=json.loads(self.req('/api/leads?uf=SP')[1]); self.assertEqual(page['total'],0)
        _,dados,cabecalhos=self.req('/api/exportar?uf=PR')
        self.assertTrue(cabecalhos['Content-Type'].startswith('text/csv'))
        self.assertEqual(len(list(csv.DictReader(io.StringIO(dados.decode('utf-8-sig'))))),3)

    def test_parar_coleta_interrompe_processo(self):
        lento=Path(self.tmp.name)/'lento.py'; lento.write_text('import time\ntime.sleep(30)\n',encoding='utf-8')
        self.gosom.stop(); self.gosom=patch('pharmaleads.api.localizar_gosom', return_value=[sys.executable,str(lento)]); self.gosom.start()
        self.req('/api/coletas',{'locais':['Curitiba, PR'],'segmentos':['manipulacao'],'profundidade':1})
        fim=time.monotonic()+5
        while time.monotonic()<fim:
            if json.loads(self.req('/api/status')[1])['consulta_atual']: break
            time.sleep(.05)
        self.req('/api/coletas/parar',{})
        status=self.aguardar(); self.assertEqual(status['execucao']['estado'],'parada'); self.assertEqual(status['total_leads'],0)

    def test_falha_da_coleta_e_registrada(self):
        self.gosom.stop(); self.gosom=patch('pharmaleads.api.localizar_gosom',return_value=[sys.executable,'-c','raise SystemExit(9)']); self.gosom.start()
        self.req('/api/coletas',{'locais':['Curitiba, PR'],'segmentos':['manipulacao'],'profundidade':1})
        status=self.aguardar(); self.assertEqual(status['execucao']['estado'],'concluida_com_falhas')
        self.assertEqual(status['execucao']['falhas'],1); self.assertIn('código 9',status['execucao']['erro'])

    def test_origem_externa_e_dados_invalidos_sao_rejeitados(self):
        with self.assertRaises(HTTPError) as erro: self.req('/api/status',headers={'Origin':'https://site-externo.example'})
        self.assertEqual(erro.exception.code,403)
        with self.assertRaises(HTTPError) as erro: self.req('/api/coletas',{'locais':[],'segmentos':['varejo']})
        self.assertEqual(erro.exception.code,400)
        with self.assertRaises(HTTPError) as erro: self.req('/api/coletas',{'locais':['Curitiba, PR'],'segmentos':[{}]})
        self.assertEqual(erro.exception.code,400)


