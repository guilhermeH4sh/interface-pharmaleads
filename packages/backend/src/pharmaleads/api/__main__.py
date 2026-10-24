import uvicorn

from pharmaleads.api.main import create_app
from pharmaleads.config import Settings


def main() -> None:
    app = create_app()
    settings = Settings()
    uvicorn.run(app, host=settings.app_host, port=settings.app_port, access_log=False)


if __name__ == "__main__":
    main()
