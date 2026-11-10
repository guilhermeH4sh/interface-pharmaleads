"""
Leads e controle de coletas no SQLite local.
"""
from __future__ import annotations

import csv
import json
import sqlite3
import re
import sys
from itertools import islice
from datetime import datetime, timezone
from pathlib import Path

from . import config
from .config import ErroPharmaLeads

# Campos do resultado do gosom que ocupam muito espaço e não precisamos guardar.
CAMPOS_PESADOS = {
    "user_reviews", "user_reviews_extended", "images", "about", "popular_times",
    "reviews_per_rating", "descriptions", "thumbnail", "street_view_url",
}

COLUNAS_LUGARES = [
    "chave", "nome", "segmento", "categoria", "endereco", "local_busca",
    "telefone", "telefone_normalizado", "celular", "whatsapp_link",
    "site", "emails", "score_contato",
    "latitude", "longitude", "avaliacao", "qtd_avaliacoes",
    "status_maps", "situacao", "link", "dados_brutos",
    "primeira_coleta", "ultima_coleta",
]

COLUNAS_EXPORTACAO = [
    "nome", "segmento", "categoria", "endereco", "local_busca",
    "telefone", "telefone_normalizado", "whatsapp_link", "site", "emails",
    "score_contato", "situacao", "status_maps", "avaliacao", "qtd_avaliacoes",
    "latitude", "longitude", "link", "primeira_coleta", "ultima_coleta",
]


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def pegar(linha: dict, *nomes: str) -> str:
    """Devolve o primeiro campo preenchido entre os nomes dados (ou texto vazio)."""
    for nome in nomes:
        valor = (linha.get(nome) or "").strip()
        if valor and valor not in ('null', '[]'):
            return valor
    return ""


def classificar_situacao(status: str) -> str:
    """
    Converte o status que o gosom traz do Maps numa classificação simples.
    Atenção: vazio NÃO prova que a farmácia está aberta; por isso o nome
    "ativa_ou_desconhecida".
    """
    s = (status or "").lower()
    if "permanent" in s:
        return "fechada_permanentemente"
    if "temporar" in s:
        return "fechada_temporariamente"
    if s == "closed" or "fechad" in s:
        return "fechada"  # o Maps indicou fechada, sem dizer se é definitivo
    return "ativa_ou_desconhecida"


def analisar_telefone(texto: str) -> tuple[str, bool]:
    """
    Devolve (telefone só com números e DDI 55, é_celular).
    Celular brasileiro = DDD + 9 dígitos começando com 9 (provável WhatsApp).
    """
    d = re.sub(r"\D", "", texto or "")
    if d.startswith("55") and len(d) in (12, 13):
        d = d[2:]
    if len(d) not in (10, 11) or d.startswith("0"):
        return "", False
    return "55" + d, len(d) == 11 and d[2] == "9"




class Banco:
    def __init__(self, caminho=None):
        self.caminho = Path(caminho) if caminho else config.pasta_dados() / "interface_pharmaleads.db"
        self.caminho.parent.mkdir(parents=True, exist_ok=True)
        self.con = sqlite3.connect(self.caminho, timeout=30)
        self.con.row_factory = sqlite3.Row
        self.con.execute("PRAGMA busy_timeout=30000")
        self.con.execute("PRAGMA journal_mode=WAL")
        cols = ", ".join(f"{c} {'INTEGER' if c in ('celular', 'score_contato') else 'TEXT'}" + (" PRIMARY KEY" if c == "chave" else "") for c in COLUNAS_LUGARES)
        self.con.execute(f"CREATE TABLE IF NOT EXISTS lugares ({cols})")
        self.con.execute("CREATE TABLE IF NOT EXISTS lotes (nome TEXT PRIMARY KEY, estado TEXT NOT NULL, tentativas INTEGER DEFAULT 0, erro TEXT, atualizado_em TEXT, csv_pendente TEXT)")
        if 'csv_pendente' not in {r[1] for r in self.con.execute('PRAGMA table_info(lotes)')}:
            self.con.execute('ALTER TABLE lotes ADD COLUMN csv_pendente TEXT')
        self.con.executescript("""
        CREATE TABLE IF NOT EXISTS execucoes (id INTEGER PRIMARY KEY AUTOINCREMENT, estado TEXT NOT NULL, criado_em TEXT NOT NULL, terminado_em TEXT, total INTEGER NOT NULL, concluidas INTEGER NOT NULL DEFAULT 0, falhas INTEGER NOT NULL DEFAULT 0, erro TEXT, profundidade INTEGER NOT NULL, emails INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS consultas (id INTEGER PRIMARY KEY AUTOINCREMENT, execucao_id INTEGER NOT NULL REFERENCES execucoes(id), texto TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'pendente', tentativas INTEGER NOT NULL DEFAULT 0, erro TEXT);
        CREATE INDEX IF NOT EXISTS consultas_execucao ON consultas(execucao_id, estado);
        CREATE TABLE IF NOT EXISTS sync_pendente (chave TEXT PRIMARY KEY);
        """)
        self.ultimas_chaves_novas: list[str] = []
        self.con.commit()

    def fechar(self): self.con.close()
    def verificar(self): self.con.execute('SELECT 1 FROM lugares LIMIT 1')
    def estado_lote(self, nome):
        r=self.con.execute('SELECT estado,tentativas FROM lotes WHERE nome=?',(nome,)).fetchone()
        return (r['estado'],r['tentativas']) if r else ('pendente',0)
    def marcar_lote(self, nome, estado, tentativas, erro=''):
        self.con.execute("INSERT INTO lotes(nome,estado,tentativas,erro,atualizado_em) VALUES(?,?,?,?,?) ON CONFLICT(nome) DO UPDATE SET estado=excluded.estado,tentativas=excluded.tentativas,erro=excluded.erro,atualizado_em=excluded.atualizado_em,csv_pendente=CASE WHEN excluded.estado='concluido' THEN NULL ELSE lotes.csv_pendente END",(nome,estado,tentativas,erro,_agora()))
        self.con.commit()
    def registrar_resultado(self, nome, arquivo):
        self.con.execute("INSERT INTO lotes(nome,estado,tentativas,csv_pendente) VALUES(?,'pendente',0,?) ON CONFLICT(nome) DO UPDATE SET csv_pendente=excluded.csv_pendente",(nome,str(arquivo.resolve())))
        self.con.commit()
    def resultado_pendente(self,nome):
        r=self.con.execute('SELECT csv_pendente FROM lotes WHERE nome=?',(nome,)).fetchone()
        return Path(r[0]) if r and r[0] else None
    def reabrir_falhas(self):
        self.con.execute("UPDATE lotes SET estado='pendente',tentativas=0 WHERE estado='falhou'"); self.con.commit()

    def importar_csv(self, caminho, *, sincronizar=True):
        novos=existentes=0; agora=_agora(); novas_chaves=[]; csv.field_size_limit(20*1024*1024)
        with open(caminho,encoding='utf-8-sig',newline='') as f:
            leitor=csv.DictReader(f)
            if not leitor.fieldnames or not {'title','name'}.intersection(leitor.fieldnames):
                raise ErroPharmaLeads('CSV vazio ou sem cabeçalho do Gosom.')
            with self.con:
                for linha in leitor:
                    if None in linha or any(v is None for v in linha.values()): raise ErroPharmaLeads('CSV incompleto ou inválido.')
                    nome=pegar(linha,'title','name'); endereco=pegar(linha,'address')
                    chave=pegar(linha,'cid','place_id','data_id','link') or f'{nome}|{endereco}'.lower()
                    if not chave.strip('|'): continue
                    anterior=self.con.execute('SELECT * FROM lugares WHERE chave=?',(chave,)).fetchone()
                    ant=dict(anterior) if anterior else {}
                    rotulo=pegar(linha,'input_id'); segmento,local=rotulo.split('|',1) if '|' in rotulo else ('','')
                    telefone=pegar(linha,'phone') or ant.get('telefone') or ''
                    site=pegar(linha,'website') or ant.get('site') or ''
                    emails=pegar(linha,'emails','email') or ant.get('emails') or ''
                    normalizado,celular=analisar_telefone(telefone); status=pegar(linha,'status')
                    registro=dict(chave=chave,nome=nome,segmento=ant.get('segmento') or segmento,categoria=pegar(linha,'category'),endereco=endereco,local_busca=ant.get('local_busca') or local,telefone=telefone,telefone_normalizado=normalizado,celular=int(celular),whatsapp_link=f'https://wa.me/{normalizado}' if celular else '',site=site,emails=emails,score_contato=sum(bool(x) for x in (telefone,site,emails)),latitude=pegar(linha,'latitude'),longitude=pegar(linha,'longitude','longtitude'),avaliacao=pegar(linha,'review_rating'),qtd_avaliacoes=pegar(linha,'review_count'),status_maps=status,situacao=classificar_situacao(status),link=pegar(linha,'link'),dados_brutos=json.dumps({k:v for k,v in linha.items() if k not in CAMPOS_PESADOS and v},ensure_ascii=False),primeira_coleta=ant.get('primeira_coleta') or agora,ultima_coleta=agora)
                    cols=','.join(COLUNAS_LUGARES); params=','.join(':'+c for c in COLUNAS_LUGARES)
                    self.con.execute(f'INSERT OR REPLACE INTO lugares ({cols}) VALUES ({params})',registro)
                    self.con.execute('INSERT OR IGNORE INTO sync_pendente(chave) VALUES(?)',(chave,))
                    if anterior: existentes+=1
                    else:
                        novos+=1
                        novas_chaves.append(chave)
        self.ultimas_chaves_novas = novas_chaves
        if sincronizar:
            try:
                self.sincronizar_pendentes()
            except ErroPharmaLeads as exc:
                print(f'Aviso: {exc} Os leads permanecem na fila de sincronização local.', file=sys.stderr)
        return novos,existentes

    def candidatos_enriquecimento(self, chaves, limite=100):
        """Leads novos sem e-mail e com site público para enriquecimento."""
        chaves = list(dict.fromkeys(chaves))
        if not chaves:
            return []
        marcadores = ','.join('?' for _ in chaves)
        from .enriquecedor import emails_publicos
        candidatos = [dict(r) for r in self.con.execute(
            f"SELECT chave,site,emails FROM lugares WHERE chave IN ({marcadores}) AND site<>''", chaves)]
        return [r for r in candidatos if not emails_publicos(r['emails'])][:limite]

    def registrar_enriquecimento(self, contato):
        """Mescla contatos públicos extraídos do site e agenda o upsert no Supabase."""
        atual = self.con.execute('SELECT * FROM lugares WHERE chave=?', (contato.chave,)).fetchone()
        if not atual:
            return False
        antigo = dict(atual)
        emails = [x.strip() for x in antigo['emails'].split(',') if x.strip()]
        for email in contato.emails:
            if email not in emails:
                emails.append(email)
        novo_email = ', '.join(emails)
        novo_whatsapp = antigo['whatsapp_link'] or contato.whatsapp_link
        if novo_email == antigo['emails'] and novo_whatsapp == antigo['whatsapp_link'] and not contato.redes_sociais:
            return False
        try:
            brutos = json.loads(antigo['dados_brutos'] or '{}')
        except (TypeError, ValueError):
            brutos = {}
        brutos['enriquecimento_site'] = {
            'emails': list(contato.emails), 'whatsapp_link': contato.whatsapp_link,
            'redes_sociais': contato.redes_sociais, 'verificado_em': _agora(),
        }
        score = sum(bool(x) for x in (antigo['telefone'], antigo['site'], novo_email))
        with self.con:
            self.con.execute('UPDATE lugares SET emails=?,whatsapp_link=?,score_contato=?,dados_brutos=? WHERE chave=?',
                             (novo_email, novo_whatsapp, score, json.dumps(brutos, ensure_ascii=False), contato.chave))
            self.con.execute('INSERT OR IGNORE INTO sync_pendente(chave) VALUES(?)', (contato.chave,))
        return True

    def sincronizar_pendentes(self, obrigatorio=False, *, ao_enviar=None):
        """Envia para public.pharmaleads, em lotes idempotentes, quando há login local."""
        from .supabase import Supabase, ler_configuracao
        cfg = ler_configuracao()
        if not (cfg['SUPABASE_URL'] and
                (cfg['SUPABASE_SECRET_KEY'] or all(cfg[k] for k in
                 ('SUPABASE_PUBLISHABLE_KEY','SUPABASE_EMAIL','SUPABASE_PASSWORD','SUPABASE_USER_ID')))):
            if obrigatorio:
                raise ErroPharmaLeads('Configure o login Supabase no .env antes de sincronizar.')
            return 0
        cliente = Supabase()
        enviados = 0
        while True:
            chaves = [r[0] for r in self.con.execute('SELECT chave FROM sync_pendente ORDER BY chave LIMIT 100')]
            if not chaves: return enviados
            placeholders = ','.join('?' for _ in chaves)
            registros = [dict(r) for r in self.con.execute(f'SELECT * FROM lugares WHERE chave IN ({placeholders})',chaves)]
            for registro in registros:
                try: registro['dados_brutos'] = json.loads(registro['dados_brutos'] or '{}')
                except (TypeError, ValueError): registro['dados_brutos'] = {}
            from .enriquecedor import emails_publicos
            registros = [r for r in registros if emails_publicos(r.get('emails'))]
            if registros:
                cliente.salvar(registros)
            with self.con:
                self.con.executemany('DELETE FROM sync_pendente WHERE chave=?',[(chave,) for chave in chaves])
            enviados += len(registros)
            if ao_enviar and registros:
                ao_enviar(len(registros))

    def resumo(self):
        def unico(sql): return self.con.execute(sql).fetchone()[0]
        def agrupar(campo): return {r[0] or '(sem valor)':r[1] for r in self.con.execute(f'SELECT {campo},count(*) FROM lugares GROUP BY {campo}')}
        from collections import Counter
        return {'lotes':dict(Counter(self.estado_lote(p.name)[0] for p in config.pasta_consultas().glob('lote_*.txt'))), 'total':unico('SELECT count(*) FROM lugares'), 'situacao':agrupar('situacao'),'segmento':agrupar('segmento'),'com_telefone':unico("SELECT count(*) FROM lugares WHERE telefone <> ''"),'com_celular':unico('SELECT count(*) FROM lugares WHERE celular=1'),'com_site':unico("SELECT count(*) FROM lugares WHERE site <> ''"),'com_email':unico("SELECT count(*) FROM lugares WHERE emails <> ''")}

    def exportar(self,destino,ativas=False,com_email=False,com_telefone=False,com_celular=False,segmento=None):
        cond=[]; args=[]
        if ativas: cond.append("situacao='ativa_ou_desconhecida'")
        if com_email: cond.append("emails<>''")
        if com_telefone: cond.append("telefone<>''")
        if com_celular: cond.append('celular=1')
        if segmento: cond.append('segmento=?'); args.append(segmento)
        sql='SELECT '+','.join(COLUNAS_EXPORTACAO)+' FROM lugares'+(' WHERE '+' AND '.join(cond) if cond else '')+' ORDER BY score_contato DESC,nome'
        rows=self.con.execute(sql,args).fetchall()
        with open(destino,'w',newline='',encoding='utf-8-sig') as f:
            w=csv.writer(f); w.writerow(COLUNAS_EXPORTACAO); w.writerows(rows)
        return len(rows)
