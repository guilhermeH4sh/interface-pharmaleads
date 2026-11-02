import json
import subprocess
import unittest
from pathlib import Path

from pharmaleads.cobertura import entradas_seguintes, locais_nacionais, montar_fila
from pharmaleads.config import SEGMENTOS
from pharmaleads.gerador import montar_consultas


class TestCoberturaNacional(unittest.TestCase):
    def test_capitais_vem_antes_do_interior_e_cada_rodada_cabe(self):
        locais = locais_nacionais()
        ufs = [local[-2:] for local in locais[:27]]
        self.assertEqual(len(set(ufs)), 27)
        self.assertEqual(locais[27], 'Santarém, PA')
        self.assertGreaterEqual(sum(local.endswith('SP') for local in locais), 2)
        fila = montar_fila(['varejo', 'manipulacao'])
        self.assertEqual([local[-2:] for local in fila[0]], ['AC', 'AL', 'DF', 'ES', 'PR'])
        for segmentos in (['manipulacao'], ['varejo', 'manipulacao'],
                          ['varejo', 'manipulacao', 'homeopatia', 'veterinaria', 'distribuidoras']):
            for rodada in montar_fila(segmentos):
                self.assertLessEqual(len(montar_consultas(rodada, segmentos)), 20)

    def test_a_fila_avanca_e_para_na_ultima_rodada(self):
        segmentos = ['varejo', 'manipulacao']
        fila = montar_fila(segmentos)
        seguinte = entradas_seguintes(1, segmentos, '1', 'false', 'false', 'pedido')
        self.assertEqual(seguinte['rodada'], '2')
        self.assertEqual(seguinte['locais'].splitlines(), fila[1])
        self.assertEqual(seguinte['request_id'], 'pedido-r2')
        self.assertIsNone(entradas_seguintes(len(fila), segmentos, '1', 'false', 'false', 'pedido-r10'))

    def test_o_painel_e_o_python_montam_a_mesma_fila(self):
        raiz = Path(__file__).resolve().parents[1]
        codigo = """
        import { montarFila } from './api/cobertura.mjs';
        const termos = {varejo:3,manipulacao:1,homeopatia:1,veterinaria:1,distribuidoras:2};
        const grupos = [['varejo','manipulacao'],['manipulacao'],['varejo','manipulacao','homeopatia','veterinaria','distribuidoras']];
        console.log(JSON.stringify(grupos.map(segmentos => montarFila(segmentos, termos))));
        """
        resultado = subprocess.run(['node', '--input-type=module', '-e', codigo], cwd=raiz,
                                   capture_output=True, text=True, check=True)
        recebido = json.loads(resultado.stdout)
        grupos = [['varejo', 'manipulacao'], ['manipulacao'],
                  ['varejo', 'manipulacao', 'homeopatia', 'veterinaria', 'distribuidoras']]
        for segmentos, fila in zip(grupos, recebido):
            self.assertEqual([len(SEGMENTOS[nome]['termos']) for nome in segmentos],
                             [{'varejo': 3, 'manipulacao': 1, 'homeopatia': 1, 'veterinaria': 1, 'distribuidoras': 2}[nome] for nome in segmentos])
            self.assertEqual(fila, montar_fila(segmentos))
