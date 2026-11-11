import unittest

from pharmaleads.cnpj import unico_publicado, valido


class TestCnpjSite(unittest.TestCase):
    def test_valida_digitos_e_ambiguidade(self):
        self.assertTrue(valido('11.222.333/0001-81'))
        self.assertFalse(valido('11.222.333/0001-82'))
        self.assertFalse(valido('00.000.000/0000-00'))
        self.assertEqual(unico_publicado('CNPJ: 11.222.333/0001-81'), '11222333000181')
        self.assertEqual(unico_publicado('11.222.333/0001-81'), '')
        self.assertEqual(unico_publicado('CNPJ: 11.222.333/0001-82'), '')
        self.assertEqual(unico_publicado('11.222.333/0001-81 e 04.252.011/0001-10'), '')
