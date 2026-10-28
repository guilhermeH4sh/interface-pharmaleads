"""Smoke M08 em servidor loopback controlado; nunca usado para URLs reais."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from urllib.parse import urlsplit

from scrapy.crawler import CrawlerRunner
from scrapy.utils.reactor import install_reactor

SELECT_REACTOR = "twisted.internet.selectreactor.SelectReactor"
install_reactor(SELECT_REACTOR)

from twisted.internet import task  # noqa: E402
from twisted.python.failure import Failure  # noqa: E402

from pharmaleads.domain.sites.security import EgressTarget  # noqa: E402
from pharmaleads.infrastructure import institutional_spider  # noqa: E402
from pharmaleads.infrastructure.institutional_spider import InstitutionalSpider  # noqa: E402


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/robots.txt":
            body = b"User-agent: *\nAllow: /\n"
            content_type = "text/plain"
        elif self.path == "/":
            body = (
                b'<html><a href="mailto:contato@example.com">Email</a>'
                b'<a href="/contato">Contato</a></html>'
            )
            content_type = "text/html"
        elif self.path == "/contato":
            body = (
                b'<html><a href="https://wa.me/5511999998888">WhatsApp</a>'
                b'<script type="application/ld+json">'
                b'{"@type":"Organization","telephone":"+55 11 3333-4444"}'
                b"</script></html>"
            )
            content_type = "text/html"
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format: str, *_args: object) -> None:
        return


def controlled_plan(raw_url: str) -> EgressTarget:
    parsed = urlsplit(raw_url)
    port = parsed.port or 80
    path = parsed.path or "/"
    return EgressTarget(
        url=raw_url,
        scheme="http",
        host="127.0.0.1",
        port=port,
        path_and_query=path,
        addresses=("127.0.0.1",),
    )


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    Thread(target=server.serve_forever, daemon=True).start()
    start_url = f"http://127.0.0.1:{server.server_port}/"
    institutional_spider.plan_egress = controlled_plan  # type: ignore[attr-defined, assignment]
    runner = CrawlerRunner({"TWISTED_REACTOR": SELECT_REACTOR})
    crawler = runner.create_crawler(InstitutionalSpider)
    crawler.settings.set(
        "DOWNLOADER_MIDDLEWARES",
        {
            "pharmaleads.infrastructure.scrapy_egress.SafeEgressMiddleware": None,
            "pharmaleads.infrastructure.scrapy_retry.RetryAfterMiddleware": None,
        },
        priority="cmdline",
    )
    crawler.settings.set(
        "DOWNLOAD_HANDLERS",
        {"http": "scrapy.core.downloader.handlers.http11.HTTP11DownloadHandler"},
        priority="cmdline",
    )

    def run(_reactor: object):  # type: ignore[no-untyped-def]
        deferred = runner.crawl(
            crawler,
            lead_id=60,
            cnpj="40809626000168",
            start_url=start_url,
            site_review_version=2,
        )

        def verify(result: object) -> object:
            try:
                if isinstance(result, Failure):
                    return result
                spider = crawler.spider
                assert isinstance(spider, InstitutionalSpider)
                observed = {(item.kind.value, item.raw_value) for item in spider.observations}
                assert observed == {
                    ("email", "contato@example.com"),
                    ("telefone", "+55 11 3333-4444"),
                    ("whatsapp", "5511999998888"),
                }
                assert crawler.stats.get_value("m08/pages_parsed") == 2
                print(
                    json.dumps(
                        {"observations": len(observed), "pages_parsed": 2, "robots": True},
                        sort_keys=True,
                    )
                )
                return result
            finally:
                server.shutdown()
                server.server_close()

        deferred.addBoth(verify)
        return deferred

    task.react(run)


if __name__ == "__main__":
    main()
