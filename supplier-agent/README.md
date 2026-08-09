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
