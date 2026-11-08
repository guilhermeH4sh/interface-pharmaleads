import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from pharmaleads.recuperar_emails import resultados, varrer


class TestRetomadaEmails(unittest.TestCase):
    def test_ignora_linha_truncada(self):
        with tempfile.TemporaryDirectory() as pasta:
            saida = Path(pasta) / 'resultado.csv'
            saida.write_text('cid,emails,title\n1,contato@drogaria.com.br\n', encoding='utf-8')
            self.assertEqual(resultados(saida, {'1'}), {})

    def test_timeout_aproveita_csv_completo(self):
        with tempfile.TemporaryDirectory() as pasta:
            estado = Path(pasta) / 'progresso.json'
            estado.write_text(json.dumps({
                'leads': [{'chave': '1', 'nome': 'Drogaria'}],
                'consultados': 0, 'encontrados': 0, 'atualizados': 0,
                'sem_correspondencia': [],
            }), encoding='utf-8')
            cliente = Mock()
            cliente.adicionar_emails.return_value = True

            def expirou(comando, **_):
                saida = Path(comando[comando.index('-results') + 1])
                saida.write_text('cid,emails,title\n1,contato@drogaria.com.br,Drogaria\n', encoding='utf-8')
                raise subprocess.TimeoutExpired(comando, 1800)

            with patch('pharmaleads.recuperar_emails.localizar_gosom', return_value=['gosom']), patch(
                'pharmaleads.recuperar_emails.subprocess.run', side_effect=expirou
            ):
                varrer(cliente, estado, 60, 0, 4)
            cliente.adicionar_emails.assert_called_once_with('1', 'contato@drogaria.com.br')
            final = json.loads(estado.read_text(encoding='utf-8'))
            self.assertEqual((final['consultados'], final['atualizados']), (1, 1))

    def test_isola_lead_sem_resultado_e_continua(self):
        with tempfile.TemporaryDirectory() as pasta:
            estado = Path(pasta) / 'progresso.json'
            estado.write_text(json.dumps({
                'leads': [{'chave': '1', 'nome': 'Sem resultado'},
                          {'chave': '2', 'nome': 'Com resultado'}],
                'consultados': 0, 'encontrados': 0, 'atualizados': 0,
                'sem_correspondencia': [],
            }), encoding='utf-8')
            cliente = Mock()
            cliente.adicionar_emails.return_value = True

            def executar(comando, **_):
                entrada = Path(comando[comando.index('-input') + 1]).read_text(encoding='utf-8')
                saida = Path(comando[comando.index('-results') + 1])
                if 'Com resultado' in entrada and 'Sem resultado' not in entrada:
                    saida.write_text('cid,emails,title\n2,contato@empresa.com.br,Com resultado\n', encoding='utf-8')
                else:
                    saida.write_text('cid,emails,title\n', encoding='utf-8')

            with patch('pharmaleads.recuperar_emails.localizar_gosom', return_value=['gosom']), patch(
                'pharmaleads.recuperar_emails.subprocess.run', side_effect=executar
            ):
                varrer(cliente, estado, 2, 0, 4)
            final = json.loads(estado.read_text(encoding='utf-8'))
            self.assertEqual((final['consultados'], final['atualizados']), (2, 1))
            self.assertEqual(final['falhas_sem_resultado'], ['1'])

    def test_pula_emails_consultando_somente_as_chaves_do_lote(self):
        with tempfile.TemporaryDirectory() as pasta:
            estado = Path(pasta) / 'progresso.json'
            estado.write_text(json.dumps({
                'leads': [{'chave': '1', 'nome': 'Já coberto'},
                          {'chave': '2', 'nome': 'Pendente'}],
                'consultados': 0, 'encontrados': 0, 'atualizados': 0,
                'sem_correspondencia': [],
            }), encoding='utf-8')
            cliente = Mock()
            cliente.adicionar_emails.return_value = True
            cliente.buscar.return_value = {
                '1': {'chave': '1', 'emails': 'contato@coberto.com.br'},
                '2': {'chave': '2', 'emails': ''},
            }

            def executar(comando, **_):
                entrada = Path(comando[comando.index('-input') + 1]).read_text(encoding='utf-8')
                self.assertIn('Pendente', entrada)
                self.assertNotIn('Já coberto', entrada)
                saida = Path(comando[comando.index('-results') + 1])
                saida.write_text('cid,emails,title\n2,contato@pendente.com.br,Pendente\n', encoding='utf-8')

            with patch('pharmaleads.recuperar_emails.localizar_gosom', return_value=['gosom']), patch(
                'pharmaleads.recuperar_emails.subprocess.run', side_effect=executar
            ):
                varrer(cliente, estado, 2, 0, 4, somente_sem_email=True)
            cliente.buscar.assert_called_once_with({'1', '2'})
            cliente.listar.assert_not_called()
            cliente.adicionar_emails.assert_called_once_with('2', 'contato@pendente.com.br')
            final = json.loads(estado.read_text(encoding='utf-8'))
            self.assertEqual((final['consultados'], final['pulados_com_email']), (2, 1))
