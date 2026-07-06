import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  route("registrieren", "routes/registrieren.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),

  route("auftraege", "routes/auftraege.tsx"),
  route("import-regeln", "routes/import-regeln.tsx"),
  route("import-pruefen", "routes/import-pruefen.tsx"),
  route("importe", "routes/importe.tsx"),
  route("angebote", "routes/angebote.tsx"),
  route("rechnungen", "routes/rechnungen.tsx"),
  route("rechnungen/neu", "routes/rechnungen.neu.tsx"),
  route("rechnungen/:invoiceId", "routes/rechnungen.$invoiceId.tsx"),
  route("rechnungen/:invoiceId/pdf", "routes/rechnungen.$invoiceId.pdf.tsx"),
  route("kunden", "routes/kunden.tsx"),
  route("produkte", "routes/produkte.tsx"),
  route("produkte/import/vorlage", "routes/produkte.import.vorlage.tsx"),
  route("produkte/import", "routes/produkte.import.tsx"),
  route("produktion", "routes/produktion.tsx"),
  route("mhd-labels", "routes/mhd-labels.tsx"),
  route("foodlabels", "routes/foodlabels.tsx"),
  route("foodlabels/print/:labelId", "routes/foodlabels.print.$labelId.tsx"),
  route("mhd-labels/print/:labelId", "routes/mhd-labels.print.$labelId.tsx"),
  route("label/:publicToken", "routes/label.$publicToken.tsx"),
  route("packlisten", "routes/packlisten.tsx"),
  route("lieferscheine", "routes/lieferscheine.tsx"),
  route("fahrerzettel", "routes/fahrerzettel.tsx"),
  route("lieferungen", "routes/lieferungen.tsx"),
  route("einkauf", "routes/einkauf.tsx"),
  route("lager", "routes/lager.tsx"),
  route("lieferanten", "routes/lieferanten.tsx"),
  route("rezepte", "routes/rezepte.tsx"),
  route("auftragseingang", "routes/auftragseingang.tsx"),
  route("neuer-auftrag", "routes/neuer-auftrag.tsx"),
  route("auftrag-pruefung/:orderId", "routes/auftrag-pruefung.$orderId.tsx"),
  route("email-pruefung/:emailId", "routes/email-pruefung.$emailId.tsx"),
  route("auswertungen", "routes/auswertungen.tsx"),
  route("einstellungen", "routes/einstellungen.tsx"),
  route("konto/abo", "routes/konto.abo.tsx"),
  route("einstellungen/rechnungen", "routes/einstellungen.rechnungen.tsx"),

  route("api/mailjet/inbound", "routes/api.mailjet.inbound.tsx"),
  route("api/email-import/run", "routes/api.email-import.run.tsx"),

  route("gastario-control", "routes/gastario-control.tsx"),
  route("gastario-control/mandanten", "routes/gastario-control.mandanten.tsx"),
  route("gastario-control/mandanten/:tenantId", "routes/gastario-control.mandanten.$tenantId.tsx"),
  route("gastario-control/pakete", "routes/gastario-control.pakete.tsx"),
  route("gastario-control/features", "routes/gastario-control.features.tsx"),
  route("gastario-control/codes", "routes/gastario-control.codes.tsx"),

  route("belege", "routes/belege.tsx"),
  route("steuerberater-export", "routes/steuerberater-export.tsx"),
] satisfies RouteConfig;











