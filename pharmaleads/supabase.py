"""Cliente REST restrito a public.pharmaleads; somente leitura e upsert."""
from __future__ import annotations

import base64
import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

from . import config
from .config import ErroPharmaLeads


def ler_configuracao() -> dict:
    valores = {}
    arquivo = config.raiz() / '.env'
    if arquivo.exists():
        for linha in arquivo.read_text(encoding='utf-8-sig').splitlines():
            linha = linha.strip()
            if linha and not linha.startswith('#') and '=' in linha:
                chave, valor = linha.split('=', 1)
                valor = valor.strip()
                try:
                    valores[chave.strip()] = json.loads(valor) if valor.startswith(chr(34)) else valor.strip(chr(39))
                except ValueError:
                    raise ErroPharmaLeads('Configuração .env inválida. Rode configurar-supabase novamente.') from None
    nomes = ('SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_AUTH_MODE',
             'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_EMAIL', 'SUPABASE_PASSWORD', 'SUPABASE_USER_ID')
    return {k: os.environ.get(k, valores.get(k, '')) for k in nomes}


def configuracao() -> tuple[str, str]:
    valores = ler_configuracao()
    return valores['SUPABASE_URL'].strip(), valores['SUPABASE_SECRET_KEY'].strip()


class SemRedirecionamento(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Não encaminha a chave de servidor para outra URL.


class Supabase:
    def __init__(self, url: str | None = None, segredo: str | None = None, *,
                 publica=None, email=None, senha=None, uid=None):
        valores = ler_configuracao()
        url = (url if url is not None else valores['SUPABASE_URL']).rstrip('/')
        self.modo_usuario = publica is not None or (segredo is None and valores['SUPABASE_AUTH_MODE'] == 'user')
        self.segredo = segredo if segredo is not None else valores['SUPABASE_SECRET_KEY']
        partes = urlsplit(url)
        if (partes.scheme != 'https' or not partes.hostname
                or not partes.hostname.endswith('.supabase.co')
                or partes.username or partes.password or partes.path or partes.query or partes.fragment):
            raise ErroPharmaLeads('Configure SUPABASE_URL com a URL HTTPS do projeto no arquivo .env.')
        if self.modo_usuario:
            self.segredo = publica if publica is not None else valores['SUPABASE_PUBLISHABLE_KEY']
            self.email = email if email is not None else valores['SUPABASE_EMAIL']
            self.senha = senha if senha is not None else valores['SUPABASE_PASSWORD']
            self.uid = uid if uid is not None else valores['SUPABASE_USER_ID']
            if not self.segredo.startswith('sb_publishable_') or not all((self.email, self.senha, self.uid)):
                raise ErroPharmaLeads('Configure chave pública, e-mail, senha e UID com: python -m pharmaleads configurar-supabase')
            self.token = self.refresh_token = ''
            self.expira = 0
        elif not self.segredo.startswith('sb_secret_'):
            try:
                conteudo = self.segredo.split('.')[1]
                role = json.loads(base64.urlsafe_b64decode(conteudo + '=' * (-len(conteudo) % 4)))['role']
            except (IndexError, ValueError, KeyError, TypeError):
                role = ''
            if role != 'service_role':
                raise ErroPharmaLeads('Configure uma chave de servidor em SUPABASE_SECRET_KEY. Rode: python -m pharmaleads configurar-supabase')
        self.endpoint = url + '/rest/v1/pharmaleads'
        self.auth_endpoint = url + '/auth/v1/token'
        self.opener = build_opener(SemRedirecionamento())

    def _autenticar(self):
        if self.token and time.monotonic() < self.expira:
            return
        grant = 'refresh_token' if self.refresh_token else 'password'
        dados = {'refresh_token': self.refresh_token} if self.refresh_token else {
            'email': self.email, 'password': self.senha}
        req = Request(self.auth_endpoint + '?' + urlencode({'grant_type': grant}),
            data=json.dumps(dados).encode('utf-8'), method='POST',
            headers={'apikey': self.segredo, 'Content-Type': 'application/json'})
        try:
            with self.opener.open(req, timeout=60) as resposta:
                sessao = json.loads(resposta.read())
            if sessao.get('user', {}).get('id') != self.uid:
                raise ErroPharmaLeads('O login pertence a outro UID. Use o usuário autorizado em pharmaleads.')
            token, refresh = sessao['access_token'], sessao['refresh_token']
            ttl = float(sessao['expires_in'])
            if not token or not refresh or ttl <= 0:
                raise ValueError()
            self.token, self.refresh_token = token, refresh
            self.expira = time.monotonic() + max(1, ttl - min(60, ttl / 2))
        except HTTPError as erro:
            raise ErroPharmaLeads(f'Login/renovação Supabase falhou (HTTP {erro.code}). Confira e-mail, senha, confirmação do usuário e se o login por senha está habilitado.') from None
        except (URLError, OSError, ValueError, KeyError, TypeError):
            raise ErroPharmaLeads('Não foi possível autenticar no Supabase. Confira a conexão e a configuração local.') from None

    def _requisicao(self, metodo='GET', parametros=None, dados=None, *, prefer=None):
        url = self.endpoint + ('?' + urlencode(parametros) if parametros else '')
        headers = {'apikey': self.segredo, 'Accept': 'application/json', 'Accept-Profile': 'public'}
        if self.modo_usuario:
            self._autenticar()
            headers['Authorization'] = 'Bearer ' + self.token
        elif not self.segredo.startswith('sb_secret_'):
            headers['Authorization'] = 'Bearer ' + self.segredo
        corpo = None
        if dados is not None:
            corpo = json.dumps(dados, ensure_ascii=False, allow_nan=False).encode('utf-8')
            headers.update({'Content-Type': 'application/json', 'Content-Profile': 'public',
                            'Prefer': prefer or 'resolution=merge-duplicates,return=minimal'})
        req = Request(url, data=corpo, headers=headers, method=metodo)
        try:
            with self.opener.open(req, timeout=60) as resposta:
                texto = resposta.read()
                return json.loads(texto) if texto else []
        except HTTPError as erro:
            # Respostas do servidor podem conter dados privados. Só exibe o status.
            raise ErroPharmaLeads(f'Supabase respondeu HTTP {erro.code}. Confira a chave/JWT, as permissões RLS de pharmaleads e suas 23 colunas; o CSV foi preservado.') from None
        except (URLError, TimeoutError, OSError, ValueError):
            raise ErroPharmaLeads('Não foi possível comunicar com o Supabase. Confira a conexão; o CSV foi preservado.') from None

    def verificar(self, colunas):
        self._requisicao(parametros={'select': ','.join(colunas), 'limit': '0'})

    def listar(self, colunas='*', filtros=None):
        offset = 0
        while True:
            pagina = self._requisicao(parametros={**(filtros or {}), 'select': colunas,
                'order': 'chave.asc', 'limit': '500', 'offset': str(offset)})
            if not pagina:
                return
            yield from pagina
            # Não presume que o limite configurado no servidor seja 500.
            offset += len(pagina)

    def buscar(self, chaves):
        citado = lambda x: '"' + x.replace('\\', '\\\\').replace('"', '\\"') + '"'
        return {r['chave']: r for r in self.listar(filtros={
            'chave': 'in.(' + ','.join(citado(x) for x in chaves) + ')'})}

    def adicionar_emails(self, chave: str, encontrados: str) -> bool:
        """Acrescenta endereços a um lead existente, sem tocar nos outros campos."""
        from .enriquecedor import EMAIL, emails_publicos

        novos = emails_publicos(encontrados)
        if not novos:
            return False
        filtro = {'chave': f'eq.{chave}'}
        for _ in range(4):
            registros = self._requisicao(parametros={**filtro, 'select': 'emails', 'limit': '1'})
            if not registros:
                return False
            anterior = registros[0]['emails']
            existentes = {email.casefold() for email in EMAIL.findall(anterior or '')}
            adicionais = []
            for email in novos:
                if email.casefold() not in existentes:
                    adicionais.append(email)
                    existentes.add(email.casefold())
            if not adicionais:
                return False
            valor = ', '.join([anterior, *adicionais] if anterior else adicionais)
            # Só grava se ninguém mudou os e-mails depois da leitura.
            alterados = self._requisicao('PATCH', {
                **filtro, 'emails': 'is.null' if anterior is None else f'eq.{anterior}',
                'select': 'chave',
            }, {'emails': valor}, prefer='return=representation')
            if alterados:
                return True
        raise ErroPharmaLeads('O lead mudou durante a gravação dos e-mails. Tente novamente.')

    def salvar(self, registros):
        from .enriquecedor import emails_publicos
        registros = [r for r in registros if emails_publicos(r.get('emails'))]
        if not registros:
            return 0
        # Insere novos leads já com e-mail. Duplicatas são ignoradas nesta etapa
        # para não substituir contatos encontrados em coletas anteriores.
        com_emails = [{**r, 'emails': ', '.join(emails_publicos(r['emails']))}
                      for r in registros]
        self._requisicao('POST', {'on_conflict': 'chave'}, com_emails,
                        prefer='resolution=ignore-duplicates,return=minimal')
        # Atualiza os demais dados sem tocar na coluna de e-mails.
        sem_emails = [{k: v for k, v in registro.items() if k != 'emails'} for registro in registros]
        self._requisicao('POST', {'on_conflict': 'chave'}, sem_emails)
        for registro in registros:
            self.adicionar_emails(registro['chave'], registro['emails'])
        return len(registros)
