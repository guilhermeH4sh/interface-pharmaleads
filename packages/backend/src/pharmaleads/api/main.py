import logging
from collections.abc import Awaitable, Callable
from http.client import HTTPException as HttpClientException
from uuid import UUID, uuid4

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ValidationError
from pydantic_settings import SettingsError
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException

from pharmaleads.api.errors import ErrorEnvelope, error_response
from pharmaleads.config import Settings
from pharmaleads.infrastructure import data_api

logger = logging.getLogger("pharmaleads.api")


class Health(BaseModel):
    status: str
    module: str


class SupabaseHealth(BaseModel):
    status: str
    table: str
    method: str
    rows_returned: int


def create_app() -> FastAPI:
    try:
        settings = Settings()
    except ValidationError as exc:
        # Não imprimir valores recebidos, strings de conexão ou o traceback do validador.
        fields = sorted({str(error["loc"][0]) for error in exc.errors()})
        raise RuntimeError("Configuração inválida: " + ", ".join(fields)) from None
    except SettingsError:
        raise RuntimeError("Configuração inválida: verifique o JSON em PHARMALEADS_*. ") from None

    app = FastAPI(title="PharmaLeads", version="0.1.0", debug=False)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET"],
        allow_headers=["X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    @app.middleware("http")
    async def request_context(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        supplied = request.headers.get("X-Request-ID", "")
        try:
            request_id = str(UUID(supplied)) if len(supplied) == 36 else str(uuid4())
        except ValueError:
            request_id = str(uuid4())
        request.state.request_id = request_id
        try:
            response = await call_next(request)
        except Exception:
            # Fronteira HTTP: erro inesperado vira 500, nunca sucesso falso.
            # Log mínimo correlacionado, sem mensagem da exceção/payload/URL.
            logger.error("event=request_failed error_code=INTERNAL_ERROR request_id=%s", request_id)
            response = error_response(request, 500, "INTERNAL_ERROR", "Erro interno na API.")
        response.headers["X-Request-ID"] = request_id
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> Response:
        messages = {
            404: ("NOT_FOUND", "Recurso não encontrado."),
            405: ("METHOD_NOT_ALLOWED", "Método não permitido."),
        }
        code, message = messages.get(exc.status_code, ("HTTP_ERROR", "Requisição não atendida."))
        response = error_response(request, exc.status_code, code, message)
        if exc.headers and "Allow" in exc.headers:
            response.headers["Allow"] = exc.headers["Allow"]
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> Response:
        return error_response(request, 422, "VALIDATION_ERROR", "Parâmetros inválidos.")

    @app.get("/health", response_model=Health)
    async def health() -> Health:
        return Health(status="alive", module="M01")

    @app.get("/health/supabase", response_model=SupabaseHealth)
    async def supabase_health(request: Request) -> SupabaseHealth | Response:
        key = settings.data_api_publishable_key
        if key is None:
            return error_response(
                request, 503, "SUPABASE_NOT_CONFIGURED", "Conexão Supabase não configurada."
            )
        try:
            status = await run_in_threadpool(data_api.probe, key.get_secret_value())
        except (ValueError, OSError, HttpClientException):
            return error_response(
                request, 503, "SUPABASE_UNAVAILABLE", "Conexão Supabase indisponível."
            )
        if status not in {200, 206}:
            return error_response(
                request, 503, "SUPABASE_UNAVAILABLE", "Conexão Supabase indisponível."
            )
        return SupabaseHealth(
            status="connected", table="public.pharmaleads", method="HEAD", rows_returned=0
        )

    @app.get("/ready", status_code=503, response_model=ErrorEnvelope)
    async def ready(request: Request) -> Response:
        # M01 não implementa conexão DB/Auth. Nunca declarar prontidão comercial.
        return error_response(
            request,
            503,
            "DEPENDENCIES_NOT_IMPLEMENTED",
            "Fundação disponível; banco e autenticação aguardam M02 e M03.",
        )

    return app
