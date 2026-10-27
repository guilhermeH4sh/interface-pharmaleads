"""Entrada CSV limitada de candidatos fornecidos por fontes autorizadas."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from pharmaleads.shared.identifiers import normalize_cnpj

MAX_FILE_BYTES = 1_000_000
MAX_ROWS = 100
HEADERS = ("lead_id", "cnpj", "url", "source_id")


class CandidateFileError(ValueError):
    """Arquivo inválido sem reproduzir conteúdo sensível da linha."""


@dataclass(frozen=True)
class CandidateInput:
    lead_id: int
    cnpj: str
    url: str
    source_id: str


def read_candidate_csv(path: Path) -> list[CandidateInput]:
    if not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
        raise CandidateFileError("Arquivo ausente ou acima de 1 MB.")
    records: list[CandidateInput] = []
    seen_leads: set[int] = set()
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle, strict=True)
            if reader.fieldnames != list(HEADERS):
                raise CandidateFileError("Cabeçalho inválido para candidatos de site.")
            for row_number, row in enumerate(reader, start=2):
                if row_number > MAX_ROWS + 1:
                    raise CandidateFileError("Limite de 100 candidatos por arquivo.")
                if None in row or any(value is None for value in row.values()):
                    raise CandidateFileError(f"Linha {row_number}: número de colunas inválido.")
                try:
                    lead_id = int(row["lead_id"])
                    cnpj = normalize_cnpj(row["cnpj"].strip())
                except (ValueError, KeyError) as exc:
                    raise CandidateFileError(
                        f"Linha {row_number}: identificação inválida."
                    ) from exc
                url = row["url"].strip()
                source_id = row["source_id"].strip()
                if (
                    lead_id < 1
                    or lead_id in seen_leads
                    or not url
                    or len(url) > 2048
                    or not source_id
                    or len(source_id) > 64
                ):
                    raise CandidateFileError(f"Linha {row_number}: candidato inválido.")
                seen_leads.add(lead_id)
                records.append(CandidateInput(lead_id, cnpj, url, source_id))
    except (UnicodeError, csv.Error) as exc:
        raise CandidateFileError("Arquivo CSV inválido ou fora de UTF-8.") from exc
    if not records:
        raise CandidateFileError("Arquivo sem candidatos.")
    return records
