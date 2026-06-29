import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("auftraege", "routes/auftraege.tsx"),
  route("angebote", "routes/angebote.tsx"),
  route("kunden", "routes/kunden.tsx"),
  route("produkte", "routes/produkte.tsx"),
  route("produktion", "routes/produktion.tsx"),
  route("packlisten", "routes/packlisten.tsx"),
  route("lieferscheine", "routes/lieferscheine.tsx"),
  route("lieferungen", "routes/lieferungen.tsx"),
  route("einkauf", "routes/einkauf.tsx"),
  route("lager", "routes/lager.tsx"),
  route("lieferanten", "routes/lieferanten.tsx"),
  route("rezepte", "routes/rezepte.tsx"),
  route("auftragseingang", "routes/auftragseingang.tsx"),
  route("importe", "routes/auftragseingang.tsx"),
  route("auswertungen", "routes/auswertungen.tsx"),
  route("einstellungen", "routes/einstellungen.tsx"),
] satisfies RouteConfig;
