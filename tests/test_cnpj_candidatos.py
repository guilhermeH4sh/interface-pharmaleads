import unittest

from scripts.preparar_fila_cnpj import localizacao
from scripts.revisar_cnpj_candidatos import prioridade


class CruzamentoCNPJTests(unittest.TestCase):
    def test_extrai_cep_e_uf_do_endereco(self):
        self.assertEqual(localizacao('R. Quintino Bocaiúva, 1890 - Rio Branco - AC, 69900-670', ''),
                         ('69900670', 'AC'))

    def test_mesmo_endereco_nao_basta_para_trocar_a_empresa(self):
        candidato = {
            'nome_lead': 'Nova Ciência Farmácia de Manipulação',
            'endereco_lead': 'Nova Ciência Farmácia de Manipulação - R. Ébano Pereira, 60 - Curitiba - PR, 80410-240',
            'nome_fantasia': 'MANIDERMA FARMACIA DE MANIPULACAO',
            'logradouro': 'EBANO PEREIRA', 'numero': '60', 'email': 'maniderma@maniderma.com.br',
        }
        self.assertIsNone(prioridade(candidato))

    def test_nome_e_endereco_coincidentes_geram_candidato(self):
        candidato = {
            'nome_lead': 'Medplus',
            'endereco_lead': 'Medplus - R. Quintino Bocaiúva, 1890 - Rio Branco - AC, 69900-670',
            'nome_fantasia': 'MEDPLUS COMERCIO E REPRESENTACAO LTDA',
            'logradouro': 'QUINTINO BOCAIUVA', 'numero': '1890',
            'email': 'comercial@medplusonline.com.br',
        }
        self.assertIsNotNone(prioridade(candidato))


if __name__ == '__main__':
    unittest.main()
