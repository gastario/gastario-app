# Gastario Supplier Hub Worker

Serverseitiger Supplier-Worker für Gastario.

## Ziel

Der Gastario-Nutzer installiert keinen lokalen Connector.

Die Web-App spricht ausschließlich mit dem Supplier Hub.
Der Worker kapselt Lieferanten-spezifische Sessions und Native Requests.

## Endpunkte

- `GET /health`
- `GET /v1/health`
- `POST /v1/search`
- `POST /v1/prices`

Alle `/v1/*`-Endpunkte benötigen:

`Authorization: Bearer <SUPPLIER_HUB_SERVICE_TOKEN>`

## Phase 2.1

Enthalten:
- Service Auth
- tenant-/connection-isolierter Session-Key
- Provider Registry
- METRO Provider
- Search-/Price-/Health-Vertrag
- Railway-/Docker-fähiger HTTP-Service

Noch absichtlich nicht enthalten:
- persistenter Session Vault
- interaktiver METRO Login
- METRO Native Transport

Diese Punkte folgen in Phase 2.2.

## Phase 2.2 – Encrypted Session Vault

Neu:
- AES-256-GCM verschlüsselte Session-Dateien
- tenant-/connection-spezifisches AAD
- atomisches Schreiben
- persistenter Mount unter `/data`
- `GET /v1/session/status`
- `PUT /v1/session/storage-state`
- `DELETE /v1/session`

Erforderliche Umgebungsvariablen:
- `SUPPLIER_HUB_SERVICE_TOKEN`
- `SUPPLIER_HUB_VAULT_KEY` (mindestens 32 zufällige Zeichen)
- optional `SUPPLIER_HUB_SESSION_DIR`

Für Railway muss `/data` als persistentes Volume gemountet werden.

Wichtig:
Der Browser-Storage-State wird ausschließlich verschlüsselt im Worker-Vault gespeichert.
Er wird nicht an den Gastario-Webclient zurückgegeben.

Der interaktive Login und die Erzeugung dieses Storage-State folgen im nächsten Schritt.

## Phase 2.3 – Login Ticket Broker

Neu:
- kurzlebige kryptografisch zufällige Login-Tickets
- tenant-/connection-Bindung
- `POST /v1/login/start`
- `GET /v1/login/status`
- Gastario-Route `POST /api/supplier-hub/connect`

Die Tickets enthalten keine Lieferanten-Zugangsdaten.

Phase 2.4:
Ein Hosted Browser Runtime Manager übernimmt ein Ticket,
öffnet eine isolierte interaktive METRO-Session und speichert
nach erfolgreichem Login ausschließlich den Storage-State
verschlüsselt im Session Vault.

## Phase 2.5 – METRO Native Search Transport

Neu:
- verschlüsselte METRO Storage-State Session wird serverseitig wiederhergestellt
- isolierter Chromium-Kontext pro Native Search
- Gastario navigiert nicht über DOM-Scraping der Ergebnisliste
- die echte METRO Search-Response `/searchdiscover/articlesearch/search` wird abgefangen
- Produkt-IDs kommen direkt aus `resultIds`
- Betty-Variant-Responses werden während der Shop-Suche gesammelt und zur Produktauflösung genutzt
- Preise werden aus der strukturierten Search-Payload gelesen
- Session-Ablauf wird als `REAUTH_REQUIRED` signalisiert

Aktueller bewusster Zwischenstand:
- `refreshPrices` läuft noch nicht über einen separaten Produktdetail-Request
- der erste Live-Search öffnet pro Anfrage einen isolierten Browser-Kontext
- in späteren Performance-Phasen wird daraus ein Connection-Pool mit warmen Sessions und Cache-First-Refresh

Der technische Vertrag nach außen bleibt:
`/v1/search`, `/v1/prices`, `/v1/health`.

## Phase 2.6 – Railway Deployment Readiness

Railway-Service:
- Root Directory: `/services/supplier-hub-worker`
- Dockerfile wird automatisch aus diesem Root-Verzeichnis erkannt.
- Healthcheck: `/health`
- Restart: `ON_FAILURE`
- Persistentes Volume: Mount Path `/data`

Erforderliche Service-Variablen:
- `SUPPLIER_HUB_SERVICE_TOKEN`
- `SUPPLIER_HUB_VAULT_KEY`
- `SUPPLIER_HUB_PUBLIC_URL`
- `SUPPLIER_HUB_SESSION_DIR=/data/supplier-sessions`
- `SUPPLIER_HUB_BROWSER_HEADLESS=0`
- `SUPPLIER_HUB_NATIVE_HEADLESS=0`

Gastario-Webservice benötigt danach:
- `SUPPLIER_HUB_METRO_GATEWAY_URL`
- denselben `SUPPLIER_HUB_SERVICE_TOKEN`

Smoke Test:
`SUPPLIER_HUB_SMOKE_URL=https://<worker-domain> npm run smoke`
