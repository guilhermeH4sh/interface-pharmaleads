"""Coleta oficial incremental da Receita Federal com baixo uso de disco."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import time
import tracemalloc
from collections import Counter
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from typing import Any, Literal
from urllib.parse import quote

from pharmaleads.domain.receita.pipeline import (
    PARSER_VERSION,
    SOURCE_ID,
    ReceitaImportError,
    StageSummary,
    _address,
    _json_line,
    _phone,
    _rows,
    _sha256,
    _stage_id,
    inspect_archives,
)
from pharmaleads.domain.receita.scope import is_eligible
from pharmaleads.shared.identifiers import normalize_cnpj

OFFICIAL_COMPETENCE = date(2026, 10, 1)
OFFICIAL_SHARE_TOKEN = "YggdBLfdninEJX9"
OFFICIAL_WEBDAV = "https://arquivos.receitafederal.gov.br/public.php/webdav/2026-10"
Progress = Callable[[str], None]


@dataclass(frozen=True)
class OfficialFile:
    name: str
    kind: Literal["empresas", "estabelecimentos", "municipios"]
    size: int


OFFICIAL_FILES = (
    OfficialFile("Municipios.zip", "municipios", 43_443),
    OfficialFile("Estabelecimentos0.zip", "estabelecimentos", 2_277_696_710),
    OfficialFile("Estabelecimentos1.zip", "estabelecimentos", 341_948_627),
    OfficialFile("Estabelecimentos2.zip", "estabelecimentos", 336_288_966),
    OfficialFile("Estabelecimentos3.zip", "estabelecimentos", 368_597_760),
    OfficialFile("Estabelecimentos4.zip", "estabelecimentos", 340_413_465),
    OfficialFile("Estabelecimentos5.zip", "estabelecimentos", 335_452_647),
    OfficialFile("Estabelecimentos6.zip", "estabelecimentos", 369_782_592),
    OfficialFile("Estabelecimentos7.zip", "estabelecimentos", 338_419_961),
    OfficialFile("Estabelecimentos8.zip", "estabelecimentos", 343_568_209),
    OfficialFile("Estabelecimentos9.zip", "estabelecimentos", 364_761_032),
    OfficialFile("Empresas0.zip", "empresas", 570_972_127),
    OfficialFile("Empresas1.zip", "empresas", 77_901_368),
    OfficialFile("Empresas2.zip", "empresas", 79_125_712),
    OfficialFile("Empresas3.zip", "empresas", 85_102_880),
    OfficialFile("Empresas4.zip", "empresas", 90_222_463),
    OfficialFile("Empresas5.zip", "empresas", 97_310_075),
    OfficialFile("Empresas6.zip", "empresas", 94_194_819),
    OfficialFile("Empresas7.zip", "empresas", 98_676_055),
    OfficialFile("Empresas8.zip", "empresas", 98_736_571),
    OfficialFile("Empresas9.zip", "empresas", 94_309_858),
)


def _official_url(item: OfficialFile) -> str:
    return f"{OFFICIAL_WEBDAV}/{quote(item.name)}"


def _download(item: OfficialFile, directory: Path, progress: Progress) -> Path:
    """Baixa com retomada e só publica o ZIP depois de conferir seu tamanho."""
    directory.mkdir(parents=True, exist_ok=True)
    final = directory / item.name
    partial = directory / f"{item.name}.part"
    if final.is_file() and final.stat().st_size == item.size:
        return final
    if final.exists():
        final.unlink()

    if partial.is_file() and partial.stat().st_size == item.size:
        os.replace(partial, final)
        return final

    for attempt in range(1, 4):
        if partial.is_file() and partial.stat().st_size > item.size:
            partial.unlink()
        progress(f"baixando {item.name}: tentativa {attempt}/3")
        result = subprocess.run(  # noqa: S603
            [
                "curl.exe",
                "--silent",
                "--show-error",
                "--location",
                "--fail",
                "--retry",
                "8",
                "--retry-all-errors",
                "--continue-at",
                "-",
                "--user",
                f"{OFFICIAL_SHARE_TOKEN}:",
                "--output",
                str(partial),
                _official_url(item),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode == 0 and partial.is_file() and partial.stat().st_size == item.size:
            os.replace(partial, final)
            progress(f"download concluído: {item.name}")
            return final
        if attempt < 3:
            progress(f"retomando {item.name}: tamanho ainda divergente")
            time.sleep(2**attempt)
    raise ReceitaImportError("Falha ao baixar arquivo oficial da Receita.")


def _member(path: Path, expected: str) -> tuple[Any, dict[str, Any]]:
    members, fingerprints = inspect_archives([path], require_complete=False)
    selected = [member for member in members if member.kind == expected]
    if len(selected) != 1 or len(members) != 1:
        raise ReceitaImportError("ZIP oficial contém conjunto inesperado de membros.")
    return selected[0], fingerprints[0]


def _write_json(path: Path, payload: Any) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def _load_municipalities(path: Path) -> dict[str, str]:
    member, _fingerprint = _member(path, "municipios")
    result: dict[str, str] = {}
    for row in _rows(member):
        if not row[0] or not row[1]:
            continue
        if row[0] in result and result[row[0]] != row[1]:
            raise ReceitaImportError("Dicionário municipal contém código conflitante.")
        result[row[0]] = row[1]
    return result


def _filter_establishments(
    archive: Path, part: Path, municipalities: dict[str, str]
) -> dict[str, Any]:
    member, fingerprint = _member(archive, "estabelecimentos")
    temporary = part.with_suffix(".tmp")
    scanned = eligible = 0
    rejects: Counter[str] = Counter()
    with temporary.open("w", encoding="utf-8", newline="\n") as target:
        for row in _rows(member):
            scanned += 1
            if not is_eligible(uf=row[19], main_cnae=row[11], registration_status=row[5]):
                continue
            eligible += 1
            try:
                cnpj = normalize_cnpj("".join(row[:3]))
            except ValueError:
                rejects["cnpj_invalido"] += 1
                continue
            city = municipalities.get(row[20])
            if city is None:
                rejects["municipio_desconhecido"] += 1
                continue
            target.write(
                _json_line(
                    {
                        "base": row[0],
                        "cnpj": cnpj,
                        "matriz_filial": row[3],
                        "nome_fantasia": row[4],
                        "situacao_cadastral": row[5],
                        "cnae": row[11],
                        "uf": row[19],
                        "municipio_codigo": row[20],
                        "cidade": city,
                        "bairro": row[17],
                        "endereco": _address(row),
                        "telefone": _phone(row[21], row[22]) or _phone(row[23], row[24]),
                        "email": row[27].lower(),
                    }
                )
            )
    os.replace(temporary, part)
    return {
        "fingerprint": fingerprint,
        "rows_scanned": scanned,
        "rows_eligible": eligible,
        "rejections": dict(rejects),
    }


def _filter_companies(archive: Path, part: Path, eligible_bases: set[str]) -> dict[str, Any]:
    member, fingerprint = _member(archive, "empresas")
    temporary = part.with_suffix(".tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as target:
        for row in _rows(member):
            if row[0] in eligible_bases:
                target.write(_json_line({"base": row[0], "razao_social": row[1]}))
    os.replace(temporary, part)
    return {"fingerprint": fingerprint}


def _read_lines(paths: list[Path]):  # type: ignore[no-untyped-def]
    for path in paths:
        with path.open("r", encoding="utf-8") as stream:
            for line in stream:
                yield json.loads(line)


def _finalize(
    parts: Path,
    output_root: Path,
    competencia: date,
    fingerprints: list[dict[str, Any]],
    establishment_stats: list[dict[str, Any]],
) -> StageSummary:
    competence_text = competencia.isoformat()
    stage_id = _stage_id(fingerprints, competence_text)
    final_dir = output_root / stage_id
    manifest = final_dir / "manifest.json"
    if manifest.is_file():
        return StageSummary(**json.loads(manifest.read_text(encoding="utf-8"))["summary"])

    company_names: dict[str, str] = {}
    for raw in _read_lines(sorted(parts.glob("empresas-*.ndjson"))):
        previous = company_names.setdefault(raw["base"], raw["razao_social"])
        if previous != raw["razao_social"]:
            raise ReceitaImportError("Empresas contém CNPJ básico conflitante.")

    output_root.mkdir(parents=True, exist_ok=True)
    temp_dir = Path(tempfile.mkdtemp(prefix="pharmaleads-m05-", dir=output_root))
    rejects: Counter[str] = Counter()
    for stat in establishment_stats:
        rejects.update(stat["rejections"])
    by_uf: Counter[str] = Counter()
    by_municipio: Counter[str] = Counter()
    by_cnae: Counter[str] = Counter()
    seen_cnpjs: set[str] = set()
    matrices = filiais = phones = emails = generic_emails = accounting_emails = staged = 0
    duplicates = 0
    records_path = temp_dir / "records.ndjson"
    try:
        with records_path.open("w", encoding="utf-8", newline="\n") as target:
            for raw in _read_lines(sorted(parts.glob("estabelecimentos-*.ndjson"))):
                if raw["cnpj"] in seen_cnpjs:
                    duplicates += 1
                    continue
                seen_cnpjs.add(raw["cnpj"])
                legal_name = company_names.get(raw.pop("base"))
                if not legal_name:
                    rejects["empresa_ausente"] += 1
                    continue
                record = {
                    "cnpj": raw["cnpj"],
                    "nome": raw["nome_fantasia"] or legal_name,
                    "razao_social": legal_name,
                    "uf": raw["uf"],
                    "cidade": raw["cidade"],
                    "bairro": raw["bairro"],
                    "endereco": raw["endereco"],
                    "cnae": raw["cnae"],
                    "telefone": raw["telefone"],
                    "email": raw["email"],
                    "origem": "Receita Federal - Dados Abertos CNPJ",
                    "_meta": {
                        "matriz_filial": raw["matriz_filial"],
                        "situacao_cadastral": raw["situacao_cadastral"],
                        "municipio_codigo": raw["municipio_codigo"],
                        "competencia": competence_text,
                    },
                }
                target.write(_json_line(record))
                staged += 1
                by_uf[raw["uf"]] += 1
                by_municipio[f"{raw['uf']}|{raw['municipio_codigo']}|{raw['cidade']}"] += 1
                by_cnae[raw["cnae"]] += 1
                matrices += raw["matriz_filial"] == "1"
                filiais += raw["matriz_filial"] == "2"
                phones += bool(raw["telefone"])
                emails += bool(raw["email"])
                local_email = raw["email"].partition("@")[0]
                accounting_emails += "contab" in local_email
                generic_emails += local_email in {
                    "administrativo",
                    "atendimento",
                    "comercial",
                    "contato",
                    "financeiro",
                    "fiscal",
                    "sac",
                }
        _current, peak = tracemalloc.get_traced_memory()
        summary = StageSummary(
            stage_id=stage_id,
            competencia=competence_text,
            parser_version=PARSER_VERSION,
            source_id=SOURCE_ID,
            input_bytes=sum(int(item["bytes"]) for item in fingerprints),
            rows_scanned=sum(int(item["rows_scanned"]) for item in establishment_stats),
            rows_eligible=sum(int(item["rows_eligible"]) for item in establishment_stats),
            rows_staged=staged,
            duplicate_rows=duplicates,
            rejected_rows=sum(rejects.values()),
            rejections=dict(sorted(rejects.items())),
            peak_memory_bytes=peak,
            records_sha256=_sha256(records_path),
            by_uf=dict(sorted(by_uf.items())),
            by_municipio=dict(sorted(by_municipio.items())),
            by_cnae=dict(sorted(by_cnae.items())),
            matrices=matrices,
            filiais=filiais,
            with_phone_declared=phones,
            with_email_declared=emails,
            with_generic_email=generic_emails,
            with_accounting_email=accounting_emails,
        )
        (temp_dir / "manifest.json").write_text(
            json.dumps(
                {
                    "summary": asdict(summary),
                    "inputs": fingerprints,
                    "scope": (
                        "27 UFs; todos os municípios; situação 02; "
                        "CNAE principal farmacêutico humano"
                    ),
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        os.replace(temp_dir, final_dir)
        return summary
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir)


def collect_official(
    work_root: Path,
    output_root: Path,
    competencia: date,
    *,
    progress: Progress = lambda _message: None,
) -> StageSummary:
    """Baixa, filtra e remove cada ZIP antes de avançar para o próximo."""
    if competencia != OFFICIAL_COMPETENCE:
        raise ReceitaImportError("Competência não corresponde ao conjunto oficial configurado.")
    started = time.perf_counter()
    tracemalloc.start()
    downloads = work_root / "downloads"
    parts = work_root / "parts"
    parts.mkdir(parents=True, exist_ok=True)
    fingerprints: list[dict[str, Any]] = []
    establishment_stats: list[dict[str, Any]] = []
    try:
        municipality_file = OFFICIAL_FILES[0]
        municipality_zip = _download(municipality_file, downloads, progress)
        municipalities = _load_municipalities(municipality_zip)
        _municipality_member, municipality_fingerprint = _member(municipality_zip, "municipios")
        fingerprints.append(municipality_fingerprint)
        municipality_zip.unlink()

        for index, item in enumerate(
            file for file in OFFICIAL_FILES if file.kind == "estabelecimentos"
        ):
            part = parts / f"estabelecimentos-{index}.ndjson"
            stat_path = parts / f"estabelecimentos-{index}.json"
            if part.is_file() and stat_path.is_file():
                stat = json.loads(stat_path.read_text(encoding="utf-8"))
            else:
                archive = _download(item, downloads, progress)
                stat = _filter_establishments(archive, part, municipalities)
                _write_json(stat_path, stat)
                archive.unlink()
                progress(f"filtrado: {item.name}")
            establishment_stats.append(stat)
            fingerprints.append(stat["fingerprint"])

        eligible_bases = {
            raw["base"] for raw in _read_lines(sorted(parts.glob("estabelecimentos-*.ndjson")))
        }
        progress(f"CNPJs básicos elegíveis: {len(eligible_bases)}")

        for index, item in enumerate(file for file in OFFICIAL_FILES if file.kind == "empresas"):
            part = parts / f"empresas-{index}.ndjson"
            stat_path = parts / f"empresas-{index}.json"
            if part.is_file() and stat_path.is_file():
                stat = json.loads(stat_path.read_text(encoding="utf-8"))
            else:
                archive = _download(item, downloads, progress)
                stat = _filter_companies(archive, part, eligible_bases)
                _write_json(stat_path, stat)
                archive.unlink()
                progress(f"filtrado: {item.name}")
            fingerprints.append(stat["fingerprint"])

        summary = _finalize(
            parts,
            output_root,
            competencia,
            sorted(fingerprints, key=lambda item: str(item["name"])),
            establishment_stats,
        )
        summary.duration_seconds = round(time.perf_counter() - started, 3)
        manifest = output_root / summary.stage_id / "manifest.json"
        payload = json.loads(manifest.read_text(encoding="utf-8"))
        payload["summary"]["duration_seconds"] = summary.duration_seconds
        _write_json(manifest, payload)
        shutil.rmtree(work_root)
        return summary
    finally:
        tracemalloc.stop()
