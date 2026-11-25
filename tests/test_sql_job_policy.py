import unittest
from scripts.check_sql_jobs import violations


class TestSqlJobPolicy(unittest.TestCase):
    def test_bloqueia_agendamento_e_alteracao_inclusive_sql_em_strings(self):
        for text in ["SELECT cron.schedule('x', '10 seconds', 'UPDATE t SET a=1');",
                     'SELECT "cron" . "alter_job" (11);',
                     "payload = 'SELECT cron.schedule_in_database(1)' "]:
            self.assertTrue(violations(text))

    def test_permite_reversao_e_migracoes_sem_agendamento(self):
        self.assertEqual(violations('SELECT cron.unschedule(11);\nDROP INDEX IF EXISTS public.idx;'), [])

    def test_informa_a_linha_para_revisao(self):
        self.assertEqual(violations("SELECT 1;\nSELECT cron.schedule('x', 'x', 'x');"), [2])
