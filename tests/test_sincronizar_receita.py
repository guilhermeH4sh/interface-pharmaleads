import json
import sqlite3
import unittest
from unittest.mock import Mock

from scripts.importar_receita_uf import preparar_banco
from scripts.sincronizar_receita import IndiceLeads, sincronizar


class TestSincronizarReceita(unittest.TestCase):
    def test_filiais_com_cnpjs_distintos_podem_compartilhar_nome_e_telefone(self):
        indice = IndiceLeads([{
            'chave': 'receita:12345678000195', 'nome': 'Drogaria Rede',
            'endereco': 'Rua do Comércio, 23, Brasília, DF, 70000-000',
            'telefone': '6133334444', 'dados_brutos': {'cnpj': '12345678000195'},
        }])
        filial = {
            'cnpj': '12345678000276', 'nome_fantasia': 'Drogaria Rede', 'telefones': ['6133334444'],
            'cep': '70000001', 'logradouro': 'Rua do Comércio', 'numero': '23', 'uf': 'DF',
        }
        self.assertEqual(indice.encontrar(filial, 'Brasília'), (None, 'novo'))
        self.assertEqual(indice.encontrar({**filial, 'cep': '70000000'}, 'Brasília'), (None, 'revisar'))

    def test_dry_run_e_aplicacao_preservam_o_crm_e_separam_ambiguos(self):
        con = sqlite3.connect(':memory:')
        self.addCleanup(con.close)
        preparar_banco(con)
        con.execute('CREATE TABLE ibge_localidades (codigo, nome, tipo, uf)')
        con.execute("INSERT INTO ibge_localidades VALUES (5300108, 'Brasília', 'municipio', 'DF')")
        base = {
            'uf': 'DF', 'codigo_municipio_receita': '9701', 'nome_fantasia': 'Farmácia', 'cep': '',
            'logradouro': 'Rua Comércio', 'tipo_logradouro': 'RUA', 'numero': '23',
            'bairro': 'Centro', 'telefones': [], 'email': 'contato@loja.com.br',
            'cnae_principal': '4771701', 'cnaes_correspondentes': ['4771701'],
            'competencia': '2026-10', 'importado_em': '2026-11-15T00:00:00Z',
        }
        catalogo = [
            {'chave': 'crm-1', 'nome': 'Farmácia', 'crm_status': 'Qualificado', 'emails': 'anterior@loja.com.br',
             'dados_brutos': {'cnpj': '12345678000195', 'fonte_dados': 'Google Maps', 'crm_notas': 'preservar'}},
            {'chave': 'existente', 'nome': 'Outra Farmácia', 'telefone': '6133334444', 'dados_brutos': {}},
        ]
        cadastros = [
            {**base, 'cnpj': '12345678000195'},
            {**base, 'cnpj': '12345678000276', 'nome_fantasia': 'Possível duplicata', 'telefones': ['6133334444']},
            {**base, 'cnpj': '12345678000357', 'nome_fantasia': 'Nova Farmácia'},
            {**base, 'cnpj': '12345678000438', 'codigo_municipio_receita': '1234'},
            {**base, 'cnpj': '12345678000519', 'nome_fantasia': 'Farmácia sem contato', 'email': 'inválido'},
            {**base, 'cnpj': '12345678000608', 'nome_fantasia': '', 'email': ''},
        ]
        con.executemany('INSERT INTO receita_estabelecimentos VALUES (?,?,?,?)', [
            ('2026-10', item['cnpj'], 'DF', json.dumps(item)) for item in cadastros
        ])
        cliente = Mock()
        cliente.listar_referencia_receita.return_value = catalogo
        cliente.atualizar_dados_receita.return_value = True
        cliente.inserir_receita.return_value = 2
        municipios = {'9701': 'BRASILIA'}
        self.assertEqual(sincronizar(con, cliente, municipios, 'DF', '2026-10'), {
            'a_enriquecer': 1, 'revisao': 1, 'municipio_sem_correspondencia': 1,
            'sem_nome': 1, 'a_inserir': 2, 'a_inserir_sem_email': 1,
        })
        cliente.atualizar_dados_receita.assert_not_called()
        cliente.inserir_receita.assert_not_called()
        resumo = sincronizar(con, cliente, municipios, 'DF', '2026-10', aplicar=True)
        self.assertEqual((resumo['enriquecidos'], resumo['inseridos']), (1, 2))
        chave, antes, depois = cliente.atualizar_dados_receita.call_args.args
        self.assertEqual(chave, 'crm-1')
        self.assertEqual(antes, catalogo[0]['dados_brutos'])
        self.assertEqual(depois['crm_notas'], 'preservar')
        self.assertEqual(depois['fonte_dados'], 'Google Maps')
        novo, sem_email = cliente.inserir_receita.call_args.args[0]
        self.assertEqual(novo['chave'], 'receita:12345678000357')
        self.assertFalse(novo['crm_included'])
        self.assertEqual(novo['dados_brutos']['fonte_dados'], 'Receita Federal')
        self.assertEqual(novo['dados_brutos']['ibge']['codigo_municipio'], 5300108)
        self.assertEqual(sem_email['chave'], 'receita:12345678000519')
        self.assertEqual(sem_email['emails'], '')
