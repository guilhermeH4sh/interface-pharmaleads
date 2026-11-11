"""Identificação conservadora de CNPJ publicado pelo próprio estabelecimento."""
from __future__ import annotations

import re

PADRAO = re.compile(r'(?<!\d)(?:\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2})(?!\d)')


def valido(valor: str) -> bool:
    numeros = re.sub(r'\D', '', valor)
    if len(numeros) != 14 or len(set(numeros)) == 1:
        return False
    for tamanho, pesos in ((12, (5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)),
                           (13, (6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2))):
        resto = sum(int(d) * p for d, p in zip(numeros[:tamanho], pesos)) % 11
        if int(numeros[tamanho]) != (0 if resto < 2 else 11 - resto):
            return False
    return True


def unico_publicado(texto: str) -> str:
    """Ignora páginas que citam mais de uma empresa ou CNPJ inválido."""
    encontrados = {re.sub(r'\D', '', match.group()) for match in PADRAO.finditer(texto)
                   if re.search(r'cnpj\s*[:#ºn.\-]*\s*$', texto[max(0, match.start() - 24):match.start()], re.I)}
    validos = {numero for numero in encontrados if valido(numero)}
    return next(iter(validos)) if len(validos) == 1 else ''
