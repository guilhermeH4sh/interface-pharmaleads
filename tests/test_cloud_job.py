import csv
import os
import tempfile
import unittest
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
            self.assertEqual((len(consultas), profundidade, emails, enriquecer), (4, 1, False, False))
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
                entradas = (pasta / 'input.txt').read_text(encoding='utf-8').splitlines()
                self.assertEqual(entradas, ['farmácia de manipulação em Curitiba, PR #!#manipulacao|Curitiba, PR'])
                with (pasta / 'results.csv').open('w', encoding='utf-8', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=['cid','title','address','input_id'])
                    writer.writeheader()
                    writer.writerow({'cid':'cid-cloud-1','title':'Farmácia real',
                                     'address':'Curitiba, PR','input_id':'manipulacao|Curitiba, PR'})

            with patch.dict(os.environ, config, clear=True), patch('pharmaleads.cloud_job.subprocess.run', side_effect=docker), patch('pharmaleads.supabase.ler_configuracao', return_value=fake_config), patch('pharmaleads.supabase.Supabase', return_value=fake_client):
                self.assertEqual(cloud_job.main(), 0)
            records = fake_client.salvar.call_args.args[0]
            self.assertEqual(records[0]['chave'], 'cid-cloud-1')
