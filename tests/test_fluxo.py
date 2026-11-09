"""
Testes do PharmaLeads (usam um gosom de mentira, não acessam o Google).

Como rodar, dentro da pasta do projeto:
    python -m unittest discover -s tests -v
"""
import csv
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

RAIZ_PROJETO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ_PROJETO))

from pharmaleads import config, gerador  # noqa: E402
from pharmaleads.banco import Banco, analisar_telefone, classificar_situacao  # noqa: E402
from pharmaleads.coletor import Opcoes, montar_comando, processar, verificar_gosom  # noqa: E402
from pharmaleads.config import ErroPharmaLeads  # noqa: E402

FALSO = [sys.executable, str(RAIZ_PROJETO / "tests" / "gosom_falso.py")]



def opcoes(**extra) -> Opcoes:
    base = dict(bin=FALSO, pausa_max=0, espera_erro=0, max_tentativas=2)
    base.update(extra)
    return Opcoes(**base)


class TestFuncoesPuras(unittest.TestCase):
    def test_situacao(self):
        self.assertEqual(classificar_situacao(""), "ativa_ou_desconhecida")
        self.assertEqual(classificar_situacao("Open"), "ativa_ou_desconhecida")
        self.assertEqual(classificar_situacao("Permanently closed"), "fechada_permanentemente")
        self.assertEqual(classificar_situacao("Fechado temporariamente"), "fechada_temporariamente")
        self.assertEqual(classificar_situacao("CLOSED"), "fechada")

    def test_telefone(self):
        self.assertEqual(analisar_telefone("(15) 99999-0000"), ("5515999990000", True))
        self.assertEqual(analisar_telefone("+55 15 99999-0000"), ("5515999990000", True))
        self.assertEqual(analisar_telefone("(15) 3232-0001"), ("551532320001", False))
        self.assertEqual(analisar_telefone("0800 123 4567"), ("", False))
        self.assertEqual(analisar_telefone(""), ("", False))


class TestFluxoCompleto(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["PHARMALEADS_HOME"] = self.tmp.name
        (Path(self.tmp.name) / "locais.txt").write_text(
            "# comentário\nSorocaba, SP\nCampinas, SP\nsorocaba, sp\n", encoding="utf-8"
        )
        self.banco = Banco()

    def tearDown(self):
        self.banco.fechar()
        os.environ.pop("PHARMALEADS_HOME", None)
        self.tmp.cleanup()

    def test_sync_pendente_retem_lead_apos_falha_e_reenvia(self):
        caminho = Path(self.tmp.name) / 'um.csv'
        with caminho.open('w', encoding='utf-8', newline='') as f:
            w = csv.DictWriter(f, fieldnames=['cid','title','address','input_id','emails'])
            w.writeheader()
            w.writerow({'cid':'cid-1','title':'Farmácia exemplo','address':'Curitiba, PR',
                        'input_id':'varejo|Curitiba, PR','emails':'contato@farmacia.com.br'})
        self.assertEqual(self.banco.importar_csv(caminho), (1, 0))
        self.assertEqual(self.banco.con.execute('SELECT count(*) FROM sync_pendente').fetchone()[0], 1)
        cfg = {'SUPABASE_URL':'https://teste.supabase.co','SUPABASE_SECRET_KEY':'sb_secret_fake'}
        cliente = MagicMock()
        cliente.salvar.side_effect = ErroPharmaLeads('rede indisponível')
        with patch('pharmaleads.supabase.ler_configuracao', return_value=cfg), patch('pharmaleads.supabase.Supabase', return_value=cliente):
            with self.assertRaises(ErroPharmaLeads):
                self.banco.sincronizar_pendentes(obrigatorio=True)
            self.assertEqual(self.banco.con.execute('SELECT count(*) FROM sync_pendente').fetchone()[0], 1)
            cliente.salvar.side_effect = None
            self.assertEqual(self.banco.sincronizar_pendentes(obrigatorio=True), 1)
        self.assertEqual(self.banco.con.execute('SELECT count(*) FROM sync_pendente').fetchone()[0], 0)
        registro = cliente.salvar.call_args.args[0][0]
        self.assertEqual(registro['chave'], 'cid-1')
        self.assertIsInstance(registro['dados_brutos'], dict)

    def test_gerar_lotes(self):
        r = gerador.gerar_lotes(tamanho_lote=3)
        # 2 locais (repetido ignorado) x (3 termos varejo + 1 manipulação) = 8 buscas
        self.assertEqual((r["locais"], r["consultas"], r["lotes"]), (2, 8, 3))
        primeiro = sorted(config.pasta_consultas().glob("lote_*.txt"))[0].read_text(encoding="utf-8")
        self.assertIn("farmácia em Sorocaba, SP #!#varejo|Sorocaba, SP", primeiro)
        with self.assertRaises(ErroPharmaLeads):
            gerador.gerar_lotes()  # já existem lotes, exige --recriar
        gerador.gerar_lotes(recriar=True, segmentos=["distribuidoras"])
        with self.assertRaises(ErroPharmaLeads):
            gerador.gerar_lotes(recriar=True, segmentos=["inexistente"])

    def test_coleta_deduplica_retoma_e_exporta(self):
        gerador.gerar_lotes(tamanho_lote=4)  # 2 lotes
        r = processar(self.banco, opcoes(limite=1), log=lambda *_: None)
        self.assertEqual(r, {"concluidos": 1, "falhas": 0})
        self.assertEqual(self.banco.resumo()["total"], 3)  # só Sorocaba (lote 1)

        # Segunda rodada retoma apenas o lote que faltava.
        r = processar(self.banco, opcoes(), log=lambda *_: None)
        self.assertEqual(r, {"concluidos": 1, "falhas": 0})
        res = self.banco.resumo()
        self.assertEqual(res["total"], 6)  # 2 cidades x 3 lugares; repetidos não duplicam
        self.assertEqual(res["situacao"]["fechada_temporariamente"], 2)
        self.assertEqual(res["situacao"]["fechada"], 2)
        self.assertEqual(res["situacao"]["ativa_ou_desconhecida"], 2)
        self.assertEqual(res["com_celular"], 2)
        self.assertEqual(res["com_email"], 0)
        self.assertEqual(res["segmento"], {"varejo": 6})  # segmento do primeiro achado

        # Terceira rodada não faz nada: tudo concluído.
        r = processar(self.banco, opcoes(), log=lambda *_: None)
        self.assertEqual(r, {"concluidos": 0, "falhas": 0})

        destino = Path(self.tmp.name) / "leads.csv"
        self.assertEqual(self.banco.exportar(destino, ativas=True, com_celular=True), 2)
        with open(destino, newline="", encoding="utf-8-sig") as f:
            linhas = list(csv.DictReader(f))
        self.assertEqual(linhas[0]["whatsapp_link"], "https://wa.me/5515999990000")
        self.assertEqual(linhas[0]["local_busca"] in ("Sorocaba, SP", "Campinas, SP"), True)
        self.assertEqual(self.banco.exportar(destino, com_email=True), 0)
        self.assertEqual(self.banco.exportar(destino, segmento="varejo"), 6)

    def test_emails_so_com_flag(self):
        gerador.gerar_lotes(tamanho_lote=50)
        processar(self.banco, opcoes(emails=True), log=lambda *_: None)
        self.assertEqual(self.banco.resumo()["com_email"], 2)

    def test_falha_no_envio_retoma_csv_sem_refazer_buscas(self):
        gerador.gerar_lotes(tamanho_lote=50)
        with patch.object(self.banco, 'importar_csv', side_effect=ErroPharmaLeads('offline')):
            with self.assertRaises(ErroPharmaLeads):
                processar(self.banco, opcoes(), log=lambda *_: None)
        nome = next(config.pasta_consultas().glob('lote_*.txt')).name
        self.assertTrue(self.banco.resultado_pendente(nome).is_file())
        # Reabre o banco para demonstrar que o estado sobrevive ao processo.
        self.banco.fechar()
        self.banco = Banco()
        with patch('pharmaleads.coletor.rodar_lote', side_effect=AssertionError('não deve coletar')):
            resultado = processar(self.banco, opcoes(), log=lambda *_: None)
        self.assertEqual(resultado['concluidos'], 1)
        self.assertIsNone(self.banco.resultado_pendente(nome))

    def test_reimportar_preserva_contatos_e_primeira_coleta(self):
        gerador.gerar_lotes(tamanho_lote=50)
        processar(self.banco, opcoes(emails=True), log=lambda *_: None)
        arquivo = next(config.pasta_resultados().glob('*.csv'))
        antes = {r['chave']: (r['emails'], r['primeira_coleta']) for r in self.banco.con.execute('SELECT chave, emails, primeira_coleta FROM lugares')}
        with arquivo.open(encoding='utf-8', newline='') as f:
            leitor = csv.DictReader(f)
            colunas, linhas = leitor.fieldnames, list(leitor)
        for linha in linhas:
            linha.update(phone='', website='', emails='')
        with arquivo.open('w', encoding='utf-8', newline='') as f:
            escritor = csv.DictWriter(f, fieldnames=colunas)
            escritor.writeheader()
            escritor.writerows(linhas)
        self.assertEqual(self.banco.importar_csv(arquivo)[0], 0)
        self.assertEqual(antes, {r['chave']: (r['emails'], r['primeira_coleta']) for r in self.banco.con.execute('SELECT chave, emails, primeira_coleta FROM lugares')})
        self.assertEqual(self.banco.resumo()['com_celular'], 2)

    def test_falha_e_refazer(self):
        gerador.gerar_lotes(tamanho_lote=50)
        quebrado = opcoes(bin=[sys.executable, "-c", "import sys; sys.exit(3)"])
        r = processar(self.banco, quebrado, log=lambda *_: None)
        self.assertEqual(r, {"concluidos": 0, "falhas": 1})
        # Desistiu do lote: nova rodada normal o ignora...
        self.assertEqual(processar(self.banco, opcoes(), log=lambda *_: None), {"concluidos": 0, "falhas": 0})
        # ...mas --refazer-falhas tenta de novo.
        r = processar(self.banco, opcoes(refazer_falhas=True), log=lambda *_: None)
        self.assertEqual(r, {"concluidos": 1, "falhas": 0})

    def test_gosom_inexistente_nao_derruba(self):
        gerador.gerar_lotes(tamanho_lote=50)
        r = processar(self.banco, opcoes(bin=["/nao/existe/gosom"]), log=lambda *_: None)
        self.assertEqual(r["falhas"], 1)

    def test_verificar_gosom(self):
        self.assertEqual(verificar_gosom(FALSO), [])
        with self.assertRaises(ErroPharmaLeads):
            verificar_gosom([sys.executable, "-c", "print('outro programa')"])

    def test_comando_inclui_opcoes(self):
        cmd = montar_comando(opcoes(emails=True, proxies="http://p:1"), Path("a.txt"), Path("b.csv"))
        for trecho in ("-input", "-results", "-email", "-proxies", "-exit-on-inactivity"):
            self.assertIn(trecho, cmd)


if __name__ == "__main__":
    unittest.main()
