import pytest

from pharmaleads.infrastructure.osm_overpass import OsmLead, candidates, name_matches, query_for


def lead() -> OsmLead:
    return OsmLead(7, "12345678000190", "Farmácia Exemplo Ltda", "SP", "São Paulo")


def test_query_is_limited_to_sp_and_escapes_name() -> None:
    query = query_for(lead())
    assert "-25.36,-53.11,-19.78,-44.16" in query
    assert "FARMACIA.*EXEMPLO" in query
    with pytest.raises(ValueError, match="UF SP"):
        query_for(OsmLead(8, "123", "Farmácia Exemplo", "RJ", "Rio de Janeiro"))


def test_candidates_accept_only_same_name_and_safe_website() -> None:
    document = {
        "elements": [
            {
                "type": "node",
                "id": 10,
                "tags": {"name": "Farmacia Exemplo", "website": "https://example.test"},
            },
            {
                "type": "node",
                "id": 11,
                "tags": {"name": "Outra Farmácia", "website": "https://other.test"},
            },
            {
                "type": "node",
                "id": 12,
                "tags": {"name": "Farmacia Exemplo Ltda", "website": "ftp://unsafe.test"},
            },
        ]
    }
    found = candidates(lead(), document)
    assert found == (
        {
            "cnpj": "12345678000190",
            "lead_id": 7,
            "osm_element": "node/10",
            "osm_name": "Farmacia Exemplo",
            "source_id": "osm_site_candidate",
            "url": "https://example.test",
        },
    )


def test_name_match_requires_substantial_overlap() -> None:
    assert name_matches("Farmácia Exemplo Ltda", "Farmácia Exemplo Ltda")
    assert not name_matches("Farmácia Exemplo Ltda", "Farmácia Central")
