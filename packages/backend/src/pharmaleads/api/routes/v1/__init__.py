"""Exporta todos os routers de /v1."""

from pharmaleads.api.routes.v1.me import router as me_router

__all__ = ["me_router"]
