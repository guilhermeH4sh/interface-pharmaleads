import unittest

from scripts.cruzar_cnpj_telefone import telefone_brasileiro


class TelefoneCNPJTests(unittest.TestCase):
    def test_celular_com_codigo_do_pais(self):
        self.assertEqual(telefone_brasileiro('+55 11 98888-1234'), ('11', '988881234'))

    def test_fixo_sem_codigo_do_pais(self):
        self.assertEqual(telefone_brasileiro('(41) 3333-1234'), ('41', '33331234'))

    def test_numero_sem_ddd_nao_cruza(self):
        self.assertEqual(telefone_brasileiro('+55 4002-8282'), ('', ''))


if __name__ == '__main__':
    unittest.main()
