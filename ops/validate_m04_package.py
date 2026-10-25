"""Smoke test do wheel em Uvicorn real, sem fonte externa nem acesso ao Supabase."""

from __future__ import annotations

import argparse
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import zipfile
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, Request, build_opener

import jwt

SECRET = "m04-package-smoke-only-secret-over-32-bytes"
ISSUER = "https://qxsdcrywsjkrpcbfgbxb.supabase.co/auth/v1"


def token(role: str) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": "11111111-1111-1111-1111-111111111111",
            "aud": "authenticated",
            "iss": ISSUER,
            "iat": now,
            "exp": now + timedelta(minutes=5),
            "app_metadata": {"role": role},
        },
        SECRET,
        algorithm="HS256",
    )


def request(
    base: str, path: str, role: str | None = None, method: str = "GET"
) -> tuple[int, object]:
    headers = {"Authorization": f"Bearer {token(role)}"} if role else {}
    call = Request(base + path, method=method, headers=headers)
    try:
        with build_opener(ProxyHandler({})).open(call, timeout=2) as response:
            return response.status, json.loads(response.read())
    except HTTPError as error:
        return error.code, json.loads(error.read())


@contextmanager
def server(env: dict[str, str], cwd: Path) -> Iterator[str]:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    process = subprocess.Popen(
        [
            sys.executable,
            "-B",
            "-m",
            "uvicorn",
            "pharmaleads.api.main:create_app",
            "--factory",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--no-access-log",
        ],
        env=env,
        cwd=cwd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    base = f"http://127.0.0.1:{port}"
    try:
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError("API do artefato encerrou antes de iniciar.")
            try:
                if request(base, "/health")[0] == 200:
                    break
            except (URLError, OSError):
                time.sleep(0.1)
        else:
            raise RuntimeError("API do artefato não iniciou dentro do prazo.")
        yield base
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


def publish(path: Path, state: str, revision: str) -> None:
    document = {
        "schema_version": 1,
        "revision": revision,
        "sources": [
            {
                "id": "package-fixture",
                "nome": "Fonte sintética",
                "tipo": "csv_manual",
                "estado": state,
                "descricao": "Smoke test",
                "licenca": "Sintética",
                "termos": "Somente teste",
                "finalidade": "Verificar implantação",
                "aprovado_por": "fixture-reviewer",
                "aprovado_em": "2026-01-01",
            }
        ],
        "policies": [],
        "history": [],
    }
    pending = path.with_suffix(".next")
    pending.write_text(json.dumps(document), encoding="utf-8")
    pending.replace(path)


def validate(wheel: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="m04-package-") as temporary:
        root = Path(temporary)
        site = root / "site"
        work = root / "work"
        work.mkdir()
        with zipfile.ZipFile(wheel) as archive:
            for name in archive.namelist():
                if not (site / name).resolve().is_relative_to(site.resolve()):
                    raise ValueError("Caminho inválido no wheel.")
            archive.extractall(site)
        # Não herda variáveis PharmaLeads ou PYTHONPATH do ambiente real.
        env = {
            key: value
            for key, value in os.environ.items()
            if not key.startswith("PHARMALEADS_") and key not in {"PYTHONPATH", "PYTHONHOME"}
        }
        env.update(
            {
                "PYTHONPATH": str(site),
                "PYTHONDONTWRITEBYTECODE": "1",
                "PHARMALEADS_APP_ENV": "test",
                "PHARMALEADS_SUPABASE_JWT_SECRET": SECRET,
            }
        )
        # Garante que o pacote importado é o wheel extraído, não o checkout editável.
        subprocess.run(
            [
                sys.executable,
                "-B",
                "-c",
                "import os, pathlib, pharmaleads; "
                "assert pathlib.Path(pharmaleads.__file__).resolve().is_relative_to("
                "pathlib.Path(os.environ['PYTHONPATH']).resolve())",
            ],
            env=env,
            cwd=work,
            check=True,
            timeout=15,
        )
        with server(env, work) as base:
            assert request(base, "/v1/sources")[0] == 401
            assert request(base, "/v1/sources", "admin") == (200, [])
            assert request(base, "/v1/sources", "comercial")[0] == 403
            assert request(base, "/v1/sources", "admin", "POST")[0] == 405
            assert request(base, "/ready")[0] == 503
        assert list(work.iterdir()) == [], (
            "A aplicação criou armazenamento no diretório de execução."
        )
        config = root / "published.json"
        publish(config, "aprovada", "smoke-1")
        env["PHARMALEADS_SOURCE_POLICY_PATH"] = str(config)
        with server(env, work) as base:
            status, body = request(base, "/v1/sources", "admin")
            assert status == 200 and isinstance(body, list) and body[0]["estado"] == "aprovada"
            publish(config, "revogada", "smoke-2")
            status, body = request(base, "/v1/sources", "admin")
            assert status == 200 and isinstance(body, list) and body[0]["estado"] == "revogada"
        with server(env, work) as base:
            status, body = request(base, "/v1/sources", "admin")
            assert status == 200 and isinstance(body, list) and body[0]["estado"] == "revogada"
        assert list(work.iterdir()) == []
    print(
        "PASSOU: wheel isolado; HTTP real; JWT/escopos; somente leitura; "
        "recarga e reinício; sem banco auxiliar."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wheel", required=True, type=Path)
    validate(parser.parse_args().wheel.resolve())
