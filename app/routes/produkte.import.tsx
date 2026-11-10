import { Form, Link, useActionData, useNavigation } from "react-router";

import AppLayout from "../components/AppLayout";

import {
  GastarioPage,
  GastarioHeader,
  GastarioNotice,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioSection,
  GastarioFilterBar,
  GastarioField,
  GastarioInput,
  GastarioToolbar,
  GastarioButton,
  GastarioBadge,
  GastarioTable,
  gastarioButtonClass,
} from "../components/ui";

type ImportRow = {
  rowNumber: number;
  name: string;
  category: string | null;
  unit: string;
  priceCents: number;
  taxRate: number;
  active: boolean;
  errors: string[];
  warnings: string[];
};

function centsToEuro(value: number | null | undefined) {
  return ((value || 0) / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if ((char === ";" || char === ",") && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      cell = "";

      if (row.some((value) => value.trim())) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());

  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]/g, "");
}

function findColumn(headers: string[], aliases: string[]) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const normalizedAliases = aliases.map(normalizeHeader);

  return normalizedHeaders.findIndex((header) => normalizedAliases.includes(header));
}

function parsePrice(value: string) {
  const cleaned = String(value || "")
    .replace("€", "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .trim();

  const number = Number(cleaned);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

function parseTaxRate(value: string) {
  const raw = String(value || "").replace("%", "").replace(",", ".").trim();

  if (!raw) return 7;

  const number = Number(raw);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function parseActive(value: string) {
  const raw = String(value || "").toLowerCase().trim();

  if (!raw) return true;
  if (["ja", "yes", "true", "1", "aktiv", "active"].includes(raw)) return true;
  if (["nein", "no", "false", "0", "inaktiv", "inactive"].includes(raw)) return false;

  return true;
}

function mapCsvToRows(csvText: string, existingNames: string[]) {
  const parsed = parseCsv(csvText);

  if (parsed.length < 2) {
    return {
      rows: [] as ImportRow[],
      fatalError: "Die CSV braucht eine Kopfzeile und mindestens eine Produktzeile.",
    };
  }

  const headers = parsed[0];

  const nameIndex = findColumn(headers, ["name", "produkt", "produktname", "artikel"]);
  const categoryIndex = findColumn(headers, ["kategorie", "category", "gruppe"]);
  const unitIndex = findColumn(headers, ["einheit", "unit"]);
  const priceIndex = findColumn(headers, ["preis", "preisnetto", "nettopreis", "verkaufspreis", "price"]);
  const taxIndex = findColumn(headers, ["mwst", "ust", "tax", "taxrate", "steuersatz"]);
  const activeIndex = findColumn(headers, ["aktiv", "active", "status"]);

  if (nameIndex === -1) {
    return {
      rows: [] as ImportRow[],
      fatalError: "Spalte für Produktname fehlt. Erlaubt: name, produkt, produktname oder artikel.",
    };
  }

  if (priceIndex === -1) {
    return {
      rows: [] as ImportRow[],
      fatalError: "Spalte für Preis fehlt. Erlaubt: preis, preisnetto, nettopreis, verkaufspreis oder price.",
    };
  }

  const existing = new Set(existingNames.map((name) => name.toLowerCase().trim()));
  const seen = new Set<string>();

  const rows = parsed.slice(1).map((values, index) => {
    const rowNumber = index + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = String(values[nameIndex] || "").trim();
    const category = categoryIndex >= 0 ? String(values[categoryIndex] || "").trim() || null : null;
    const unit = unitIndex >= 0 ? String(values[unitIndex] || "").trim() || "Portion" : "Portion";
    const priceCents = parsePrice(values[priceIndex] || "");
    const taxRate = taxIndex >= 0 ? parseTaxRate(values[taxIndex] || "") : 7;
    const active = activeIndex >= 0 ? parseActive(values[activeIndex] || "") : true;

    if (!name) errors.push("Produktname fehlt.");
    if (!priceCents || priceCents <= 0) errors.push("Preis fehlt oder ist ungültig.");
    if (taxRate === null || ![0, 7, 19].includes(taxRate)) errors.push("MwSt muss 0, 7 oder 19 sein.");
    if (!category) warnings.push("Kategorie fehlt.");

    const key = name.toLowerCase().trim();

    if (key && existing.has(key)) errors.push("Produkt existiert bereits.");
    if (key && seen.has(key)) errors.push("Produkt kommt in der Datei doppelt vor.");
    if (key) seen.add(key);

    return {
      rowNumber,
      name,
      category,
      unit: unit || "Portion",
      priceCents: priceCents || 0,
      taxRate: taxRate || 7,
      active,
      errors,
      warnings,
    };
  });

  return { rows, fatalError: null };
}

export function meta() {
  return [{ title: "Produkt-Import · Gastario" }];
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access.tenantId) {
    return { error: access.setupError || "Kein Mandant gefunden." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  const existingProducts = await prisma.product.findMany({
    where: { tenantId: access.tenantId },
    select: { name: true },
  });

  if (intent === "preview") {
    const file = formData.get("file") as any;

    if (!file || typeof file.text !== "function") {
      return { error: "Bitte CSV-Datei auswählen." };
    }

    const csvText = await file.text();
    const mapped = mapCsvToRows(csvText, existingProducts.map((product) => product.name));

    if (mapped.fatalError) {
      return { error: mapped.fatalError };
    }

    return {
      preview: true,
      rows: mapped.rows,
      payload: JSON.stringify(mapped.rows),
      summary: {
        total: mapped.rows.length,
        valid: mapped.rows.filter((row) => row.errors.length === 0).length,
        warnings: mapped.rows.filter((row) => row.errors.length === 0 && row.warnings.length > 0).length,
        errors: mapped.rows.filter((row) => row.errors.length > 0).length,
      },
    };
  }

  if (intent === "import") {
    const payload = String(formData.get("payload") || "");

    if (!payload) {
      return { error: "Importdaten fehlen. Bitte CSV erneut prüfen." };
    }

    const rows = JSON.parse(payload) as ImportRow[];
    const validRows = rows.filter((row) => row.errors.length === 0);

    if (validRows.length === 0) {
      return { error: "Keine sauberen Produktzeilen zum Importieren gefunden." };
    }

    await prisma.product.createMany({
      data: validRows.map((row) => ({
        tenantId: access.tenantId,
        name: row.name,
        category: row.category,
        unit: row.unit || "Portion",
        priceCents: row.priceCents,
        taxRate: row.taxRate,
        active: row.active,
      })),
    });

    return { success: validRows.length + " Produkte wurden importiert." };
  }

  return { error: "Unbekannte Aktion." };
}

export default function ProduktImport() {
  /*
   * gastario-product-import-masterdesign-v1-20260802
   *
   * Ausschließlich die Oberfläche wurde vereinheitlicht.
   * CSV-Prüfung und Importlogik bleiben unverändert.
   */
  const actionData =
    useActionData<typeof action>() as any;

  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const hasPreview =
    Boolean(actionData?.preview);

  const importFinished =
    Boolean(actionData?.success);

  const validCount =
    Number(
      actionData?.summary?.valid || 0
    );

  return (
    <AppLayout>

      <GastarioPage>

        <GastarioHeader
          eyebrow="Produkte"
          title="Produkt-Import"
          subtitle="Produktlisten strukturiert hochladen, prüfen und ausschließlich saubere Datensätze übernehmen."
          actions={
            <Link
              to="/produkte"
              className={
                gastarioButtonClass(
                  "secondary"
                )
              }
            >
              Zurück zu Produkten
            </Link>
          }
        />


        {actionData?.error ? (

          <GastarioNotice type="danger">
            <strong>
              Import konnte nicht ausgeführt werden.
            </strong>
            {" "}
            {actionData.error}
          </GastarioNotice>

        ) : null}


        {actionData?.success ? (

          <GastarioNotice type="success">
            <strong>
              Import abgeschlossen.
            </strong>
            {" "}
            {actionData.success}
          </GastarioNotice>

        ) : null}


        <GastarioMetricGrid>
          <GastarioMetric
            label="Datei"
            value={hasPreview ? "Geprüft" : "Ausstehend"}
            description={hasPreview ? "CSV wurde eingelesen" : "Noch keine CSV geprüft"}
            badge="CSV"
          />
          <GastarioMetric
            label="Produktzeilen"
            value={hasPreview ? actionData.summary.total : "–"}
            description="Erkannte Zeilen"
            badge="Gesamt"
          />
          <GastarioMetric
            label="Importbereit"
            value={hasPreview ? actionData.summary.valid : "–"}
            description="Ohne blockierende Fehler"
            badge="Bereit"
          />
          <GastarioMetric
            label="Fehler"
            value={hasPreview ? actionData.summary.errors : "–"}
            description="Werden nicht importiert"
            badge="Prüfung"
          />
        </GastarioMetricGrid>

        <GastarioSection
          eyebrow="Produktverwaltung"
          title="Produktliste importieren"
          description="Produktdatei auswählen, prüfen und anschließend gültige Produkte übernehmen."
          action={
            <Link
              to="/produkte/import/vorlage"
              reloadDocument
              className={gastarioButtonClass("secondary")}
            >
              CSV-Vorlage herunterladen
            </Link>
          }
        >
          <Form method="post" encType="multipart/form-data">
            <input type="hidden" name="intent" value="preview" />
            <GastarioFilterBar
              actions={
                <GastarioButton variant="primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "CSV wird geprüft …" : "CSV prüfen"}
                </GastarioButton>
              }
            >
              <GastarioField label="CSV-Datei" hint="CSV mit Komma oder Semikolon" required>
                <GastarioInput
                  type="file"
                  name="file"
                  accept=".csv,text/csv"
                  required
                />
              </GastarioField>
            </GastarioFilterBar>
          </Form>
          <GastarioNotice type="neutral">
            Pflichtfelder: Produktname und Nettopreis. Optional: Kategorie, Einheit, MwSt. und Aktiv-Status.
            Bis zur Bestätigung werden keine Produkte importiert.
          </GastarioNotice>
        </GastarioSection>


        {hasPreview ? (

          <>

            <GastarioSection
              eyebrow="CSV-Vorschau"
              title="Import prüfen"
              description="Kontrolliere die erkannten Produkte. Fehlerhafte Zeilen werden beim Import automatisch ausgelassen."
              action={
                <Form method="post">

                  <input
                    type="hidden"
                    name="intent"
                    value="import"
                  />

                  <input
                    type="hidden"
                    name="payload"
                    value={
                      actionData.payload
                    }
                  />

                  <GastarioButton
                    type="submit"
                    variant="primary"
                    disabled={
                      validCount === 0 || isSubmitting
                    }
                  >
                    {validCount > 0
                      ? validCount +
                        " saubere Produkte importieren"
                      : "Keine Produkte importierbar"}
                  </GastarioButton>

                </Form>
              }
            >

              <GastarioTable>

                <thead>
                  <tr>
                    <th>Zeile</th>
                    <th>Produkt</th>
                    <th>Kategorie</th>
                    <th>Einheit</th>
                    <th>Preis netto</th>
                    <th>MwSt.</th>
                    <th>Prüfstatus</th>
                  </tr>
                </thead>


                <tbody>

                  {actionData.rows.map(
                    (
                      row: ImportRow
                    ) => (

                      <tr
                        key={
                          row.rowNumber
                        }
                      >

                        <td>
                          {row.rowNumber}
                        </td>


                        <td>
                          <strong>
                            {row.name ||
                              "Ohne Produktname"}
                          </strong>

                          <div className="g-ui-field-hint">
                            {row.active
                              ? "Aktiv"
                              : "Inaktiv"}
                          </div>
                        </td>


                        <td>
                          {row.category ||
                            "Nicht angegeben"}
                        </td>


                        <td>
                          {row.unit ||
                            "Portion"}
                        </td>


                        <td>
                          <strong>
                            {centsToEuro(
                              row.priceCents
                            )}
                          </strong>
                        </td>


                        <td>
                          {row.taxRate} %
                        </td>


                        <td>

                          {row.errors.length >
                          0 ? (

                            <GastarioBadge variant="danger">
                              {row.errors.join(
                                " · "
                              )}
                            </GastarioBadge>

                          ) : row.warnings
                              .length > 0 ? (

                            <GastarioBadge variant="warning">
                              {row.warnings.join(
                                " · "
                              )}
                            </GastarioBadge>

                          ) : (

                            <GastarioBadge variant="success">
                              Importbereit
                            </GastarioBadge>

                          )}

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </GastarioTable>


              <GastarioToolbar
                align="between"
              >

                <span className="g-ui-field-hint">
                  Fehlerhafte Zeilen bleiben vollständig
                  außerhalb des Imports.
                </span>

                <strong>
                  {validCount} von{" "}
                  {actionData.summary.total} Zeilen
                  können übernommen werden.
                </strong>

              </GastarioToolbar>

            </GastarioSection>

          </>

        ) : null}

      </GastarioPage>

    </AppLayout>
  );
}
