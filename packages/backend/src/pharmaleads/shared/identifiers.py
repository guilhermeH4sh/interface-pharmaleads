"""CNPJ textual; DV conforme manual oficial da Receita Federal (ASCII - 48)."""

import re


def normalize_cnpj(value: str) -> str:
    """Aceita formato canônico ou máscara completa, sem descartar outros caracteres."""
    if not value.isascii():
        raise ValueError("CNPJ inválido.")
    candidate = value.strip().upper()
    if re.fullmatch(r"[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}/[A-Z0-9]{4}-[0-9]{2}", candidate):
        candidate = candidate.translate(str.maketrans("", "", "./-"))
    if not re.fullmatch(r"[A-Z0-9]{12}[0-9]{2}", candidate) or len(set(candidate)) == 1:
        raise ValueError("CNPJ inválido.")
    body = candidate[:12]
    for weights in ((5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2), (6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)):
        remainder = sum((ord(c) - 48) * w for c, w in zip(body, weights, strict=True)) % 11
        body += str(0 if remainder < 2 else 11 - remainder)
    if body != candidate:
        raise ValueError("CNPJ inválido.")
    return candidate
