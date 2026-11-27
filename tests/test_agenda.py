import json
import threading
import unittest
from datetime import date, datetime, timedelta, timezone
from io import StringIO
from types import SimpleNamespace
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from pharmaleads.agenda import HORARIOS, UFS, disparar, entrada_agendada, plano_agendado, municipios_por_uf
from pharmaleads.config import ErroPharmaLeads
from pharmaleads.gerador import montar_consultas
from pharmaleads.cloud_job import MARCADOR_PROGRESSO, SEM_RESULTADOS
from pharmaleads.render_service import ColetorRender, Handler


class TestAgenda(unittest.TestCase):
    def test_cada_horario_visita_cidades_das_27_ufs_sem_duplicatas(self):
        for hora in HORARIOS:
            locais = plano_agendado(hora, '2026-11-24')
            self.assertEqual({local[-2:] for local in locais}, UFS)
            self.assertEqual(len(locais), 105)  # DF possui uma única localidade.
            self.assertEqual(len(set(locais)), len(locais))
            self.assertEqual([local[-2:] for local in locais[:8]], ['AC'] * 4 + ['AL'] * 4)

    def test_cidades_avancam_entre_horarios_e_dias_e_cobrem_toda_sp(self):
        vistos = set()
        anteriores = set()
        for dia in range(110):
            data = (date(2026, 11, 24) + timedelta(days=dia)).isoformat()
            for hora in HORARIOS:
                cidades = {local for local in plano_agendado(hora, data) if local.endswith(', SP')}
                self.assertFalse(cidades & anteriores)
                vistos.update(cidades)
                anteriores = cidades
        self.assertEqual(vistos, set(municipios_por_uf()['SP']))

    def test_continuacao_preserva_data_e_segmentos_entre_rodadas(self):
        entrada = entrada_agendada(19, 1, 'agenda-teste', dia='2026-11-24')
        proxima = ColetorRender._proxima_rodada(entrada)
        self.assertEqual(proxima['dia'], '2026-11-24')
        self.assertEqual(proxima['locais'].splitlines(), plano_agendado(19, '2026-11-24')[2:4])
        self.assertEqual(proxima['segmentos'], entrada['segmentos'])
        for local in plano_agendado(19, '2026-11-24'):
            self.assertLessEqual(len(montar_consultas([local], entrada['segmentos'].split(','))), 8)
        self.assertLessEqual(len(montar_consultas(entrada['locais'].splitlines(), entrada['segmentos'].split(','))), 8)
        self.assertIsNone(ColetorRender._proxima_rodada(entrada_agendada(19, 53, 'agenda-teste')))

    def test_rejeita_configuracao_fora_dos_limites(self):
        for hora, data, quantidade in [(8, '2026-11-24', 2), (7, 'invalid', 2), (7, '2026-11-24', 5)]:
            with self.assertRaises(ErroPharmaLeads):
                plano_agendado(hora, data, quantidade)

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
            self.assertEqual(env['EMAILS'], 'false')
            self.assertEqual(env['ENRIQUECER_SITES'], 'false')
            saida = MARCADOR_PROGRESSO + '{"stage":"round_complete","new_supabase_leads":1000}\n'
            codigo = {1: SEM_RESULTADOS, 2: 1}.get(len(locais), 0)
            return Mock(stdout=StringIO(saida if codigo == 0 else ''), wait=Mock(return_value=codigo))

        popen.side_effect = processo
        coletor = ColetorRender()
        self.assertEqual(coletor.executar_job(entrada_agendada(7, 1, 'agenda-teste')), 'failure')
        self.assertEqual([cidade for lote in locais for cidade in lote.splitlines()],
                         plano_agendado(7, datetime.now(timezone(timedelta(hours=-3))).date().isoformat()))
        self.assertEqual(coletor.status()['skipped_rounds'], 1)
        self.assertEqual(coletor.status()['empty_rounds'], 1)
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
