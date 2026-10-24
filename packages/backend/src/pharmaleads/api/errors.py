from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: None = None
    request_id: str


class ErrorEnvelope(BaseModel):
    error: ErrorDetail


def error_response(request: Request, status: int, code: str, message: str) -> JSONResponse:
    content: dict[str, Any] = ErrorEnvelope(
        error=ErrorDetail(code=code, message=message, request_id=request.state.request_id)
    ).model_dump()
    return JSONResponse(content=content, status_code=status)
