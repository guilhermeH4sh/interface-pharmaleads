#!/usr/bin/env python3
"""
Gosom de mentira, só para testar o PharmaLeads sem acessar o Google.

Entende as mesmas opções do gosom (-input, -results, -email...) e escreve um CSV
com as colunas reais. Para cada busca, "encontra" 3 farmácias da cidade:
  0 -> celular + site (+ e-mail se -email)
  1 -> telefone fixo, "Temporarily closed"
  2 -> sem telefone, status "CLOSED"
"""
import csv
import sys

COLUNAS = [
    "input_id", "link", "title", "category", "address", "open_hours", "popular_times", "website",
    "phone", "plus_code", "review_count", "review_rating", "reviews_per_rating", "latitude",
    "longitude", "cid", "status", "descriptions", "reviews_link", "thumbnail", "timezone",
    "price_range", "data_id", "street_view_url", "place_id", "images", "reservations",
    "order_online", "menu", "owner", "complete_address", "credit_cards_accepted", "about",
    "user_reviews", "user_reviews_extended", "emails",
]


def main() -> None:
    a = sys.argv
    if "-h" in a or "-help" in a:
        print("Usage of gosom_falso:\n  -input string\n  -results string\n  -depth int\n  -lang string\n"
              "  -exit-on-inactivity duration\n  -email\n  -proxies string\n  -c int")
        return
    entrada = a[a.index("-input") + 1]
    saida = a[a.index("-results") + 1]
    com_email = "-email" in a

    with open(saida, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUNAS)
        w.writeheader()
        for linha in open(entrada, encoding="utf-8").read().splitlines():
            if not linha.strip():
                continue
            texto, _, rotulo = linha.partition("#!#")
            cidade = texto.split(" em ", 1)[1].strip()
            for i in range(3):
                reg = dict.fromkeys(COLUNAS, "")
                reg.update(
                    input_id=rotulo.strip(), title=f"Farmácia {cidade} {i}", category="Farmácia",
                    address=f"Rua {i}, {cidade}", latitude="-23.5", longitude="-47.4",
                    cid=f"cid-{cidade}-{i}", link=f"https://maps.example/{cidade}/{i}",
                    review_count="10", review_rating="4.5",
                )
                if i == 0:
                    reg.update(phone="(15) 99999-0000", website="https://farmacia0.example.com.br",
                               emails="contato@farmacia0.example.com.br" if com_email else "")
                elif i == 1:
                    reg.update(phone="(15) 3232-0001", status="Temporarily closed")
                else:
                    reg.update(status="CLOSED")
                w.writerow(reg)


if __name__ == "__main__":
    main()
