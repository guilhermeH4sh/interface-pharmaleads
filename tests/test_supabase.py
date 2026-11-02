import io
import json
import unittest
from unittest.mock import Mock
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit

from pharmaleads.supabase import Supabase
from pharmaleads.config import ErroPharmaLeads


class TestTransporte(unittest.TestCase):
    def setUp(self):
        self.cliente = Supabase('https://teste.supabase.co', 'sb_secret_fake')
        self.cliente.opener = Mock()

    def test_paginacao_respeita_limite_menor_do_servidor(self):
        paginas = [[{'chave': 'a'}], [{'chave': 'b'}], []]
        self.cliente.opener.open.side_effect = [io.BytesIO(json.dumps(p).encode()) for p in paginas]
        self.assertEqual(len(list(self.cliente.listar())), 2)
        chamadas = self.cliente.opener.open.call_args_list
        self.assertEqual([parse_qs(urlsplit(c.args[0].full_url).query)['offset'][0]
                          for c in chamadas], ['0', '1', '2'])

    def test_upsert_restrito_a_tabela_com_chave_e_json(self):
        self.cliente.opener.open.return_value = io.BytesIO(b'')
        self.cliente.salvar([{'chave': '1', 'dados_brutos': {'title': 'Farmácia'}}])
        req = self.cliente.opener.open.call_args.args[0]
        self.assertEqual(urlsplit(req.full_url).path, '/rest/v1/pharmaleads')
        self.assertEqual(parse_qs(urlsplit(req.full_url).query), {'on_conflict': ['chave']})
        self.assertEqual(req.method, 'POST')
        self.assertIsInstance(json.loads(req.data)[0]['dados_brutos'], dict)
        self.assertNotIn('Authorization', req.headers)  # sb_secret não é JWT

    def test_falha_http_nao_vaza_chave_ou_resposta(self):
        erro = HTTPError('url', 401, 'sb_secret_fake', {}, io.BytesIO(b'dados privados'))
        self.cliente.opener.open.side_effect = erro
        with self.assertRaises(ErroPharmaLeads) as resultado:
            self.cliente.verificar(['chave'])
        self.assertIn('401', str(resultado.exception))
        self.assertNotIn('sb_secret_fake', str(resultado.exception))
        self.assertNotIn('dados privados', str(resultado.exception))

    def test_chave_publica_e_url_insegura_sao_rejeitadas(self):
        with self.assertRaises(ErroPharmaLeads):
            Supabase('https://teste.supabase.co', 'sb_publishable_fake')
        with self.assertRaises(ErroPharmaLeads):
            Supabase('http://teste.supabase.co', 'sb_secret_fake')


class TestLoginJWT(unittest.TestCase):
    def setUp(self):
        self.uid = '677ed1e4-3e73-4f2c-951f-e77386f305da'
        self.cliente = Supabase('https://teste.supabase.co', publica='sb_publishable_fake',
            email='user@example.test', senha='senha-privada', uid=self.uid)
        self.cliente.opener = Mock()

    def sessao(self, token='jwt1', refresh='refresh1', uid=None):
        return io.BytesIO(json.dumps({'access_token': token, 'refresh_token': refresh,
            'expires_in': 3600, 'user': {'id': uid or self.uid}}).encode())

    def test_login_envia_jwt_para_tabela_sem_enviar_senha(self):
        self.cliente.opener.open.side_effect = [self.sessao(), io.BytesIO(b'[]')]
        self.cliente.verificar(['chave'])
        login, tabela = [c.args[0] for c in self.cliente.opener.open.call_args_list]
        self.assertEqual(urlsplit(login.full_url).path, '/auth/v1/token')
        self.assertEqual(parse_qs(urlsplit(login.full_url).query), {'grant_type': ['password']})
        self.assertEqual(json.loads(login.data)['password'], 'senha-privada')
        self.assertEqual(tabela.headers['Authorization'], 'Bearer jwt1')
        self.assertEqual(tabela.headers['Apikey'], 'sb_publishable_fake')
        self.assertIsNone(tabela.data)

    def test_renova_token_antes_do_upsert(self):
        self.cliente.opener.open.side_effect = [self.sessao(), io.BytesIO(b'[]'),
            self.sessao('jwt2', 'refresh2'), io.BytesIO(b'')]
        self.cliente.verificar(['chave'])
        self.cliente.expira = 0
        self.cliente.salvar([{'chave': '1'}])
        chamadas = [c.args[0] for c in self.cliente.opener.open.call_args_list]
        self.assertEqual(parse_qs(urlsplit(chamadas[2].full_url).query), {'grant_type': ['refresh_token']})
        self.assertEqual(json.loads(chamadas[2].data), {'refresh_token': 'refresh1'})
        self.assertEqual(chamadas[3].headers['Authorization'], 'Bearer jwt2')
        self.assertEqual(self.cliente.refresh_token, 'refresh2')

    def test_uid_diferente_interrompe_antes_de_consultar_tabela(self):
        self.cliente.opener.open.return_value = self.sessao(uid='outro-uid')
        with self.assertRaisesRegex(ErroPharmaLeads, 'outro UID'):
            self.cliente.verificar(['chave'])
        self.assertEqual(self.cliente.opener.open.call_count, 1)

    def test_login_recusado_nao_expoe_senha(self):
        self.cliente.opener.open.side_effect = HTTPError('url', 400, 'senha-privada', {}, io.BytesIO(b'privado'))
        with self.assertRaises(ErroPharmaLeads) as erro:
            self.cliente.verificar(['chave'])
        self.assertNotIn('senha-privada', str(erro.exception))
        self.assertNotIn('privado', str(erro.exception))
        self.assertIn('400', str(erro.exception))
