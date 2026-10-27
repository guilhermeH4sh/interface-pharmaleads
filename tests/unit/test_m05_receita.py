"""M05: recorte Receita, ZIP seguro, idempotência, filiais e G1."""

from __future__ import annotations

import csv
import io
import json
import zipfile
from datetime import date
from pathlib import Path
from unittest.mock import MagicMock, Mock

import pytest

from pharmaleads.domain.receita.pipeline import (
    ReceitaImportError,
    build_pilot_stage,
    build_stage,
    g1_report,
    iter_promotion_batches,
    validate_layout,
)
from pharmaleads.domain.receita.scope import (
    PHARMACEUTICAL_HUMAN_CNAES,
    VETERINARY_CNAES,
    is_eligible,
)
from pharmaleads.infrastructure import data_api_writer
from pharmaleads.infrastructure.data_api_writer import PharmaleadsWriter


def _cnpj(body: str) -> str:
    result = body
    for weights in (
        (5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2),
        (6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2),
    ):
        remainder = (
            sum((ord(char) - 48) * weight for char, weight in zip(result, weights, strict=True))
            % 11
        )
        result += str(0 if remainder < 2 else 11 - remainder)
    return result


def _csv(rows: list[list[str]]) -> bytes:
    text = io.StringIO(newline="")
    csv.writer(text, delimiter=";", quotechar='"', lineterminator="\n").writerows(rows)
    return text.getvalue().encode("latin-1")


def _establishment(cnpj: str, *, branch: str, cnae: str = "4771701") -> list[str]:
    row = [""] * 30
    row[0:3] = [cnpj[:8], cnpj[8:12], cnpj[12:]]
    row[3] = branch
    row[4] = f"FARMACIA {branch}"
    row[5] = "02"
    row[11] = cnae
    row[13:19] = ["RUA", "CENTRAL", "10", "", "CENTRO", "01001000"]
    row[19:23] = ["SP", "7107", "11", "33334444"]
    row[27] = "CONTATO@EXAMPLE.COM"
    return row


def _fixture(tmp_path: Path) -> list[Path]:
    base = "A1234567"
    matrix = _cnpj(base + "0001")
    branch = _cnpj(base + "0002")
    vet = _cnpj("123456780003")
    archive_path = tmp_path / "rfb.zip"
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "K3241.K03200Y0.D60101.EMPRECSV", _csv([[base, "FARMA BRASIL", "", "", "", "", ""]])
        )
        archive.writestr(
            "K3241.K03200Y0.D60101.ESTABELE",
            _csv(
                [
                    _establishment(matrix, branch="1"),
                    _establishment(branch, branch="2"),
                    _establishment(branch, branch="2"),
                    _establishment(vet, branch="1", cnae="4771704"),
                ]
            ),
        )
        archive.writestr("K3241.K03200Y0.D60101.MUNICCSV", _csv([["7107", "SAO PAULO"]]))
    return [archive_path]


def test_scope_has_human_chain_and_excludes_veterinary() -> None:
    assert {"2110600", "2121101", "2123800", "4644301", "4771701"}.issubset(
        PHARMACEUTICAL_HUMAN_CNAES
    )
    assert PHARMACEUTICAL_HUMAN_CNAES.isdisjoint(VETERINARY_CNAES)
    assert is_eligible(uf="AC", main_cnae="4771702", registration_status="02")
    assert not is_eligible(uf="SP", main_cnae="4771704", registration_status="02")
    assert not is_eligible(uf="SP", main_cnae="4771701", registration_status="08")


def test_import_is_idempotent_and_keeps_branches_independent(tmp_path: Path) -> None:
    inputs = _fixture(tmp_path)
    output = tmp_path / "stage"
    first = build_stage(inputs, output, date(2026, 10, 1))
    second = build_stage(inputs, output, date(2026, 10, 1))

    assert first == second
    assert first.rows_scanned == 4
    assert first.rows_eligible == 3
    assert first.rows_staged == 2
    assert first.duplicate_rows == 1
    assert first.matrices == 1 and first.filiais == 1
    assert first.by_uf == {"SP": 2}
    assert len(first.records_sha256) == 64
    batches = list(iter_promotion_batches(output / first.stage_id, batch_size=1))
    assert len(batches) == 2
    assert batches[0][0]["cnpj"][:8] == batches[1][0]["cnpj"][:8]
    assert batches[0][0]["cnpj"] != batches[1][0]["cnpj"]
    assert all("_meta" not in record for batch in batches for record in batch)


def test_g1_labels_declared_contacts_as_unverified(tmp_path: Path) -> None:
    summary = build_stage(_fixture(tmp_path), tmp_path / "stage", date(2026, 10, 1))
    report = g1_report(tmp_path / "stage" / summary.stage_id)
    assert report["status"] == "aguarda_decisao_humana"
    assert report["denominador_estabelecimentos"] == 2
    assert report["telefone_declarado"] == {
        "quantidade": 2,
        "percentual": 100.0,
        "verificado": False,
    }
    assert report["email_declarado"]["verificado"] is False
    assert report["email_generico"]["quantidade"] == 2
    assert report["site_conhecido"]["quantidade"] is None


def test_layout_change_is_rejected_without_stage(tmp_path: Path) -> None:
    archive_path = tmp_path / "bad-layout.zip"
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("EMPRECSV", _csv([[""] * 7]))
        archive.writestr("ESTABELE", _csv([[""] * 29]))
        archive.writestr("MUNICCSV", _csv([["1", "X"]]))
    with pytest.raises(ReceitaImportError, match="Layout alterado"):
        validate_layout([archive_path])
    assert not (tmp_path / "stage").exists()


def test_hostile_zip_path_is_rejected(tmp_path: Path) -> None:
    archive_path = tmp_path / "hostile.zip"
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("../EMPRECSV", _csv([[""] * 7]))
        archive.writestr("ESTABELE", _csv([[""] * 30]))
        archive.writestr("MUNICCSV", _csv([["1", "X"]]))
    with pytest.raises(ReceitaImportError, match="caminho inseguro"):
        validate_layout([archive_path])


def test_promotion_upsert_never_sends_commercial_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    writer = PharmaleadsWriter(
        "sb_publishable_fixture", source_id="receita_cnpj", access_token="a.b.c"
    )
    network = Mock(return_value=(201, b""))
    monkeypatch.setattr(writer, "_request_unchecked", network)
    record = {
        "cnpj": _cnpj("123456780001"),
        "nome": "FARMACIA",
        "razao_social": "FARMACIA LTDA",
        "uf": "SP",
        "cidade": "SAO PAULO",
        "cnae": "4771701",
        "origem": "Receita Federal - Dados Abertos CNPJ",
    }
    assert writer.upsert_cadastral([record]) == 1
    method, path, payload = network.call_args.args
    assert method == "POST" and "on_conflict=cnpj" in path
    assert payload == [record]
    assert not (set(payload[0]) & {"status", "responsavel", "observacoes", "historico"})


def test_authenticated_writer_sends_bearer_without_exposing_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connection = MagicMock()
    connection.getresponse.return_value.status = 201
    constructor = MagicMock(return_value=connection)
    monkeypatch.setattr(data_api_writer, "HTTPSConnection", constructor)
    writer = PharmaleadsWriter(
        "sb_publishable_fixture", source_id="receita_cnpj", access_token="header.payload.sig"
    )
    assert (
        writer._request_unchecked("POST", "/rest/v1/pharmaleads?on_conflict=cnpj", [{"cnpj": "x"}])[
            0
        ]
        == 201
    )
    headers = connection.request.call_args.kwargs["headers"]
    assert headers["Authorization"] == "Bearer header.payload.sig"
    assert headers["Prefer"] == "resolution=merge-duplicates,return=minimal"
    assert "header.payload.sig" not in repr(writer)


def test_stage_manifest_does_not_contain_row_values(tmp_path: Path) -> None:
    summary = build_stage(_fixture(tmp_path), tmp_path / "stage", date(2026, 10, 1))
    manifest = (tmp_path / "stage" / summary.stage_id / "manifest.json").read_text()
    assert "CONTATO@EXAMPLE.COM" not in manifest
    assert "FARMA BRASIL" not in manifest
    assert json.loads(manifest)["summary"]["rows_staged"] == 2


def test_pilot_stage_is_deterministic_and_representative(tmp_path: Path) -> None:
    summary = build_stage(_fixture(tmp_path), tmp_path / "stage", date(2026, 10, 1))
    source = tmp_path / "stage" / summary.stage_id
    first = build_pilot_stage(source, tmp_path / "pilots", size=2)
    second = build_pilot_stage(source, tmp_path / "pilots", size=2)

    assert first == second
    assert first["rows_staged"] == 2
    assert first["by_uf"] == {"SP": 2}
    assert first["by_cnae"] == {"4771701": 2}
    batches = list(iter_promotion_batches(tmp_path / "pilots" / first["stage_id"], 100))
    assert len(batches) == 1 and len(batches[0]) == 2
