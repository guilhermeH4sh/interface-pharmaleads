import os
import unittest
from io import StringIO
from unittest.mock import MagicMock, patch

from pharmaleads.config import ErroPharmaLeads
from pharmaleads.cloud_job import MARCADOR_PROGRESSO
from pharmaleads.render_service import ColetorRender, validar_entrada


class TestRenderService(unittest.TestCase):
    @patch('pharmaleads.render_service.entradas_seguintes')
    @patch('pharmaleads.render_service.subprocess.Popen')
    def test_meta_para_sem_iniciar_proxima_rodada(self, popen, seguinte):
        popen.return_value.wait.return_value = 0
        popen.return_value.stdout = StringIO(
            MARCADOR_PROGRESSO + '{"stage":"round_complete","new_supabase_leads":1000,"queries":8,"queries_with_results":6}\n'
        )
        coletor = ColetorRender()
        coletor._run = {'id': 1, 'status': 'queued', 'conclusion': None}
        entrada = validar_entrada({'locais': 'Curitiba, PR', 'segmentos': 'manipulacao',
                                   'modo': 'nacional', 'rodada': 1, 'total_rodadas': 2})
        coletor._executar(entrada)
        self.assertEqual(coletor.status()['new_supabase_leads'], 1000)
        self.assertEqual(coletor.status()['status'], 'completed')
        self.assertEqual(coletor.status()['conclusion'], 'success')
        seguinte.assert_not_called()
        popen.assert_called_once()

    def test_valida_e_forca_emails(self):
        entrada = validar_entrada({
            'locais': 'Curitiba, PR', 'segmentos': 'varejo,manipulacao',
            'profundidade': '1', 'emails': 'false',
        })
        self.assertEqual(entrada['emails'], 'true')
        self.assertEqual(entrada['modo'], 'avulsa')
        with self.assertRaises(ErroPharmaLeads):
            validar_entrada({'locais': 'Curitiba, PR', 'segmentos': 'invalido', 'profundidade': 1})

    @patch('pharmaleads.render_service.threading.Thread')
    def test_impede_duas_coletas_simultaneas(self, thread):
        thread.return_value = MagicMock()
        coletor = ColetorRender()
        entrada = {'locais': 'Curitiba, PR', 'segmentos': 'manipulacao', 'profundidade': 1}
        run = coletor.iniciar(entrada)
        self.assertEqual(run['status'], 'queued')
        with self.assertRaisesRegex(ErroPharmaLeads, 'andamento'):
            coletor.iniciar(entrada)
        thread.return_value.start.assert_called_once()

    def test_titulo_nacional_e_url_publica(self):
        with patch.dict(os.environ, {'RENDER_EXTERNAL_HOSTNAME': 'coletor.onrender.com'}):
            coletor = ColetorRender()
            self.assertEqual(coletor._url_publica(), 'https://coletor.onrender.com/health')
            self.assertEqual(coletor._titulo({
                'modo': 'nacional', 'rodada': '2', 'total_rodadas': '10', 'resumo': 'São Paulo, SP'
            }), 'Nacional 2/10 · São Paulo, SP')

    @patch('pharmaleads.render_service.entradas_seguintes', return_value=None)
    @patch('pharmaleads.render_service.subprocess.Popen')
    def test_ultima_rodada_nacional_conclui_com_sucesso(self, popen, _seguinte):
        popen.return_value.wait.return_value = 0
        popen.return_value.stdout = StringIO(
            MARCADOR_PROGRESSO + '{"stage":"syncing"}\n' +
            MARCADOR_PROGRESSO + '{"stage":"synced","synced_leads":12}\n'
        )
        coletor = ColetorRender()
        def verificar_progresso():
            self.assertEqual(coletor.status()['stage'], 'syncing')
            self.assertEqual(coletor.status()['synced_leads'], 12)
            return 0
        popen.return_value.wait.side_effect = verificar_progresso
        coletor._run = {
            'id': 1, 'status': 'queued', 'conclusion': None, 'url': '',
            'created_at': '2026-11-10T00:00:00+00:00', 'title': 'Na fila',
        }
        entrada = validar_entrada({
            'locais': 'Curitiba, PR', 'segmentos': 'manipulacao', 'profundidade': 1,
            'modo': 'nacional', 'rodada': 2, 'total_rodadas': 2, 'request_id': 'teste-r2',
        })
        coletor._executar(entrada)
        self.assertEqual(coletor.status()['status'], 'completed')
        self.assertEqual(coletor.status()['conclusion'], 'success')
        self.assertEqual(coletor.status()['completed_rounds'], 1)
        ambiente = popen.call_args.kwargs['env']
        self.assertEqual(ambiente['GOSOM_BIN'], '/usr/bin/google-maps-scraper')
        self.assertEqual(ambiente['EMAILS'], 'true')


if __name__ == '__main__':
    unittest.main()
