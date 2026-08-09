# Gastario Supplier Agent

Lokaler, lieferantenübergreifender Browser-Agent für Gastario.

## Ziel

- Supplier-Suche in Gastario bleibt lokal und schnell.
- Shop-Browser laufen getrennt auf dem Kundenrechner.
- Netzwerk-/JSON-Daten sind die bevorzugte Extraktionsquelle.
- DOM wird später nur als Fallback verwendet.
- Jeder Lieferant steckt hinter einem Adapter.
- Login-Daten werden nicht in Gastario gespeichert.
- Jeder Automationsbrowser verwendet ein eigenes persistentes Profil.

## Adapter

- METRO
- SELGROS
- Transgourmet
- CHEFS CULINAR

Die ersten Adapter sind bewusst network-first und enthalten noch keine erfundenen shop-spezifischen Endpoints oder CSS-Selektoren. Diese werden anhand realer Shop-Sessions pro Lieferant gelernt und danach adapter-spezifisch gehärtet.

## Lokales Browserprofil

Standard unter Windows:

`%LOCALAPPDATA%\Gastario\SupplierAgent\chrome-profile`

Dieses Profil ist getrennt vom normalen Chrome-Profil.

## Befehle

### Build

```powershell
npm.cmd run build
```

### Browser öffnen und eingeloggt lassen

```powershell
npm.cmd run browser
```

Beim ersten Start im geöffneten Chrome nacheinander bei den benötigten Lieferanten anmelden. Cookies und Local Storage bleiben im separaten Profil erhalten.

### Health Check

```powershell
npm.cmd run health
```

## Nächste Ausbaustufen

1. Network Recorder + Response-Klassifizierung pro Shop
2. shop-spezifische JSON-Parser
3. Embedded-JSON Fallback
4. Playwright-DOM Fallback
5. Preis-/Gebinde-Cross-Validation
6. Confidence + Circuit Breaker
7. Gastario Agent API / sichere Geräteverbindung
8. Discovery Queue Polling
9. zentrale Health-/Import-Telemetrie
10. weitere Supplier Adapter

## Network Recorder

Reale Shop-Netzwerkantworten werden lokal analysiert, ohne Cookies,
Request-Header oder rohe Login-Daten in Artefakte zu schreiben.

Beispiel METRO:

```powershell
npm.cmd run dev -- record metro
```

Danach im geöffneten Supplier-Browser:

1. anmelden
2. mehrere unterschiedliche Produkte suchen
3. Produktdetailseiten öffnen
4. wenn vorhanden Staffelpreise / Varianten / Verfügbarkeit aufrufen
5. mit `Ctrl+C` beenden

Die technische Aufzeichnung liegt anschließend unter:

`artifacts/network/`

Sie enthält nur:
- Host + URL-Pfad ohne Querystring
- HTTP-Methode / Status / Content-Type
- JSON-Top-Level-Struktur
- Anzahl erkannter Produktkandidaten
- normalisierte Beispielprodukte und Confidence

Keine Cookies, Authorization-Header oder Request-Header werden gespeichert.

## Phase 3: Endpoint-Klassifizierung und Schema-Probe

METRO-Endpunkte werden jetzt getrennt klassifiziert:

- `PRODUCT_SEARCH`
- `PRODUCT_VARIANTS`
- `PRODUCT_SUBSTITUTES`
- `NAVIGATION`
- `ACCOUNT`
- `CART`
- `CONFIG`
- `OTHER`

Nur produktnahe Endpoints dürfen in den generischen Produktparser.

Die Network-Artefakte enthalten zusätzlich rein strukturelle
`schemaFingerprints` mit:

- JSON-Pfad
- Feldnamen
- Datentypen
- Häufigkeit

Es werden dafür keine Rohwerte, Cookies, Authorization-Header oder
URL-Querystrings gespeichert.

Damit können shop-spezifische Parser anhand echter Response-Strukturen
gebaut werden, ohne Kontodaten in Analyseartefakte zu kopieren.

## Phase 4: METRO Network Native v1

Der METRO-Adapter verwendet für die beobachteten Produktendpunkte keine
generische Objekt-Erkennung mehr.

Native Quellen:

### `/evaluate.article.v1/substitutes`

Verwendet echte Bundle-/Preisfelder:

- `bundles[].title`
- `bundles[].customerDisplayId`
- `bundles[].bundleId`
- `bundles[].brandName`
- `bundles[].availability`
- `bundles[].priceInfo.netPrice`
- `bundles[].priceInfo.grossPrice`
- `bundles[].priceInfo.finalPricesInfo`
- `bundles[].priceInfo.summaryDnrInfo.levels`
- `bundles[].weightPerPiece`
- `bundles[].minOrderQuantity`

### `/evaluate.article.v1/betty-variants`

Verwendet echte Produkt-, Bundle-, EAN-, Gebinde- und
Verfügbarkeitsfelder. Da dieser Response in der beobachteten Struktur
keine `priceInfo`-Objekte trägt, werden diese Ergebnisse maximal als
`MEDIUM` klassifiziert, bis ein Preis-Response sie ergänzt.

### `/searchdiscover/articlesearch/search`

Dieser Response liefert beobachtet hauptsächlich Such-IDs und
Kategorieinformationen. Er wird deshalb noch nicht als fertiger
Produktdatensatz gespeichert. Die IDs werden in der nächsten Phase für
gezieltes Enrichment genutzt.

Zielregel:

- HIGH = echter Bundle-Identifier + Produktname + echter Preis
- MEDIUM = echter Bundle-Identifier + Produktdaten, Preis noch offen
- Kategorien/Accounts/Navigation = niemals Produkt
