import json
import threading
import unittest
from datetime import datetime, timezone
from io import StringIO
from types import SimpleNamespace
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from pharmaleads.agenda import GRUPOS, disparar, entrada_agendada
from pharmaleads.cloud_job import MARCADOR_PROGRESSO
from pharmaleads.render_service import ColetorRender, Handler


class TestAgenda(unittest.TestCase):
    def test_tres_grupos_disjuntos_cobrem_todas_as_ufs(self):
        ufs = [local[-2:] for grupo in GRUPOS.values() for local in grupo]
        self.assertEqual({hora: len(ufs) for hora, ufs in GRUPOS.items()}, {7: 9, 13: 9, 19: 9})
        self.assertEqual(sorted(ufs), 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split())

    @patch('pharmaleads.agenda.time.sleep')
    @patch('pharmaleads.agenda.build_opener')
    @patch('pharmaleads.agenda.datetime')
    def test_espera_coleta_ativa_e_dispara_o_grupo_correto(self, relogio, abrir, dormir):
        agora = datetime(2026, 11, 15, 16, 0, tzinfo=timezone.utc)
        relogio.now.return_value = agora
        resposta = StringIO('{"run":{"id":"job-1"}}')
        resposta.status = 202
        abrir.return_value.open.side_effect = [HTTPError('', 409, '', {}, None), resposta]
        with patch.dict('os.environ', {
            'RENDER_COLLECTOR_URL': 'https://coletor.example.org',
            'RENDER_COLLECTOR_TOKEN': 'token-de-teste',
            'RENDER_API_KEY': 'chave-de-teste',
        }):
            disparar(agora)
        dormir.assert_called_once_with(60)
        req = abrir.return_value.open.call_args.args[0]
        entrada = json.loads(req.data)
        self.assertEqual(req.full_url, 'https://coletor.example.org/v1/jobs/start')
        self.assertEqual((entrada['grupo'], entrada['request_id']), ('13', 'agenda-2026-11-15-13'))

    @patch('pharmaleads.render_service.subprocess.Popen')
    def test_roda_todas_as_ufs_apos_falha_e_apos_meta(self, popen):
        locais = []

        def processo(*_, env, **kwargs):
            locais.append(env['LOCAIS'])
            saida = MARCADOR_PROGRESSO + '{"stage":"round_complete","new_supabase_leads":1000}\n'
            return Mock(stdout=StringIO(saida), wait=Mock(return_value=1 if len(locais) == 2 else 0))

        popen.side_effect = processo
        coletor = ColetorRender()
        self.assertEqual(coletor.executar_job(entrada_agendada(7, 1, 'agenda-teste')), 'failure')
        self.assertEqual(locais, list(GRUPOS[7]))
        self.assertEqual(coletor.status()['skipped_rounds'], 1)
        self.assertNotIn('goal_leads', coletor.status())

    @patch('pharmaleads.render_service.RenderJobs')
    def test_identificador_repetido_reusa_job_existente(self, classe_jobs):
        jobs = classe_jobs.return_value
        jobs.ativos.return_value = []
        anterior = {'id': 'job-1', 'status': 'completed'}
        jobs.buscar_agenda.return_value = anterior
        handler = object.__new__(Handler)
        handler.server = SimpleNamespace(lock_jobs=threading.Lock(), coletor=Mock())
        handler.server.coletor.status.return_value = None
        handler.headers = {'X-Render-Api-Key': 'chave-de-teste'}
        handler._autorizado = Mock(return_value=True)
        handler._body = Mock(return_value=entrada_agendada(7, 1, 'agenda-teste'))
        handler._json = Mock()
        handler._one_off('/v1/jobs/start')
        handler._json.assert_called_once_with(202, {'queued': False, 'run': anterior})
        jobs.iniciar.assert_not_called()
