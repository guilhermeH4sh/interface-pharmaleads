"""Recorte nacional aprovado para o piloto M05."""

VALID_UFS = frozenset(
    "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split()
)

# CNAE 2.3/CONCLA: cadeia farmacêutica humana, da fabricação ao varejo.
PHARMACEUTICAL_HUMAN_CNAES = frozenset(
    {
        "2110600",  # fabricação de produtos farmoquímicos
        "2121101",  # medicamentos alopáticos para uso humano
        "2121102",  # medicamentos homeopáticos para uso humano
        "2121103",  # medicamentos fitoterápicos para uso humano
        "2123800",  # preparações farmacêuticas
        "4644301",  # atacado de medicamentos e drogas de uso humano
        "4771701",  # varejo sem manipulação
        "4771702",  # varejo com manipulação
        "4771703",  # varejo de produtos homeopáticos
    }
)

VETERINARY_CNAES = frozenset({"2122000", "4644302", "4771704"})
ACTIVE_REGISTRATION_STATUS = "02"


def is_eligible(*, uf: str, main_cnae: str, registration_status: str) -> bool:
    """Aplica o recorte aprovado sem inferir elegibilidade por CNAE secundário."""
    return (
        uf in VALID_UFS
        and main_cnae in PHARMACEUTICAL_HUMAN_CNAES
        and main_cnae not in VETERINARY_CNAES
        and registration_status == ACTIVE_REGISTRATION_STATUS
    )
