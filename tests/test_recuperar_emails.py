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
