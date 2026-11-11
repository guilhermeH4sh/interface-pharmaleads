import csv
import io
import os
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import MagicMock, patch

from pharmaleads import cloud_job
from pharmaleads.config import ErroPharmaLeads


class TestCloudJob(unittest.TestCase):
    def test_limites_da_coleta(self):
        with patch.dict(os.environ, {'LOCAIS':'Curitiba, PR', 'SEGMENTOS':'varejo,manipulacao',
                                     'PROFUNDIDADE':'1', 'SUPABASE_EMAIL':'teste@example.com',
                                     'SUPABASE_PASSWORD':'senha'}, clear=True):
            consultas, profundidade, emails, enriquecer = cloud_job.configuracao()
            self.assertEqual((len(consultas), profundidade, emails, enriquecer), (4, 1, True, False))
        with patch.dict(os.environ, {'LOCAIS':'Curitiba, PR', 'SEGMENTOS':'invalido',
                                     'SUPABASE_EMAIL':'teste@example.com', 'SUPABASE_PASSWORD':'senha'}, clear=True):
            with self.assertRaises(ErroPharmaLeads):
                cloud_job.configuracao()

    def test_docker_realimenta_o_supabase_apos_importacao(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = {'LOCAIS':'Curitiba, PR', 'SEGMENTOS':'manipulacao', 'PROFUNDIDADE':'1',
                      'EMAILS':'false', 'PHARMALEADS_HOME':tmp, 'SUPABASE_EMAIL':'teste@example.com',
                      'SUPABASE_PASSWORD':'senha'}
            fake_client = MagicMock()
            fake_config = {'SUPABASE_URL':'https://teste.supabase.co', 'SUPABASE_SECRET_KEY':'sb_secret_fake'}

            def docker(command, **_):
                pasta = Path(command[command.index('-v') + 1].split(':/gmapsdata')[0])
                self.assertEqual(command[command.index('-c') + 1], '2')
                self.assertIn('-email', command)
                entradas = (pasta / 'input.txt').read_text(encoding='utf-8').splitlines()
                self.assertEqual(entradas, ['farmácia de manipulação em Curitiba, PR #!#manipulacao|Curitiba, PR'])
                with (pasta / 'results.csv').open('w', encoding='utf-8', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=['cid','title','address','input_id','emails'])
                    writer.writeheader()
                    writer.writerow({'cid':'cid-cloud-1','title':'Farmácia real',
                                     'address':'Curitiba, PR','input_id':'manipulacao|Curitiba, PR',
                                     'emails':'contato@farmacia.com.br'})
                    writer.writerow({'cid':'cid-cloud-2','title':'Farmácia sem contato',
                                     'address':'Curitiba, PR','input_id':'manipulacao|Curitiba, PR',
                                     'emails':''})

            saida = io.StringIO()
            with patch.dict(os.environ, {**config, 'PHARMALEADS_PROGRESS': '1'}, clear=True), patch('pharmaleads.cloud_job._rodar_docker', side_effect=docker), patch('pharmaleads.supabase.ler_configuracao', return_value=fake_config), patch('pharmaleads.supabase.Supabase', return_value=fake_client), redirect_stdout(saida):
                self.assertEqual(cloud_job.main(), 0)
            self.assertIn('"found_leads": 2', saida.getvalue())
            self.assertIn('"with_email": 1', saida.getvalue())
            records = fake_client.salvar.call_args.args[0]
            self.assertEqual(len(records), 1)
            self.assertEqual(records[0]['chave'], 'cid-cloud-1')
            self.assertEqual(records[0]['emails'], 'contato@farmacia.com.br')

    def test_render_executa_o_binario_sem_docker(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            saida = base / 'results.csv'
            with patch.dict(os.environ, {'GOSOM_BIN': '/usr/bin/google-maps-scraper'}, clear=True):
                comando = cloud_job._comando_gosom(base, saida, 2, True)
            self.assertEqual(comando[0], '/usr/bin/google-maps-scraper')
            self.assertNotIn('docker', comando)
            self.assertEqual(comando[comando.index('-input') + 1], str(base / 'input.txt'))
            self.assertEqual(comando[comando.index('-results') + 1], str(saida))
            self.assertIn('-email', comando)
