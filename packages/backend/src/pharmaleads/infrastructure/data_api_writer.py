"""Importação local e explícita de cadastro para a única tabela autorizada.

Não é endpoint HTTP de escrita. Não modifica campos comerciais nem faz
associação automática com linhas antigas sem CNPJ.
"""

import argparse
import csv
import json
import os
import ssl
import sys
from datetime import UTC, datetime
from http.client import HTTPException, HTTPSConnection
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlencode

from pharmaleads.config import Settings
from pharmaleads.domain.source_policy.engine import PolicyViolationError
from pharmaleads.domain.source_policy.models import PolicyAction
from pharmaleads.domain.source_policy.registry import (
    CatalogConfigurationError,
    SourcePolicyRegistry,
)
from pharmaleads.infrastructure.data_api import HOST, KEY_ENV, validate_publishable_key
from pharmaleads.shared.identifiers import normalize_cnpj

TABLE_PATH = "/rest/v1/pharmaleads"
WRITE_APPROVAL_ENV = "PHARMALEADS_TABLE_WRITE_APPROVED"
MAX_FILE_BYTES = 1_000_000
MAX_ROWS = 100
REQUIRED_COLUMNS = ("cnpj", "nome", "uf", "cidade")
OPTIONAL_COLUMNS = ("razao_social", "bairro", "endereco", "cnae")
M05_OPTIONAL_COLUMNS = ("telefone", "email", "origem")
ALLOWED_COLUMNS = set(REQUIRED_COLUMNS + OPTIONAL_COLUMNS + M05_OPTIONAL_COLUMNS)
VALID_UFS = frozenset(
    "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split()
)
Mode = Literal["insert", "update"]


class ImportErrorSafe(Exception):
    """Erro sem valores de linhas, URL remota ou chave."""


def _clean(value: str | None, *, row_number: int, field: str) -> str:
    if value is None:
        raise ImportErrorSafe(f"Linha {row_number}: campo ausente: {field}.")
    cleaned = value.strip()
    if not cleaned or len(cleaned) > 500 or any(ord(char) < 32 for char in cleaned):
        raise ImportErrorSafe(f"Linha {row_number}: campo inválido: {field}.")
    return cleaned


def read_csv(path: Path, mode: Mode) -> list[dict[str, str]]:
    """Valida o arquivo inteiro antes de permitir qualquer requisição de escrita."""
    if not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
        raise ImportErrorSafe("Arquivo ausente ou acima de 1 MB.")
    records: list[dict[str, str]] = []
    seen_cnpjs: set[str] = set()
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle, strict=True)
            headers = reader.fieldnames
            if (
                headers is None
                or len(headers) != len(set(headers))
                or not set(REQUIRED_COLUMNS).issubset(headers)
                or not set(headers).issubset(ALLOWED_COLUMNS)
            ):
                raise ImportErrorSafe(
                    "Cabeçalho inválido; use somente campos cadastrais permitidos."
                )
            for row_number, row in enumerate(reader, start=2):
                if row_number > MAX_ROWS + 1:
                    raise ImportErrorSafe("Limite de 100 registros por operação.")
                if None in row:
                    raise ImportErrorSafe(f"Linha {row_number}: número incorreto de colunas.")
                record = {
                    field: _clean(row[field], row_number=row_number, field=field)
                    for field in REQUIRED_COLUMNS
                }
                try:
                    record["cnpj"] = normalize_cnpj(record["cnpj"])
                except ValueError as exc:
                    raise ImportErrorSafe(f"Linha {row_number}: CNPJ inválido.") from exc
                record["uf"] = record["uf"].upper()
                if record["uf"] not in VALID_UFS:
                    raise ImportErrorSafe(f"Linha {row_number}: UF inválida.")
                for field in OPTIONAL_COLUMNS + M05_OPTIONAL_COLUMNS:
                    if field in row and row[field] is not None and row[field].strip():
                        record[field] = _clean(row[field], row_number=row_number, field=field)
                if record["cnpj"] in seen_cnpjs:
                    raise ImportErrorSafe(f"Linha {row_number}: CNPJ repetido no arquivo.")
                seen_cnpjs.add(record["cnpj"])
                records.append(record)
    except (UnicodeError, csv.Error) as exc:
        raise ImportErrorSafe("Arquivo CSV inválido ou fora de UTF-8.") from exc
    if not records:
        raise ImportErrorSafe("Arquivo sem registros.")
    if mode == "update" and len(records) != 1:
        raise ImportErrorSafe("Atualização exige exatamente um registro por operação.")
    return records


def _masked_cnpj(cnpj: str) -> str:
    return f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}"


def _safe_postgrest_reason(body: bytes) -> str:
    """Classifica falhas conhecidas sem repetir detalhes retornados pelo servidor."""
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeError):
        return "motivo não classificado"
    if not isinstance(payload, dict):
        return "motivo não classificado"
    code = payload.get("code")
    message = payload.get("message")
    if not isinstance(message, str):
        return f"código {code}" if isinstance(code, str) else "motivo não classificado"
    normalized = message.casefold()
    if "row-level security" in normalized:
        return "política RLS recusou a linha"
    if "permission denied for sequence" in normalized:
        return "sem privilégio na sequência de identidade"
    if "permission denied for table" in normalized:
        return "sem privilégio de escrita na tabela"
    if "jwt" in normalized or "token" in normalized:
        return "autenticação recusada"
    return f"código {code}" if isinstance(code, str) else "motivo não classificado"


class PharmaleadsWriter:
    def __init__(
        self,
        publishable_key: str,
        *,
        source_id: str | None = None,
        registry: SourcePolicyRegistry | None = None,
        access_token: str | None = None,
    ) -> None:
        validate_publishable_key(publishable_key)
        self._key = publishable_key
        self._source_id = source_id
        self._registry = registry or SourcePolicyRegistry(Settings().source_policy_path)
        if access_token is not None and access_token.count(".") != 2:
            raise ValueError("Token de acesso inválido.")
        self._access_token = access_token

    def _request(
        self, method: str, path: str, payload: Any = None, *, return_rows: bool = False
    ) -> tuple[int, bytes]:
        if self._source_id is None:
            raise ImportErrorSafe("Fonte aprovada obrigatória para operações remotas.")
        records = payload if isinstance(payload, list) else [payload] if payload else []
        fields = tuple({key for record in records for key in record}) if records else ("id", "cnpj")
        action = PolicyAction.COLETAR if method == "GET" else PolicyAction.PERSISTIR
        return self._registry.guarded(
            self._source_id,
            fields,
            action,
            lambda: self._request_unchecked(method, path, payload, return_rows=return_rows),
        )

    def _request_unchecked(
        self, method: str, path: str, payload: Any = None, *, return_rows: bool = False
    ) -> tuple[int, bytes]:
        headers = {
            "apikey": self._key,
            "Accept": "application/json",
            "Accept-Profile": "public",
        }
        if self._access_token is not None:
            headers["Authorization"] = f"Bearer {self._access_token}"
        body = None
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            headers["Content-Type"] = "application/json"
            headers["Content-Profile"] = "public"
            headers["Prefer"] = "return=representation" if return_rows else "return=minimal"
            if method == "POST" and "on_conflict=" in path:
                headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
        connection = HTTPSConnection(HOST, timeout=10, context=ssl.create_default_context())
        try:
            connection.request(method, path, body=body, headers=headers)
            response = connection.getresponse()
            if return_rows or method == "GET" or response.status >= 400:
                data = response.read(4097)
                if len(data) > 4096:
                    raise ImportErrorSafe("Resposta remota acima do limite esperado.")
            else:
                data = b""
            return response.status, data
        finally:
            connection.close()

    def _find_existing(self, cnpj: str) -> str | None:
        matches: list[str] = []
        for candidate in (cnpj, _masked_cnpj(cnpj)):
            query = urlencode({"select": "id,cnpj", "cnpj": f"eq.{candidate}", "limit": "2"})
            status, body = self._request("GET", f"{TABLE_PATH}?{query}")
            if status not in {200, 206}:
                raise ImportErrorSafe("Consulta de CNPJ recusada pelo Supabase.")
            try:
                rows = json.loads(body)
            except (ValueError, UnicodeError) as exc:
                raise ImportErrorSafe("Resposta inválida na consulta de CNPJ.") from exc
            if not isinstance(rows, list) or len(rows) > 1:
                raise ImportErrorSafe("Consulta de CNPJ ambígua.")
            if rows:
                if not isinstance(rows[0], dict) or rows[0].get("cnpj") != candidate:
                    raise ImportErrorSafe("Consulta de CNPJ inesperada.")
                matches.append(candidate)
        if len(matches) > 1:
            raise ImportErrorSafe(
                "CNPJ cadastrado em mais de um formato; revisão manual necessária."
            )
        return matches[0] if matches else None

    @staticmethod
    def _check_record(record: dict[str, str]) -> None:
        if not set(REQUIRED_COLUMNS).issubset(record) or not set(record).issubset(ALLOWED_COLUMNS):
            raise ImportErrorSafe("Campos de escrita fora da lista cadastral permitida.")
        try:
            if normalize_cnpj(record["cnpj"]) != record["cnpj"]:
                raise ImportErrorSafe("CNPJ de escrita fora do formato canônico.")
        except ValueError as exc:
            raise ImportErrorSafe("CNPJ de escrita inválido.") from exc

    def insert(self, records: list[dict[str, str]]) -> int:
        if not records or len(records) > MAX_ROWS:
            raise ImportErrorSafe("Quantidade de registros fora do limite.")
        for record in records:
            self._check_record(record)
            if self._find_existing(record["cnpj"]) is not None:
                raise ImportErrorSafe("CNPJ já cadastrado; nenhuma inserção enviada.")
        status, _ = self._request("POST", TABLE_PATH, records)
        if status != 201:
            raise ImportErrorSafe(f"Inserção recusada pelo Supabase (HTTP {status}).")
        return len(records)

    def update(self, record: dict[str, str]) -> int:
        self._check_record(record)
        stored_cnpj = self._find_existing(record["cnpj"])
        if stored_cnpj is None:
            raise ImportErrorSafe("CNPJ não localizado; nenhuma atualização enviada.")
        cadastral_fields = {key: value for key, value in record.items() if key != "cnpj"}
        cadastral_fields["updated_at"] = datetime.now(UTC).isoformat()
        query = urlencode({"select": "id", "cnpj": f"eq.{stored_cnpj}"})
        status, body = self._request(
            "PATCH", f"{TABLE_PATH}?{query}", cadastral_fields, return_rows=True
        )
        if status != 200:
            raise ImportErrorSafe(f"Atualização recusada pelo Supabase (HTTP {status}).")
        try:
            rows = json.loads(body)
        except (ValueError, UnicodeError) as exc:
            raise ImportErrorSafe("Resposta inválida na atualização.") from exc
        if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
            raise ImportErrorSafe("Atualização sem confirmação de uma única linha.")
        return 1

    def upsert_cadastral(self, records: list[dict[str, str]]) -> int:
        """Promove cadastro por CNPJ sem enviar ou apagar qualquer campo comercial."""
        if not records or len(records) > 500:
            raise ImportErrorSafe("Quantidade de registros fora do limite.")
        forbidden = {"status", "responsavel", "observacoes", "historico", "duplicado"}
        for record in records:
            if set(record) & forbidden:
                raise ImportErrorSafe("Campo comercial proibido na promoção cadastral.")
            self._check_record(record)
        query = urlencode({"on_conflict": "cnpj"})
        status, body = self._request(
            "POST",
            f"{TABLE_PATH}?{query}",
            records,
            return_rows=False,
        )
        if status not in {200, 201, 204}:
            reason = _safe_postgrest_reason(body)
            raise ImportErrorSafe(
                f"Promoção recusada pelo Supabase (HTTP {status}; {reason})."
            )
        return len(records)

    def verify_cnpjs(self, records: list[dict[str, str]]) -> int:
        """Confirma por leitura autenticada que um lote inteiro ficou acessível."""
        expected = {record["cnpj"] for record in records}
        if not expected or len(expected) > 100:
            raise ImportErrorSafe("Quantidade de CNPJs fora do limite de verificação.")
        query = urlencode(
            {
                "select": "cnpj",
                "cnpj": f"in.({','.join(sorted(expected))})",
                "limit": str(len(expected)),
            }
        )
        status, body = self._request("GET", f"{TABLE_PATH}?{query}")
        if status not in {200, 206}:
            raise ImportErrorSafe("Verificação de promoção recusada pelo Supabase.")
        try:
            rows = json.loads(body)
        except (ValueError, UnicodeError) as exc:
            raise ImportErrorSafe("Resposta inválida na verificação da promoção.") from exc
        found = {row.get("cnpj") for row in rows if isinstance(row, dict)}
        if found != expected:
            raise ImportErrorSafe("Verificação não encontrou todos os CNPJs promovidos.")
        return len(found)


def main() -> int:
    parser = argparse.ArgumentParser(description="Importação restrita a public.pharmaleads.")
    parser.add_argument("--file", required=True, type=Path, help="CSV UTF-8 local")
    parser.add_argument("--mode", required=True, choices=("insert", "update"))
    parser.add_argument("--apply", action="store_true", help="Confirma escrita real após prévia")
    parser.add_argument("--source", help="Identificador da fonte aprovada no catálogo M04")
    args = parser.parse_args()
    mode: Mode = args.mode
    try:
        records = read_csv(args.file, mode)
    except ImportErrorSafe as exc:
        print(f"Importação bloqueada: {exc}", file=sys.stderr)
        return 1
    except OSError:
        print("Importação bloqueada: não foi possível ler o CSV.", file=sys.stderr)
        return 1
    print(
        json.dumps(
            {
                "table": "public.pharmaleads",
                "mode": mode,
                "rows_validated": len(records),
                "writes_performed": 0,
            }
        )
    )
    if not args.apply:
        return 0
    if os.environ.get(WRITE_APPROVAL_ENV) != "public.pharmaleads":
        print(
            "Escrita bloqueada: política da tabela e liberação operacional pendentes.",
            file=sys.stderr,
        )
        return 1
    if not sys.stdin.isatty():
        print("Importação bloqueada: confirmação interativa obrigatória.", file=sys.stderr)
        return 1
    if input("Digite APLICAR public.pharmaleads para gravar: ").strip() != (
        "APLICAR public.pharmaleads"
    ):
        print("Importação cancelada.", file=sys.stderr)
        return 1
    try:
        writer = PharmaleadsWriter(os.environ.get(KEY_ENV, ""), source_id=args.source)
        written = writer.insert(records) if mode == "insert" else writer.update(records[0])
    except (
        ValueError,
        ImportErrorSafe,
        OSError,
        HTTPException,
        PolicyViolationError,
        CatalogConfigurationError,
    ):
        print("Importação não confirmada; detalhes protegidos.", file=sys.stderr)
        return 1
    print(json.dumps({"table": "public.pharmaleads", "mode": mode, "rows_written": written}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
