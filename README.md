# Allegro Profit AI

Statyczny frontend w stylu SaaS oraz przygotowany backend Node.js pod przyszle polaczenie z Allegro API OAuth.

## Strony frontend

- `index.html` - MVP v8 Main Business Dashboard z KPI sklepu, najlepszymi produktami, ostatnimi zamowieniami i alertami.
- `analiza-produktu.html` - MVP v2 demo analizy produktu po linku Allegro.
- `wyszukiwarka-okazji.html` - MVP v3 demo wyszukiwarki okazji oraz MVP v4 realny search Allegro przez backend.
- `produkty.html` - MVP v7 Products Dashboard z oferta Allegro, KPI, wyszukiwaniem i sortowaniem.
- `orders.html` - MVP v6 Orders CRM table z KPI, wyszukiwaniem i bezpiecznym widokiem zamowien Allegro.
- `finance.html` - MVP v10 Finance AI + AI Opportunity Engine do liczenia rentownosci i rekomendacji zakupowych.
- `listing-studio.html` - MVP v11 AI Listing Studio do przygotowania nowych ofert i eksportu CSV.
- `product-hunter.html` - MVP v12 AI Product Hunter do analizy rynku Allegro i wyszukiwania kandydatow.
- `market-data-collector.html` - MVP v13 Market Data Collector do przygotowania legalnych danych CSV dla Product Hunter.
- `roadmap.html` - roadmap projektu.

## Backend

Backend znajduje sie w folderze `backend`.

Endpointy:

- `GET /api/allegro/login`
- `GET /api/allegro/callback`
- `GET /api/allegro/search?phrase=`
- `GET /api/allegro/me`
- `GET /api/allegro/orders`
- `GET /api/allegro/offers`

## Uruchomienie frontend

Najprosciej uruchomic statyczny serwer w folderze projektu:

```powershell
cd "C:\Users\Computer\Documents\Codex\2026-06-11\allegro-profit-ai-1-2-3"
python -m http.server 8080 --bind 127.0.0.1
```

Adresy:

```text
http://127.0.0.1:8080/index.html
http://127.0.0.1:8080/analiza-produktu.html
http://127.0.0.1:8080/wyszukiwarka-okazji.html
http://127.0.0.1:8080/produkty.html
http://127.0.0.1:8080/orders.html
http://127.0.0.1:8080/finance.html
http://127.0.0.1:8080/listing-studio.html
http://127.0.0.1:8080/product-hunter.html
http://127.0.0.1:8080/market-data-collector.html
http://127.0.0.1:8080/roadmap.html
```

## Uruchomienie backend

1. Przejdz do folderu backend:

```powershell
cd "C:\Users\Computer\Documents\Codex\2026-06-11\allegro-profit-ai-1-2-3\backend"
```

2. Skopiuj plik `.env.example` do `.env`.

```powershell
Copy-Item .env.example .env
```

3. Wstaw swoje dane aplikacji Allegro w `backend\.env`:

```text
ALLEGRO_CLIENT_ID=twoj_client_id
ALLEGRO_CLIENT_SECRET=twoj_client_secret
ALLEGRO_REDIRECT_URI=http://localhost:3000/api/allegro/callback
PORT=3000
```

4. Uruchom backend:

```powershell
node server.js
```

Backend bedzie dzialal pod adresem:

```text
http://localhost:3000
```

## Polaczenie z Allegro

Na frontendzie przycisk `Polacz Allegro` prowadzi do:

```text
http://localhost:3000/api/allegro/login
```

Ten endpoint przekierowuje uzytkownika do logowania Allegro OAuth. Po autoryzacji Allegro wraca na:

```text
http://localhost:3000/api/allegro/callback
```

## Wyszukiwanie przez Allegro API

1. Uruchom backend:

```powershell
cd "C:\Users\Computer\Documents\Codex\2026-06-11\allegro-profit-ai-1-2-3\backend"
node server.js
```

2. Otworz frontend:

```text
http://127.0.0.1:8080/wyszukiwarka-okazji.html
```

3. Kliknij `Polacz Allegro` i zaloguj sie przez OAuth.

4. W sekcji `Realne dane Allegro` wpisz phrase, np.:

```text
zabawka edukacyjna
```

5. Kliknij `Szukaj w Allegro`.

Frontend wykona zapytanie:

```text
http://localhost:3000/api/allegro/search?phrase=...
```

Po polaczeniu konta Allegro mozesz tez otworzyc liste zamowien:

```text
http://localhost:3000/api/allegro/orders
```

Ten endpoint wywoluje Allegro REST API:

```text
GET /order/checkout-forms
```

i zwraca JSON z Allegro bez zmian.

## Orders CRM table

Po uruchomieniu backendu i polaczeniu konta Allegro otworz:

```text
http://127.0.0.1:8080/orders.html
```

Strona pobiera dane z:

```text
http://localhost:3000/api/allegro/orders
```

Tabela CRM pokazuje tylko:

- ID zamowienia
- date platnosci
- login kupujacego
- imie kupujacego
- sume platnosci
- walute
- status platnosci
- liczbe towarow

Na gorze strony widoczne sa karty:

- wszystkie zamowienia
- laczna sprzedaz
- sredni koszyk

Mozesz tez filtrowac zamowienia po ID zamowienia albo loginie kupujacego i odswiezyc dane przyciskiem `Odswiez`.

Frontend nie pokazuje emaila, telefonu ani pelnego adresu kupujacego. Jesli konto nie jest autoryzowane, strona pokazuje przycisk `Polacz Allegro` prowadzacy do:

```text
http://localhost:3000/api/allegro/login
```

## Products Dashboard

Po uruchomieniu backendu i polaczeniu konta Allegro otworz:

```text
http://127.0.0.1:8080/produkty.html
```

Strona pobiera dane z:

```text
http://localhost:3000/api/allegro/offers
```

Backend wywoluje Allegro REST API:

```text
GET /sale/offers?limit=100
```

Tabela pokazuje:

- foto
- nazwe
- SKU
- cene
- ilosc
- status
- wyswietlenia, jesli Allegro je zwroci
- sprzedaz, jesli Allegro ja zwroci

Na gorze widoczne sa karty:

- wszystkie produkty
- aktywne produkty
- brak w magazynie
- srednia cena

Mozesz wyszukiwac po nazwie albo SKU i sortowac po nazwie, cenie lub ilosci.

## Main Business Dashboard

Po uruchomieniu backendu i polaczeniu konta Allegro otworz:

```text
http://127.0.0.1:8080/index.html
```

Dashboard pobiera dane z:

```text
http://localhost:3000/api/allegro/orders
http://localhost:3000/api/allegro/offers
```

Na jednym ekranie pokazuje:

- zamowienia razem
- sprzedaz razem
- sredni koszyk
- aktywne towary
- towary bez stanu
- najlepsze produkty
- ostatnie zamowienia
- alerty magazynowe

Dashboard nie pokazuje emaila, telefonu ani adresu kupujacych. Jesli backend nie dziala, konto nie jest autoryzowane albo Allegro API zwroci blad, strona pokazuje czytelny komunikat i w razie potrzeby przycisk `Polacz Allegro`.

## Finance AI

Po uruchomieniu backendu i polaczeniu konta Allegro otworz:

```text
http://127.0.0.1:8080/finance.html
```

Strona pobiera produkty z:

```text
http://localhost:3000/api/allegro/offers
```

Dla kazdej oferty mozesz edytowac:

- cene zakupu
- koszt pakowania
- koszt dostawy
- koszt reklamy
- prowizje Allegro %
- VAT %

Wartosci sa zapisywane lokalnie w `localStorage` per offer id. Finance AI liczy zysk netto, ROI i marze wedlug wzoru:

```text
revenue = sale price
allegroFee = revenue * commissionPercent / 100
vatCost = revenue * vatPercent / 100
totalCost = purchasePrice + packagingCost + deliveryCost + adsCost + allegroFee + vatCost
netProfit = revenue - totalCost
roi = purchasePrice > 0 ? netProfit / purchasePrice * 100 : 0
margin = revenue > 0 ? netProfit / revenue * 100 : 0
```

Kolory marzy:

- zielony: marza >= 20%
- zolty: marza >= 10% i < 20%
- czerwony: marza < 10%

## AI Opportunity Engine

MVP v10 rozszerza `finance.html` o inteligentna ocene potencjalu produktu. Wszystkie obliczenia sa wykonywane po stronie klienta na podstawie:

- danych z `GET /api/allegro/offers`
- parametrow kosztowych Finance AI
- wartosci zapisanych w `localStorage` per offer id

Dla kazdego produktu liczony jest `Opportunity Score` od 0 do 100. Algorytm bierze pod uwage:

- marze
- ROI
- cene sprzedazy
- stan magazynowy
- aktywnosc oferty
- zysk netto

Kolory score:

- 90-100: zielony
- 70-89: niebieski
- 50-69: zolty
- ponizej 50: czerwony

Silnik pokazuje tez automatyczna rekomendacje AI, np.:

- rekomendowane podniesienie ceny
- rekomendowane dokupienie
- wysoka rentownosc
- niska marza
- konczy sie zapas
- nie rekomendowane

Na gorze strony widoczne sa dodatkowe KPI:

- najlepszy Opportunity Score
- sredni Score
- liczba produktow perspektywicznych powyzej 80
- liczba produktow ryzykownych ponizej 50

Tabela ma sortowanie po Opportunity Score, ROI, marzy, zysku, cenie i stanie. Dostepne sa filtry: tylko perspektywiczne, tylko ryzykowne i tylko brak w magazynie.

Jesli backend nie jest uruchomiony albo konto nie jest polaczone, strona pokaze komunikat:

```text
Najpierw połącz konto Allegro przez backend OAuth.
```

## AI Listing Studio

MVP v11 dodaje strone:

```text
http://127.0.0.1:8080/listing-studio.html
```

Modul pomaga przygotowac nowy produkt do sprzedazy na Allegro i eksportu do BaseLinker. Dziala lokalnie, bez zewnetrznego AI API i bez danych klientow.

Formularz `Nowy produkt` zawiera link do dostawcy, nazwe towaru, cene zakupu, dostawe, pakowanie, prowizje Allegro, VAT, docelowa marze, foto URL, kategorie, slowa kluczowe i ilosc.

Po kliknieciu `Generuj listing` strona tworzy nazwe Allegro po polsku, krotki opis, dlugi opis, bullet points, SKU, rekomendowana cene sprzedazy, zysk netto, ROI, marze, rekomendacje AI i Product Score 0-100.

Wzory:

```text
totalCost = purchasePrice + deliveryCost + packagingCost
targetPrice = totalCost / (1 - desiredMarginPercent / 100)
allegroFee = targetPrice * commissionPercent / 100
vatCost = targetPrice * vatPercent / 100
netProfit = targetPrice - totalCost - allegroFee - vatCost
roi = purchasePrice > 0 ? netProfit / purchasePrice * 100 : 0
margin = targetPrice > 0 ? netProfit / targetPrice * 100 : 0
```

Pomysly produktow sa zapisywane w `localStorage`. Przyciski `Eksport CSV BaseLinker` i `Eksport CSV Allegro` generuja plik CSV z polami:

```text
sku,name,price,quantity,description,short_description,category,image_url,keywords,supplier_url,purchase_price,profit,roi,margin,score,recommendation
```

## AI Product Hunter

MVP v12.4 dodaje dwutrybowy Product Hunter:

```text
http://127.0.0.1:8080/product-hunter.html
```

### Product Catalog Hunter

Zrodlo:

```text
GET http://localhost:3000/api/allegro/search?phrase=...
```

Backend wywoluje aktualny oficjalny endpoint z OpenAPI `swagger.yaml` Allegro:

```text
GET /sale/products?phrase=...&language=pl-PL
```

Stary endpoint `GET /offers/listing` nie wystepuje w aktualnym oficjalnym `swagger.yaml`. Nie uzywamy go.

Endpoint `GET /sale/products` wymaga user OAuth token i scope `allegro:api:sale:offers:read`. Zwraca katalog produktow Allegro, a nie publiczne oferty handlowe, dlatego oficjalna odpowiedz nie zawiera cen, liczby sprzedawcow ani cen min/max. Product Hunter pokazuje te pola jako niedostepne, zamiast zgadywac dane.

Backend wysyla naglowki `Authorization: Bearer ...`, `Accept: application/vnd.allegro.public.v1+json`, `Content-Type: application/json` oraz `User-Agent: AllegroProfitAI/12.2 (+http://localhost:3000)`. Jesli Allegro zwroci blad, backend loguje pelny URL, HTTP method, naglowki requestu, status i body w terminalu, a Product Hunter pokazuje pelny JSON bledu w przegladarce. Przy braku lub wygasnieciu OAuth zwracane jest `401 not_authenticated`.

W interfejsie wpisujesz nisze, np. Montessori, Organizer, Kosz, Lampka, Pies, Kot albo Kuchnia. Po kliknieciu `Szukaj` strona pokazuje tylko dane dostepne w API:

- foto
- nazwa produktu
- category id
- publication status
- product id
- Send to Listing Studio

### Market Hunter Import

Rynkowe ceny i konkurencja wymagaja importu z legalnego zrodla zewnetrznego. CSV musi zawierac pola:

```text
name, competitor_price, seller_count, popularity, min_price, max_price, avg_price, source_url
```

Wszystkie obliczenia AI sa wykonywane lokalnie w przegladarce. Dla kazdego produktu liczony jest:

- Competition Score
- Price Score
- Demand Score
- Profit Score
- Opportunity Score 0-100

Rekomendacje:

- Opportunity > 80: Swietny produkt
- 60-80: Dobry kandydat
- 40-60: Mozna przetestowac
- < 40: Nie rekomendowane

Dostepne sa filtry po score min, price max i competition max oraz sortowanie po Opportunity, Avg price, Competition i Popularity. Przycisk `Send to Listing Studio` zapisuje wybrany produkt w `localStorage` jako pomysl dla `listing-studio.html`. Przycisk `Export results CSV` eksportuje wyniki z obliczonymi score.

### Market data bridge

MVP v12.5 laczy Listing Studio z Market Hunter Import. W tabeli zapisanych pomyslow przycisk `Uzupelnij dane rynkowe` zapisuje wybrany produkt w `localStorage` jako `selectedMarketProduct`:

```text
sku, name, category, imageUrl, supplierUrl, productId
```

Nastepnie otwierana jest strona:

```text
product-hunter.html#market-import
```

Product Hunter pokazuje karte `Uzupelniasz dane rynkowe dla:` i podpowiedz `Zaimportuj CSV z cenami konkurencji dla tego produktu.` Po imporcie CSV przycisk `Zapisz analize do Listing Studio` zapisuje do tej samej idei:

```text
marketAvgPrice, marketMinPrice, marketMaxPrice, sellerCount, popularity, opportunityScore, marketRecommendation
```

Listing Studio pokazuje te wartosci w tabeli zapisanych pomyslow.

## Market Data Collector

MVP v13 dodaje strone:

```text
http://127.0.0.1:8080/market-data-collector.html
```

Modul przygotowuje legalne dane rynkowe dla Product Hunter. Nie uzywa scrapingu Allegro HTML i nie obchodzi ograniczen Allegro. Dozwolone zrodla:

- import CSV/Excel od dostawcy zapisany jako CSV
- CSV z BaseLinker
- reczny CSV
- pliki zewnetrznych data-providerow

Supplier CSV:

```text
supplier_name,product_name,sku,purchase_price,stock,ean,category,image_url,source_url
```

Market CSV:

```text
name,competitor_price,seller_count,popularity,min_price,max_price,avg_price,source_url
```

Collector automatycznie dopasowuje produkt dostawcy do market product po SKU, EAN albo podobnej nazwie. Tabela pokazuje:

- supplier product
- purchase price
- stock
- market avg price
- seller count
- popularity
- estimated margin
- opportunity score
- recommendation

Rekomendacje:

- margin > 35% i seller_count < 20: BUY
- margin 20-35%: WATCH
- margin < 20% albo seller_count > 50: AVOID

Przycisk `Export Product Hunter CSV` tworzy plik:

```text
name, competitor_price, seller_count, popularity, min_price, max_price, avg_price, source_url
```

Przycisk `Send best products to Listing Studio` zapisuje produkty z rekomendacja BUY w `localStorage` Listing Studio.

## Dlaczego Client Secret nie moze byc w GitHub Pages

GitHub Pages hostuje tylko publiczny frontend. Kazdy plik HTML, CSS i JavaScript jest widoczny dla kazdej osoby odwiedzajacej strone. Gdyby `ALLEGRO_CLIENT_SECRET` trafil do frontend-kodu albo repozytorium publicznego, kazdy moglby go skopiowac i uzyc poza Twoja aplikacja.

Dlatego sekret musi byc przechowywany tylko po stronie backendu w lokalnym pliku `.env` albo w bezpiecznych zmiennych srodowiskowych hostingu backendu. Plik `.env` jest ignorowany przez Git.

## Status

- MVP v1: gotowe.
- MVP v2: czesciowo gotowe.
- MVP v3: Wyszukiwarka okazji demo - gotowe.
- MVP v4: realny search Allegro w interfejsie - gotowe po polaczeniu backend OAuth.
- MVP v5: Orders dashboard - gotowe po polaczeniu backend OAuth.
- MVP v6: Orders CRM table - gotowe po polaczeniu backend OAuth.
- MVP v7: Products Dashboard - gotowe po polaczeniu backend OAuth.
- MVP v8: Main Business Dashboard - gotowe po polaczeniu backend OAuth.
- MVP v9: Finance AI - gotowe po polaczeniu backend OAuth.
- MVP v10: AI Opportunity Engine - gotowe po polaczeniu backend OAuth.
- MVP v11: AI Listing Studio - gotowe lokalnie, bez zewnetrznego AI API.
- MVP v12.5: AI Product Hunter - bridge Listing Studio + Market Hunter Import.
- MVP v13: Market Data Collector - legalne CSV, auto-match i eksport do Product Hunter.
- Backend OAuth Allegro: przygotowany szkielet, bez prawdziwych sekretow w kodzie.
