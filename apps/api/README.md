# API M01

O código instalável está em `packages/backend/src/pharmaleads`. A partir da raiz, execute `ops/windows/Setup-M01.ps1` e `ops/windows/Start-Api.ps1`.

Entrada portátil: `python -m pharmaleads.api` com o Python da venv. Entrada ASGI equivalente: `python -m uvicorn pharmaleads.api.main:create_app --factory --host 127.0.0.1 --port 8000 --no-access-log`.

`GET /health`: 200, processo vivo. `GET /ready`: 503, banco/Auth não implementados. OpenAPI em `/openapi.json`; documentação em `/docs`. Nenhuma rota comercial, banco ou autenticação existe no M01. Configuração somente por variáveis `PHARMALEADS_*`; não carregar `.env` legado.
