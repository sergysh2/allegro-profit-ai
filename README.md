# Allegro Profit AI

Statyczny projekt w stylu SaaS do kalkulacji zysku i demo-analizy produktu Allegro.

## Strony

- `index.html` - kalkulator rentownosci oferty Allegro.
- `analiza-produktu.html` - MVP v2 demo analizy produktu po linku Allegro.
- `wyszukiwarka-okazji.html` - MVP v3 demo wyszukiwarki okazji.
- `roadmap.html` - roadmap projektu.

## Status

- MVP v1: gotowe.
- MVP v2: częściowo gotowe.
- MVP v3: Wyszukiwarka okazji demo - gotowe.

## MVP v2 demo

Strona `analiza-produktu.html` nie laczy sie jeszcze z prawdziwym API Allegro. Po kliknieciu `Analizuj` wybiera jeden z lokalnych scenariuszy:

- link zawiera `toy` albo `zabawka` - dobry potencjal;
- link zawiera `phone` albo `telefon` - wysoka konkurencja;
- zwykly link - sredni potencjal.

Wynik pokazuje:

- Nazwa produktu
- Cena sprzedazy
- Prowizja Allegro
- Koszt dostawy
- Szacowany zysk netto
- Marza %
- ROI %
- Poziom konkurencji
- Ocena potencjalu 1-10
- Rekomendacja

## Uruchomienie

Otworz plik `index.html`, `analiza-produktu.html`, `wyszukiwarka-okazji.html` lub `roadmap.html` w przegladarce.

Jesli chcesz uruchomic lokalny serwer:

```powershell
cd "C:\Users\Computer\Documents\Codex\2026-06-11\allegro-profit-ai-1-2-3"
python -m http.server 8080 --bind 127.0.0.1
```

Adresy:

```text
http://127.0.0.1:8080/index.html
http://127.0.0.1:8080/analiza-produktu.html
http://127.0.0.1:8080/wyszukiwarka-okazji.html
http://127.0.0.1:8080/roadmap.html
```
