"""Engine síncrono limitado; transações pertencem ao caso de uso."""

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from pharmaleads.infrastructure.database.settings import DatabaseSettings


def database_engine(settings: DatabaseSettings, *, migration: bool = False) -> Engine:
    if migration:
        return create_engine(
            settings.sqlalchemy_url(),
            connect_args=settings.connect_args(),
            poolclass=NullPool,
            echo=False,
            hide_parameters=True,
        )
    return create_engine(
        settings.sqlalchemy_url(),
        connect_args=settings.connect_args(),
        pool_pre_ping=True,
        echo=False,
        hide_parameters=True,
        pool_size=settings.pool_size,
        max_overflow=0,
        pool_timeout=5,
    )


def sessions(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
