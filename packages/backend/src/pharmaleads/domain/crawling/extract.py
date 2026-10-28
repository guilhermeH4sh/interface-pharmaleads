"""Extração limitada de contatos explicitamente publicados em HTML autorizado."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit

from parsel import Selector

from pharmaleads.domain.crawling.models import ContactKind, ObservationCandidate

EXTRACTOR_VERSION = "m08-http-v1"
EMAIL_PATTERN = re.compile(r"^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,63}$")
PHONE_DIGITS = re.compile(r"\d")


@dataclass(frozen=True)
class ExtractionResult:
    observations: tuple[ObservationCandidate, ...]
    malformed_jsonld: int = 0


def _email(value: str) -> str | None:
    candidate = unquote(value).split("?", 1)[0].strip()
    if not EMAIL_PATTERN.fullmatch(candidate):
        return None
    local, domain = candidate.rsplit("@", 1)
    return f"{local}@{domain.lower()}"


def _phone(value: str) -> str | None:
    candidate = unquote(value).split("?", 1)[0].strip()
    digits = "".join(PHONE_DIGITS.findall(candidate))
    return candidate if 8 <= len(digits) <= 15 else None


def _whatsapp(value: str) -> str | None:
    parsed = urlsplit(value.strip())
    host = (parsed.hostname or "").lower()
    candidate = ""
    if parsed.scheme.lower() == "whatsapp":
        candidate = parse_qs(parsed.query).get("phone", [""])[0]
    elif host in {"wa.me", "www.wa.me"}:
        candidate = parsed.path.strip("/").split("/", 1)[0]
    elif host in {"api.whatsapp.com", "web.whatsapp.com"}:
        candidate = parse_qs(parsed.query).get("phone", [""])[0]
    digits = "".join(PHONE_DIGITS.findall(unquote(candidate)))
    return digits if 8 <= len(digits) <= 15 else None


def _jsonld_values(value: Any) -> tuple[list[str], list[str]]:
    emails: list[str] = []
    phones: list[str] = []
    if isinstance(value, list):
        for item in value:
            item_emails, item_phones = _jsonld_values(item)
            emails.extend(item_emails)
            phones.extend(item_phones)
    elif isinstance(value, dict):
        for key, item in value.items():
            normalized = key.casefold()
            values = item if isinstance(item, list) else [item]
            if normalized == "email":
                emails.extend(str(entry) for entry in values if isinstance(entry, str))
            elif normalized == "telephone":
                phones.extend(str(entry) for entry in values if isinstance(entry, str))
            elif isinstance(item, (dict, list)):
                item_emails, item_phones = _jsonld_values(item)
                emails.extend(item_emails)
                phones.extend(item_phones)
    return emails, phones


def _observation(
    lead_id: int,
    source_id: str,
    kind: ContactKind,
    raw_value: str,
    observed_at: datetime,
    source_url: str,
) -> ObservationCandidate:
    digest = hashlib.sha256(
        f"{source_url}\0{kind.value}\0{raw_value}".encode()
    ).hexdigest()
    return ObservationCandidate(
        lead_id=lead_id,
        source_id=source_id,
        kind=kind,
        raw_value=raw_value,
        observed_at=observed_at,
        source_url=source_url,
        extractor_version=EXTRACTOR_VERSION,
        evidence_hash=digest,
    )


def extract_contacts(
    html: str,
    *,
    lead_id: int,
    source_id: str,
    source_url: str,
    observed_at: datetime,
) -> ExtractionResult:
    selector = Selector(text=html, type="html")
    found: dict[tuple[ContactKind, str], ObservationCandidate] = {}

    def add(kind: ContactKind, raw_value: str | None) -> None:
        if raw_value is None:
            return
        found.setdefault(
            (kind, raw_value),
            _observation(lead_id, source_id, kind, raw_value, observed_at, source_url),
        )

    for href in selector.css("a::attr(href)").getall():
        lower = href.strip().lower()
        if lower.startswith("mailto:"):
            add(ContactKind.EMAIL, _email(href[7:]))
        elif lower.startswith("tel:"):
            add(ContactKind.PHONE, _phone(href[4:]))
        elif lower.startswith(("whatsapp:", "https://wa.me/", "http://wa.me/")) or (
            "whatsapp.com" in (urlsplit(href).hostname or "").lower()
        ):
            add(ContactKind.WHATSAPP, _whatsapp(href))

    malformed = 0
    for raw_json in selector.css('script[type="application/ld+json"]::text').getall():
        try:
            value = json.loads(raw_json)
        except (TypeError, ValueError):
            malformed += 1
            continue
        emails, phones = _jsonld_values(value)
        for value_email in emails:
            add(ContactKind.EMAIL, _email(value_email.removeprefix("mailto:")))
        for value_phone in phones:
            add(ContactKind.PHONE, _phone(value_phone.removeprefix("tel:")))

    ordered = tuple(sorted(found.values(), key=lambda item: (item.kind.value, item.raw_value)))
    return ExtractionResult(ordered, malformed)
