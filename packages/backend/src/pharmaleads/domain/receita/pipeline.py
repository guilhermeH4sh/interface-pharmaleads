"""Pipeline local, idempotente e em streaming para arquivos oficiais do CNPJ."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import re
import shutil
import tempfile
import time
import tracemalloc
import zipfile
from collections import Counter
from collections.abc import Iterator, Sequence
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path, PurePosixPath
from typing import Any, Literal

from pharmaleads.domain.receita.scope import VALID_UFS, is_eligible
from pharmaleads.shared.identifiers import normalize_cnpj

PARSER_VERSION = "rfb-cnpj-2021-v1"
SOURCE_ID = "receita_cnpj"
COLLECTED_FIELDS = (
    "cnpj",
    "nome",
    "razao_social",
    "uf",
    "cidade",
    "bairro",
    "endereco",
    "cnae",
    "telefone",
    "email",
    "origem",
    "matriz_filial",
    "situacao_cadastral",
    "municipio_codigo",
    "competencia",
)
MAX_ARCHIVES = 40
MAX_MEMBERS = 4
MAX_MEMBER_BYTES = 12_000_000_000
MAX_TOTAL_BYTES = 80_000_000_000
MAX_COMPRESSION_RATIO = 250
EXPECTED_COLUMNS = {"empresas": 7, "estabelecimentos": 30, "municipios": 2}
_KIND_MARKERS = {
    "empresas": ("EMPRESA", "EMPRECSV"),
    "estabelecimentos": ("ESTABELE",),
    "municipios": ("MUNICIP", "MUNICCSV"),
}


class ReceitaImportError(RuntimeError):
    """Erro sanitizado do pipeline; nunca inclui conteúdo de linhas."""


@dataclass(frozen=True)
class ArchiveMember:
    archive: Path
    name: str
    kind: Literal["empresas", "estabelecimentos", "municipios"]


@dataclass
class StageSummary:
    stage_id: str
    competencia: str
    parser_version: str = PARSER_VERSION
    source_id: str = SOURCE_ID
    input_bytes: int = 0
    rows_scanned: int = 0
    rows_eligible: int = 0
    rows_staged: int = 0
    duplicate_rows: int = 0
    rejected_rows: int = 0
    rejections: dict[str, int] = field(default_factory=dict)
    duration_seconds: float = 0.0
    peak_memory_bytes: int = 0
    records_sha256: str = ""
    by_uf: dict[str, int] = field(default_factory=dict)
    by_municipio: dict[str, int] = field(default_factory=dict)
    by_cnae: dict[str, int] = field(default_factory=dict)
    matrices: int = 0
    filiais: int = 0
    with_phone_declared: int = 0
    with_email_declared: int = 0
    with_generic_email: int = 0
    with_accounting_email: int = 0
    with_known_website: int = 0


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _kind(name: str) -> Literal["empresas", "estabelecimentos", "municipios"] | None:
    upper = name.upper()
    for kind, markers in _KIND_MARKERS.items():
        if any(marker in upper for marker in markers):
            return kind  # type: ignore[return-value]
    return None


def inspect_archives(
    paths: Sequence[Path], *, require_complete: bool = True
) -> tuple[list[ArchiveMember], list[dict[str, Any]]]:
    """Valida limites e caminhos do ZIP antes de abrir qualquer CSV."""
    if not paths or len(paths) > MAX_ARCHIVES:
        raise ReceitaImportError("Quantidade de arquivos fora do limite operacional.")
    members: list[ArchiveMember] = []
    fingerprints: list[dict[str, Any]] = []
    total_uncompressed = 0
    for path in sorted({item.resolve() for item in paths}, key=str):
        if not path.is_file() or path.suffix.lower() != ".zip":
            raise ReceitaImportError("Entrada ausente ou fora do formato ZIP esperado.")
        fingerprints.append(
            {"name": path.name, "bytes": path.stat().st_size, "sha256": _sha256(path)}
        )
        try:
            with zipfile.ZipFile(path) as archive:
                infos = [info for info in archive.infolist() if not info.is_dir()]
                if not infos or len(infos) > MAX_MEMBERS:
                    raise ReceitaImportError("ZIP com quantidade de membros fora do limite.")
                for info in infos:
                    pure = PurePosixPath(info.filename.replace("\\", "/"))
                    if pure.is_absolute() or ".." in pure.parts or len(pure.parts) != 1:
                        raise ReceitaImportError("ZIP contém caminho inseguro.")
                    if info.flag_bits & 0x1 or info.file_size > MAX_MEMBER_BYTES:
                        raise ReceitaImportError("ZIP criptografado ou membro acima do limite.")
                    total_uncompressed += info.file_size
                    if total_uncompressed > MAX_TOTAL_BYTES:
                        raise ReceitaImportError("Conteúdo descompactado acima do limite.")
                    ratio = info.file_size / max(info.compress_size, 1)
                    if ratio > MAX_COMPRESSION_RATIO:
                        raise ReceitaImportError("Taxa de compressão suspeita.")
                    kind = _kind(pure.name)
                    # A RFB usa sufixos próprios (EMPRECSV/ESTABELE/MUNICCSV),
                    # portanto o tipo é validado pelo marcador oficial do nome.
                    if kind is None:
                        raise ReceitaImportError("ZIP contém membro inesperado.")
                    members.append(ArchiveMember(path, info.filename, kind))
        except (OSError, zipfile.BadZipFile) as exc:
            raise ReceitaImportError("Arquivo ZIP inválido.") from exc
    found = {member.kind for member in members}
    if require_complete and found != set(EXPECTED_COLUMNS):
        raise ReceitaImportError(
            "Conjunto incompleto: empresas, estabelecimentos e municípios são obrigatórios."
        )
    return members, fingerprints


def _rows(member: ArchiveMember) -> Iterator[list[str]]:
    try:
        with zipfile.ZipFile(member.archive) as archive, archive.open(member.name) as raw:
            text = io.TextIOWrapper(raw, encoding="latin-1", newline="")
            reader = csv.reader(text, delimiter=";", quotechar='"', strict=True)
            for row in reader:
                if len(row) != EXPECTED_COLUMNS[member.kind]:
                    raise ReceitaImportError(f"Layout alterado no arquivo de {member.kind}.")
                yield [value.strip() for value in row]
    except (UnicodeError, csv.Error, OSError, zipfile.BadZipFile) as exc:
        raise ReceitaImportError("Conteúdo CSV inválido.") from exc


def validate_layout(paths: Sequence[Path]) -> dict[str, Any]:
    members, fingerprints = inspect_archives(paths)
    for member in members:
        try:
            next(_rows(member))
        except StopIteration as exc:
            raise ReceitaImportError(f"Arquivo de {member.kind} vazio.") from exc
    return {"status": "valid", "parser_version": PARSER_VERSION, "archives": fingerprints}


def _stage_id(fingerprints: Sequence[dict[str, Any]], competencia: str) -> str:
    payload = json.dumps(
        {"files": fingerprints, "competencia": competencia, "parser": PARSER_VERSION},
        sort_keys=True,
        separators=(",", ":"),
    ).encode()
    return hashlib.sha256(payload).hexdigest()[:24]


def _phone(ddd: str, number: str) -> str:
    digits = re.sub(r"\D", "", f"{ddd}{number}")
    return digits if len(digits) in {10, 11} else ""


def _address(row: Sequence[str]) -> str:
    return " ".join(part for part in (row[13], row[14], row[15], row[16]) if part).strip()


def _json_line(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"


def build_stage(
    paths: Sequence[Path], output_root: Path, competencia: date, *, dry_run: bool = False
) -> StageSummary:
    """Filtra cedo, junta apenas empresas elegíveis e publica stage por rename atômico."""
    members, fingerprints = inspect_archives(paths)
    competence_text = competencia.isoformat()
    stage_id = _stage_id(fingerprints, competence_text)
    final_dir = output_root / stage_id
    manifest = final_dir / "manifest.json"
    if manifest.is_file():
        return StageSummary(**json.loads(manifest.read_text(encoding="utf-8"))["summary"])

    started = time.perf_counter()
    tracemalloc.start()
    if not dry_run:
        output_root.mkdir(parents=True, exist_ok=True)
    temp_parent = output_root if not dry_run else None
    temp_dir = Path(tempfile.mkdtemp(prefix="pharmaleads-m05-", dir=temp_parent))
    rejects: Counter[str] = Counter()
    by_uf: Counter[str] = Counter()
    by_municipio: Counter[str] = Counter()
    by_cnae: Counter[str] = Counter()
    try:
        municipalities: dict[str, str] = {}
        for member in (item for item in members if item.kind == "municipios"):
            for row in _rows(member):
                if not row[0] or not row[1]:
                    rejects["municipio_invalido"] += 1
                elif row[0] in municipalities and municipalities[row[0]] != row[1]:
                    raise ReceitaImportError("Dicionário municipal contém código conflitante.")
                else:
                    municipalities[row[0]] = row[1]

        eligible_bases: set[str] = set()
        seen_cnpjs: set[str] = set()
        raw_path = temp_dir / "eligible.ndjson"
        rows_scanned = rows_eligible = duplicates = 0
        with raw_path.open("w", encoding="utf-8", newline="\n") as raw_stage:
            for member in (item for item in members if item.kind == "estabelecimentos"):
                for row in _rows(member):
                    rows_scanned += 1
                    if not is_eligible(uf=row[19], main_cnae=row[11], registration_status=row[5]):
                        continue
                    rows_eligible += 1
                    try:
                        cnpj = normalize_cnpj("".join(row[:3]))
                    except ValueError:
                        rejects["cnpj_invalido"] += 1
                        continue
                    if cnpj in seen_cnpjs:
                        duplicates += 1
                        continue
                    city = municipalities.get(row[20])
                    if city is None:
                        rejects["municipio_desconhecido"] += 1
                        continue
                    seen_cnpjs.add(cnpj)
                    eligible_bases.add(row[0])
                    raw_stage.write(
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

        company_names: dict[str, str] = {}
        for member in (item for item in members if item.kind == "empresas"):
            for row in _rows(member):
                if row[0] in eligible_bases:
                    if row[0] in company_names and company_names[row[0]] != row[1]:
                        raise ReceitaImportError("Empresas contém CNPJ básico conflitante.")
                    company_names[row[0]] = row[1]

        records_path = temp_dir / "records.ndjson"
        matrices = filiais = phones = emails = generic_emails = accounting_emails = staged = 0
        with (
            raw_path.open("r", encoding="utf-8") as source,
            records_path.open("w", encoding="utf-8", newline="\n") as target,
        ):
            for line in source:
                raw = json.loads(line)
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
            input_bytes=sum(int(item["bytes"]) for item in fingerprints),
            rows_scanned=rows_scanned,
            rows_eligible=rows_eligible,
            rows_staged=staged,
            duplicate_rows=duplicates,
            rejected_rows=sum(rejects.values()),
            rejections=dict(sorted(rejects.items())),
            duration_seconds=round(time.perf_counter() - started, 3),
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
        manifest_payload = {
            "summary": asdict(summary),
            "inputs": fingerprints,
            "scope": "27 UFs; todos os municípios; situação 02; CNAE principal farmacêutico humano",
        }
        (temp_dir / "manifest.json").write_text(
            json.dumps(manifest_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        raw_path.unlink()
        if dry_run:
            return summary
        try:
            os.replace(temp_dir, final_dir)
        except FileExistsError:
            return StageSummary(**json.loads(manifest.read_text(encoding="utf-8"))["summary"])
        return summary
    finally:
        tracemalloc.stop()
        if temp_dir.exists():
            shutil.rmtree(temp_dir)


def iter_promotion_batches(
    stage_dir: Path, batch_size: int = 100
) -> Iterator[list[dict[str, str]]]:
    """Remove metadados locais; nunca produz campos comerciais para o upsert."""
    if batch_size < 1 or batch_size > 500:
        raise ReceitaImportError("Tamanho de lote fora do limite.")
    records = stage_dir / "records.ndjson"
    if not (stage_dir / "manifest.json").is_file() or not records.is_file():
        raise ReceitaImportError("Stage incompleto.")
    batch: list[dict[str, str]] = []
    with records.open("r", encoding="utf-8") as stream:
        for line in stream:
            raw = json.loads(line)
            raw.pop("_meta", None)
            record = {key: value for key, value in raw.items() if value != ""}
            if set(record) & {"status", "responsavel", "observacoes", "historico"}:
                raise ReceitaImportError("Stage contém campo comercial proibido.")
            batch.append(record)
            if len(batch) == batch_size:
                yield batch
                batch = []
    if batch:
        yield batch


def build_pilot_stage(stage_dir: Path, output_root: Path, size: int = 100) -> dict[str, Any]:
    """Cria amostra determinística com cobertura de UF/CNAE e bons contatos declarados."""
    if size < 1 or size > 500:
        raise ReceitaImportError("Tamanho do piloto fora do limite.")
    manifest_path = stage_dir / "manifest.json"
    records_path = stage_dir / "records.ndjson"
    if not manifest_path.is_file() or not records_path.is_file():
        raise ReceitaImportError("Stage de origem incompleto.")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    parent = manifest["summary"]
    if _sha256(records_path) != parent["records_sha256"]:
        raise ReceitaImportError("Stage de origem não corresponde ao manifesto.")
    if size > int(parent["rows_staged"]):
        raise ReceitaImportError("Piloto maior que o stage de origem.")

    by_uf: dict[str, list[tuple[tuple[int, str], dict[str, Any]]]] = {}
    by_cnae: dict[str, list[tuple[tuple[int, str], dict[str, Any]]]] = {}

    def offer(
        buckets: dict[str, list[tuple[tuple[int, str], dict[str, Any]]]],
        key: str,
        record: dict[str, Any],
        limit: int,
    ) -> None:
        contact_rank = 0 if record.get("telefone") and record.get("email") else 1
        rank = (contact_rank, hashlib.sha256(record["cnpj"].encode()).hexdigest())
        bucket = buckets.setdefault(key, [])
        bucket.append((rank, record))
        bucket.sort(key=lambda item: item[0])
        del bucket[limit:]

    with records_path.open("r", encoding="utf-8") as source:
        for line in source:
            record = json.loads(line)
            offer(by_uf, record["uf"], record, 20)
            offer(by_cnae, record["cnae"], record, 10)

    required_ufs = set(parent["by_uf"])
    required_cnaes = set(parent["by_cnae"])
    if size < max(len(required_ufs), len(required_cnaes)):
        raise ReceitaImportError("Piloto pequeno demais para representar o stage.")

    selected: dict[str, dict[str, Any]] = {}

    def add(record: dict[str, Any]) -> None:
        selected.setdefault(record["cnpj"], record)

    for uf in sorted(required_ufs):
        if not by_uf.get(uf):
            raise ReceitaImportError("Stage sem candidato para uma UF declarada.")
        add(by_uf[uf][0][1])
    for cnae in sorted(required_cnaes):
        if not any(record["cnae"] == cnae for record in selected.values()):
            cnae_candidates = by_cnae.get(cnae, [])
            if not cnae_candidates:
                raise ReceitaImportError("Stage sem candidato para um CNAE declarado.")
            add(cnae_candidates[0][1])

    candidate_pool = {
        record["cnpj"]: (rank, record)
        for bucket in (*by_uf.values(), *by_cnae.values())
        for rank, record in bucket
    }
    while len(selected) < size:
        uf_counts = Counter(record["uf"] for record in selected.values())
        cities = {(record["uf"], record["cidade"]) for record in selected.values()}
        available = [item for cnpj, item in candidate_pool.items() if cnpj not in selected]
        if not available:
            raise ReceitaImportError("Candidatos insuficientes para montar o piloto.")
        _rank, chosen = min(
            available,
            key=lambda item: (
                uf_counts[item[1]["uf"]],
                (item[1]["uf"], item[1]["cidade"]) in cities,
                item[0],
            ),
        )
        add(chosen)

    sample = sorted(selected.values(), key=lambda record: record["cnpj"])
    sampled_ufs = Counter(record["uf"] for record in sample)
    sampled_cnaes = Counter(record["cnae"] for record in sample)
    if not required_ufs.issubset(sampled_ufs) or not required_cnaes.issubset(sampled_cnaes):
        raise ReceitaImportError("Piloto não cobriu todas as dimensões obrigatórias.")

    sample_key = hashlib.sha256(
        f"{parent['records_sha256']}|{size}|stratified-v1".encode()
    ).hexdigest()[:12]
    stage_id = f"pilot-{size}-{sample_key}"
    final_dir = output_root / stage_id
    if (final_dir / "manifest.json").is_file():
        existing = json.loads((final_dir / "manifest.json").read_text(encoding="utf-8")).get(
            "summary"
        )
        if not isinstance(existing, dict):
            raise ReceitaImportError("Manifesto do piloto inválido.")
        return existing
    output_root.mkdir(parents=True, exist_ok=True)
    temp_dir = Path(tempfile.mkdtemp(prefix="pharmaleads-pilot-", dir=output_root))
    try:
        pilot_records = temp_dir / "records.ndjson"
        pilot_records.write_text("".join(_json_line(record) for record in sample), encoding="utf-8")
        summary = {
            "stage_id": stage_id,
            "parent_stage_id": parent["stage_id"],
            "rows_staged": len(sample),
            "records_sha256": _sha256(pilot_records),
            "by_uf": dict(sorted(sampled_ufs.items())),
            "by_cnae": dict(sorted(sampled_cnaes.items())),
            "matrices": sum(record["_meta"]["matriz_filial"] == "1" for record in sample),
            "filiais": sum(record["_meta"]["matriz_filial"] == "2" for record in sample),
            "with_phone_declared": sum(bool(record.get("telefone")) for record in sample),
            "with_email_declared": sum(bool(record.get("email")) for record in sample),
            "sampling": "stratified-v1: todas as UFs/CNAEs; contatos; diversidade municipal",
        }
        (temp_dir / "manifest.json").write_text(
            json.dumps({"summary": summary}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        os.replace(temp_dir, final_dir)
        return summary
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir)


def g1_report(stage_dir: Path) -> dict[str, Any]:
    manifest = stage_dir / "manifest.json"
    if not manifest.is_file():
        raise ReceitaImportError("Manifesto do stage ausente.")
    summary = json.loads(manifest.read_text(encoding="utf-8"))["summary"]
    denominator = summary["rows_staged"]

    def coverage(count: int) -> float:
        return round((count / denominator * 100) if denominator else 0.0, 2)

    return {
        "gate": "G1",
        "status": "aguarda_decisao_humana",
        "competencia": summary["competencia"],
        "denominador_estabelecimentos": denominator,
        "por_uf": {uf: summary["by_uf"].get(uf, 0) for uf in sorted(VALID_UFS)},
        "por_municipio": summary["by_municipio"],
        "por_cnae": summary["by_cnae"],
        "matrizes": summary["matrices"],
        "filiais": summary["filiais"],
        "telefone_declarado": {
            "quantidade": summary["with_phone_declared"],
            "percentual": coverage(summary["with_phone_declared"]),
            "verificado": False,
        },
        "email_declarado": {
            "quantidade": summary["with_email_declared"],
            "percentual": coverage(summary["with_email_declared"]),
            "verificado": False,
        },
        "email_generico": {"quantidade": summary["with_generic_email"]},
        "email_contabilidade": {"quantidade": summary["with_accounting_email"]},
        "site_conhecido": {
            "quantidade": None,
            "percentual": None,
            "estado": "nao_medido_sem_leitura_dos_leads_existentes",
        },
        "processamento": {
            "duracao_segundos": summary["duration_seconds"],
            "memoria_pico_bytes": summary["peak_memory_bytes"],
            "entrada_bytes": summary["input_bytes"],
            "records_sha256": summary["records_sha256"],
            "rejeitados": summary["rejected_rows"],
            "duplicados": summary["duplicate_rows"],
        },
        "nota": "Contatos são declarações cadastrais da Receita e não foram verificados.",
    }
