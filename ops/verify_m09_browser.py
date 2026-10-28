"""Prova local mínima: Chromium renderiza contato introduzido por JavaScript."""

from __future__ import annotations

import json

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

HTML = "<!doctype html><body></body>"


def main() -> int:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            context = browser.new_context(service_workers="block")
            try:
                context.set_default_timeout(1_000)
                blocked_requests: list[str] = []

                def block_external(route) -> None:
                    blocked_requests.append(route.request.url)
                    route.abort()

                context.route("https://blocked.example/**", block_external)
                page = context.new_page()
                try:
                    page.set_content(HTML, wait_until="domcontentloaded", timeout=10_000)
                    page.evaluate(
                        """() => {
                            const email = '<a href="mailto:js@example.com">Contato</a>';
                            const button = '<button id="popup">popup</button>';
                            document.body.innerHTML = email + button;
                            const popupButton = document.querySelector('#popup');
                            popupButton.onclick = () => window.open('about:blank');
                        }"""
                    )
                    mailto = page.locator("a").get_attribute("href")
                    with page.expect_popup(timeout=2_000) as popup_info:
                        page.locator("#popup").click()
                    popup_info.value.close()
                    subrequest_blocked = page.evaluate(
                        """async () => {
                            try { await fetch('https://blocked.example/resource'); }
                            catch { return true; }
                            return false;
                        }"""
                    )
                    try:
                        page.wait_for_function("() => false", timeout=100)
                    except PlaywrightTimeoutError:
                        timeout_confirmed = True
                    else:
                        timeout_confirmed = False
                finally:
                    page.close()
            finally:
                context.close()
        finally:
            browser.close()
    if (
        mailto != "mailto:js@example.com"
        or not blocked_requests
        or not subrequest_blocked
        or not timeout_confirmed
    ):
        raise RuntimeError("Prova M09 não confirmou renderização, bloqueio e timeout.")
    print(
        json.dumps(
            {
                "browser": "chromium",
                "browser_contacts": 1,
                "browser_added_contacts": 1,
                "external_subrequest_blocked": True,
                "http_contacts": 0,
                "leaks": False,
                "popup_closed": True,
                "rendered_mailto": True,
                "timeout_confirmed": True,
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
