import json
import shlex
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from pharmaleads.render_jobs import COMANDO_JOB, MARCADOR_JOB, ErroRender, RenderJobs
from pharmaleads.render_service import Handler, validar_entrada


class TestRenderJobs(unittest.TestCase):
    def setUp(self):
        self.cliente = RenderJobs('srv-teste', 'chave-ficticia')
        self.entrada = validar_entrada({
            'locais': 'São Paulo, SP\nCuritiba, PR', 'segmentos': 'manipulacao',
            'profundidade': '1', 'modo': 'nacional', 'rodada': '3', 'total_rodadas': '5',
        })
        self.job = {'id': 'job-teste', 'status': 'pending', 'createdAt': '2026-11-10T12:00:00Z'}

    def test_argumento_seguro_e_plano_de_2gb(self):
        self.entrada['locais'] += '; $(echo exemplo)'

        def api(caminho, *, metodo, dados):
            self.assertEqual((caminho, metodo), ('/services/srv-teste/jobs', 'POST'))
            self.assertEqual(dados['planId'], 'plan-srv-008')
            self.assertEqual(len(shlex.split(dados['startCommand'])), 4)
            self.assertTrue(dados['startCommand'].startswith(COMANDO_JOB))
            self.assertNotIn('chave-ficticia', dados['startCommand'])
            self.job.update(dados)
            self.assertEqual(RenderJobs.entrada_do_job(self.job), self.entrada)
            return self.job

        with patch.object(self.cliente, '_api', side_effect=api):
            run = self.cliente.iniciar(self.entrada)
        self.assertEqual((run['status'], run['round'], run['total_rounds']), ('queued', 3, 3))

    def test_status_duravel_com_progresso_e_sem_logs(self):
        with patch.object(self.cliente, '_api', side_effect=lambda *args, dados, **kwargs: {**self.job, **dados}) as api:
            self.cliente.iniciar(self.entrada)
            self.job.update(api.call_args.kwargs['dados'], status='running')
        evento = {'title': 'Nacional 4/5', 'round': 4, 'completed_rounds': 1, 'synced_leads': 8, 'stage': 'enriching'}
        with patch.object(self.cliente, '_api', side_effect=[
            [{'job': self.job}], {'ownerId': 'tea-teste'},
            {'logs': [{'message': MARCADOR_JOB + json.dumps(evento)}]},
        ]) as api:
            run = self.cliente.status()
        self.assertEqual(run['id'], 'job-teste')
        self.assertEqual(run['status'], 'in_progress')
        self.assertEqual({campo: run[campo] for campo in evento}, evento)
        self.assertIn(('resource', 'job-teste'), api.call_args.kwargs['parametros'])

        self.job['status'] = 'succeeded'
        with patch.object(self.cliente, '_api', side_effect=[
            [], [{'job': self.job}], ErroRender('Logs indisponíveis'),
        ]):
            run = self.cliente.status()
        self.assertEqual(run['conclusion'], 'success')
        # Job concluído não significa que todas as rodadas planejadas rodaram;
        # sem evento de progresso, a API não deve inventar uma contagem final.
        self.assertNotIn('completed_rounds', run)

    def test_cancelamento_e_corrida_com_termino_do_job(self):
        with patch.object(self.cliente, '_api', return_value=None) as api:
            self.assertEqual(self.cliente.cancelar(self.job)['status'], 'cancelling')
        api.assert_called_once_with('/services/srv-teste/jobs/job-teste/cancel', metodo='POST')
        with patch.object(self.cliente, '_api', side_effect=[
            ErroRender('Terminou'), {**self.job, 'status': 'succeeded'},
        ]):
            self.assertEqual(self.cliente.cancelar(self.job)['conclusion'], 'success')

    def test_status_mostra_coleta_manual_sem_inventar_progresso(self):
        manual = {**self.job, 'status': 'running',
                  'startCommand': '/usr/bin/env LOCAIS=Curitiba /opt/pharmaleads-venv/bin/python -m pharmaleads.cloud_job'}
        with patch.object(self.cliente, '_api', return_value=[{'job': manual}]) as api:
            run = self.cliente.status()
        self.assertEqual((run['id'], run['status'], run['can_stop']), ('job-teste', 'in_progress', False))
        self.assertNotIn('stage', run)
        self.assertNotIn('synced_leads', run)
        api.assert_called_once()

    @patch('pharmaleads.render_service.RenderJobs')
    def test_inicio_bloqueado_retorna_job_manual_visivel(self, classe_jobs):
        jobs = classe_jobs.return_value
        jobs.ativos.return_value = [self.job]
        jobs.entrada_do_job.return_value = None
        jobs.e_coleta.return_value = True
        jobs.resumir.return_value = {'id': 'job-teste', 'status': 'in_progress', 'can_stop': False}
        handler = object.__new__(Handler)
        handler.server = SimpleNamespace(lock_jobs=threading.Lock(), coletor=Mock())
        handler.server.coletor.status.return_value = None
        handler.headers = {'X-Render-Api-Key': 'chave-ficticia'}
        handler._autorizado = Mock(return_value=True)
        handler._json = Mock()
        handler._one_off('/v1/jobs/start')
        self.assertEqual(handler._json.call_args.args[0], 409)
        self.assertEqual(handler._json.call_args.args[1]['run']['id'], 'job-teste')

    @patch('pharmaleads.render_service.RenderJobs')
    def test_status_mostra_coleta_antiga_ativa_no_servico_web(self, classe_jobs):
        jobs = classe_jobs.return_value
        jobs.status.return_value = None
        legado = {'id': 123, 'status': 'in_progress', 'stage': 'searching'}
        handler = object.__new__(Handler)
        handler.server = SimpleNamespace(lock_jobs=threading.Lock(), coletor=Mock())
        handler.server.coletor.status.return_value = legado
        handler.headers = {'X-Render-Api-Key': 'chave-ficticia'}
        handler._autorizado = Mock(return_value=True)
        handler._json = Mock()
        handler._one_off('/v1/jobs/status')
        self.assertEqual(handler._json.call_args.args[1]['run'], legado)

    @patch('pharmaleads.render_service.RenderJobs')
    def test_conflito_de_coleta_antiga_retorna_execucao(self, classe_jobs):
        jobs = classe_jobs.return_value
        jobs.ativos.return_value = []
        legado = {'id': 123, 'status': 'in_progress', 'stage': 'searching'}
        handler = object.__new__(Handler)
        handler.server = SimpleNamespace(lock_jobs=threading.Lock(), coletor=Mock())
        handler.server.coletor.status.return_value = legado
        handler.headers = {'X-Render-Api-Key': 'chave-ficticia'}
        handler._autorizado = Mock(return_value=True)
        handler._json = Mock()
        handler._one_off('/v1/jobs/start')
        self.assertEqual(handler._json.call_args.args[0], 409)
        self.assertEqual(handler._json.call_args.args[1]['run'], legado)

    @patch('pharmaleads.render_service.RenderJobs')
    def test_rota_bloqueia_inicio_com_um_job_manual_ativo(self, classe_jobs):
        jobs = classe_jobs.return_value
        jobs.ativos.return_value = [self.job]
        jobs.entrada_do_job.return_value = None
        handler = object.__new__(Handler)
        handler.server = SimpleNamespace(lock_jobs=threading.Lock(), coletor=Mock())
        handler.server.coletor.status.return_value = None
        handler.headers = {'X-Render-Api-Key': 'chave-ficticia'}
        handler._autorizado = Mock(return_value=True)
        handler._json = Mock()
        handler._one_off('/v1/jobs/start')
        self.assertEqual(handler._json.call_args.args[0], 409)
        jobs.iniciar.assert_not_called()
