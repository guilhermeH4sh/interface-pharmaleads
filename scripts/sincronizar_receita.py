"""Integra cadastros da Receita por UF à carteira do PharmaLeads."""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sqlite3
from collections import Counter, defaultdict
from contextlib import closing
from pathlib import Path
from zipfile import ZipFile

from pharmaleads.banco import analisar_telefone
from pharmaleads.config import SEGMENTOS, ErroPharmaLeads
from pharmaleads.enriquecedor import emails_publicos
from pharmaleads.supabase import Supabase
from scripts.importar_receita_uf import TODAS, UFS
from scripts.revisar_cnpj_candidatos import normalizar, numero_lead


FONTE = 'Receita Federal'
CNAE_SEGMENTOS = {
    '4771701': 'varejo', '4771702': 'manipulacao', '4771703': 'homeopatia',
    '4771704': 'veterinaria', '4644301': 'distribuidoras', '4644302': 'distribuidoras',
}
CEP = re.compile(r'(?<!\d)(\d{5})-?(\d{3})(?!\d)')
TAMANHO_LOTE = 400


def municipios_receita(caminho):
    with ZipFile(caminho) as zip_file:
        arquivos = [item for item in zip_file.infolist() if not item.is_dir()]
        if len(arquivos) != 1 or not arquivos[0].filename.upper().endswith('.MUNICCSV'):
            raise ErroPharmaLeads('Use o arquivo Municipios.zip da Receita Federal.')
        with io.TextIOWrapper(zip_file.open(arquivos[0]), encoding='latin-1', newline='') as arquivo:
            return dict(csv.reader(arquivo, delimiter=';', strict=True))


def cnpj_lead(lead):
    dados = lead.get('dados_brutos') or {}
    return re.sub(r'[^0-9A-Z]', '', str(dados.get('cnpj') or '').upper())


def cep_lead(lead):
    cep = CEP.search(lead.get('endereco') or '')
    return ''.join(cep.groups()) if cep else ''


def telefones(valores):
    return {normalizado for valor in valores if (normalizado := analisar_telefone(valor)[0])}


class IndiceLeads:
    def __init__(self, leads):
        self.cnpj = defaultdict(dict)
        self.nome = defaultdict(dict)
        self.telefone = defaultdict(dict)
        self.endereco = defaultdict(dict)
        self.por_chave = {}
        for lead in leads:
            self.adicionar(lead)

    def adicionar(self, lead):
        chave = lead['chave']
        if anterior := self.por_chave.get(chave):
            self.nome[normalizar(anterior.get('nome') or '')].pop(chave, None)
            for telefone in telefones([anterior.get('telefone'), anterior.get('telefone_normalizado')]):
                self.telefone[telefone].pop(chave, None)
        self.por_chave[chave] = lead
        if cnpj := cnpj_lead(lead):
            self.cnpj[cnpj][chave] = lead
        else:
            # CNPJ diferente só entra em revisão quando o endereço coincide.
            # O índice de CEP e número já encontra esses casos, inclusive em redes.
            self.nome[normalizar(lead.get('nome') or '')][chave] = lead
            for telefone in telefones([lead.get('telefone'), lead.get('telefone_normalizado')]):
                self.telefone[telefone][chave] = lead
        cep = cep_lead(lead)
        numero = numero_lead(lead.get('nome') or '', lead.get('endereco') or '')
        if cep and numero:
            self.endereco[cep, numero][chave] = lead

    def encontrar(self, cadastro, municipio):
        cnpj = cadastro['cnpj']
        exatos = self.cnpj.get(cnpj, {})
        if exatos:
            return (next(iter(exatos.values())), 'cnpj_exato') if len(exatos) == 1 else (None, 'revisar')
        nome = normalizar(cadastro['nome_fantasia'])
        fones = telefones(cadastro['telefones'])
        cep = cadastro['cep']
        numero = str(int(cadastro['numero'])) if cadastro['numero'].isdecimal() else ''
        candidatos = dict(self.endereco.get((cep, numero), {}))
        if nome:
            candidatos.update(self.nome.get(nome, {}))
        for telefone in fones:
            candidatos.update(self.telefone.get(telefone, {}))
        rua = normalizar(cadastro['logradouro'])
        local = normalizar(f"{municipio}, {cadastro['uf']}")
        fortes, possiveis = [], []
        for lead in candidatos.values():
            endereco = lead.get('endereco') or ''
            mesmo_nome = bool(nome) and nome == normalizar(lead.get('nome') or '')
            mesmo_cep = bool(cep) and cep == cep_lead(lead)
            mesmo_fone = bool(fones & telefones([lead.get('telefone'), lead.get('telefone_normalizado')]))
            mesma_rua = len(rua) >= 6 and f' {rua} ' in f' {normalizar(endereco)} '
            mesmo_numero = bool(numero) and numero == numero_lead(lead.get('nome') or '', endereco)
            endereco_exato = mesmo_cep and mesma_rua and mesmo_numero
            if cnpj_lead(lead):
                if mesmo_nome and endereco_exato:
                    possiveis.append(lead)
                continue
            if mesmo_nome and (endereco_exato or (mesmo_fone and mesmo_cep)):
                fortes.append(lead)
            if endereco_exato or mesmo_fone or (mesmo_nome and (
                mesmo_cep or normalizar(lead.get('local_busca') or '') == local
                or f' {local} ' in f' {normalizar(endereco)} '
            )):
                possiveis.append(lead)
        if len(fortes) == 1 and not any(cnpj_lead(item) for item in possiveis):
            return fortes[0], 'nome_e_endereco'
        return None, 'revisar' if possiveis else 'novo'


def dados_receita(cadastro, codigo, municipio, criterio):
    return {
        'cnpj': cadastro['cnpj'], 'cnpj_origem': FONTE, 'cnpj_confianca': criterio,
        'receita_federal': cadastro,
        'ibge': {'codigo_municipio': codigo, 'municipio': municipio, 'uf': cadastro['uf']},
    }


def novo_lead(cadastro, codigo, municipio):
    telefone = next((valor for valor in cadastro['telefones'] if analisar_telefone(valor)[0]), '')
    normalizado, celular = analisar_telefone(telefone)
    segmento = CNAE_SEGMENTOS.get(cadastro['cnae_principal']) or CNAE_SEGMENTOS[cadastro['cnaes_correspondentes'][0]]
    local = f"{municipio}, {cadastro['uf']}"
    rua = ' '.join(filter(None, (cadastro['tipo_logradouro'], cadastro['logradouro'])))
    endereco = ', '.join(filter(None, (rua, cadastro['numero'], cadastro['bairro'], local, cadastro['cep'])))
    return {
        'chave': f"receita:{cadastro['cnpj']}", 'nome': cadastro['nome_fantasia'], 'segmento': segmento,
        'categoria': SEGMENTOS[segmento]['descricao'],
        'endereco': endereco, 'local_busca': local, 'telefone': telefone,
        'telefone_normalizado': normalizado, 'celular': int(celular),
        'emails': ', '.join(emails_publicos(cadastro['email'])),
        'situacao': 'ativa_ou_desconhecida', 'crm_included': False,
        'primeira_coleta': cadastro['importado_em'], 'ultima_coleta': cadastro['importado_em'],
        'dados_brutos': {**dados_receita(cadastro, codigo, municipio, 'cnpj_da_fonte'), 'fonte_dados': FONTE},
    }


def sincronizar(con, cliente, municipios, uf, competencia, aplicar=False, limite=None):
    ibge = defaultdict(list)
    for codigo, nome, sigla in con.execute(
        "SELECT codigo,nome,uf FROM ibge_localidades WHERE tipo='municipio' AND (? = 'TODAS' OR uf=?)", (uf, uf)
    ):
        ibge[sigla, normalizar(nome)].append((codigo, nome))
    if not ibge:
        raise ErroPharmaLeads('Atualize o cache do IBGE antes de sincronizar.')
    cadastros = con.execute(
        "SELECT cadastro FROM receita_estabelecimentos WHERE competencia=? AND (? = 'TODAS' OR uf=?) ORDER BY cnpj",
        (competencia, uf, uf),
    )
    contagem = Counter()
    indice = IndiceLeads(cliente.listar_referencia_receita())
    novos, enriquecimentos = [], []
    for (registro,) in cadastros:
        cadastro = json.loads(registro)
        cidade = municipios.get(cadastro['codigo_municipio_receita'])
        confirmados = ibge.get((cadastro['uf'], normalizar(cidade or '')), [])
        if len(confirmados) != 1:
            contagem['municipio_sem_correspondencia'] += 1
            continue
        codigo, municipio = confirmados[0]
        lead, criterio = indice.encontrar(cadastro, municipio)
        if lead:
            anterior = lead.get('dados_brutos') or {}
            if (anterior.get('receita_federal') or {}).get('competencia', '') > competencia:
                contagem['cadastro_mais_recente'] += 1
                continue
            atualizado = {**anterior, **dados_receita(cadastro, codigo, municipio, criterio)}
            atualizado['cnpj_confianca'] = anterior.get('cnpj_confianca') or criterio
            atualizado['cnpj_origem'] = anterior.get('cnpj_origem') or FONTE
            if atualizado == anterior:
                contagem['ja_integrado'] += 1
                continue
            indice.adicionar({**lead, 'dados_brutos': atualizado})
            enriquecimentos.append((lead['chave'], anterior, atualizado))
        elif criterio == 'revisar':
            contagem['revisao'] += 1
        elif not cadastro['nome_fantasia'].strip():
            contagem['sem_nome'] += 1
        elif limite is None or len(novos) < limite:
            novo = novo_lead(cadastro, codigo, municipio)
            novos.append(novo)
            indice.adicionar(novo)
        else:
            contagem['fora_do_limite'] += 1
    if aplicar:
        for i in range(0, len(novos), TAMANHO_LOTE):
            lote = novos[i:i + TAMANHO_LOTE]
            inseridos = cliente.inserir_receita(lote)
            contagem['inseridos'] += inseridos
            contagem['chaves_ja_existentes'] += len(lote) - inseridos
        for chave, anterior, atualizado in enriquecimentos:
            campo = ('enriquecidos' if cliente.atualizar_dados_receita(chave, anterior, atualizado)
                     else 'alterado_concorrentemente')
            contagem[campo] += 1
    else:
        if enriquecimentos:
            contagem['a_enriquecer'] = len(enriquecimentos)
        contagem['a_inserir'] = len(novos)
        contagem['a_inserir_sem_email'] = sum(not registro['emails'] for registro in novos)
    return dict(contagem)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--banco', required=True, type=Path)
    parser.add_argument('--municipios', required=True, type=Path)
    parser.add_argument('--uf', required=True, type=str.upper, choices=[*UFS, TODAS])
    parser.add_argument('--competencia', required=True)
    parser.add_argument('--aplicar', action='store_true', help='Grava em public.pharmaleads')
    parser.add_argument('--limite-novos', type=int, help='Limite de novos registros para um piloto')
    args = parser.parse_args()
    if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', args.competencia):
        parser.error('Use a competência no formato AAAA-MM.')
    if args.limite_novos is not None and args.limite_novos < 0:
        parser.error('Use um limite maior ou igual a zero.')
    try:
        with closing(sqlite3.connect(args.banco.resolve().as_uri() + '?mode=ro', uri=True)) as con:
            resumo = sincronizar(con, Supabase(), municipios_receita(args.municipios), args.uf,
                                 args.competencia, args.aplicar, args.limite_novos)
        print(json.dumps({'uf': args.uf, 'competencia': args.competencia, **resumo}))
    except (ErroPharmaLeads, OSError, sqlite3.Error, ValueError) as exc:
        parser.exit(1, f'{exc}\n')


if __name__ == '__main__':
    main()
