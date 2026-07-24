import { Form, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

const FIELD_OPTIONS = [
  { value: "customerName", label: "Kunde" },
  { value: "eventName", label: "Eventname" },
  { value: "deliveryDate", label: "Lieferdatum" },
  { value: "deliveryTime", label: "Lieferzeit" },
  { value: "deliveryAddress", label: "Lieferadresse" },
  { value: "contactName", label: "Kontaktperson" },
  { value: "contactPhone", label: "Telefon" },
  { value: "personCount", label: "Personenanzahl" },
  { value: "items", label: "Positionen / Produkte" },
  { value: "allergens", label: "Allergene / Hinweise" },
  { value: "budget", label: "Budget / Preis" },
  { value: "invoiceAddress", label: "Rechnungsadresse" },
  { value: "notes", label: "Sonstige Hinweise" },
];

const DEFAULT_RULES = [
  { sourceName: "Allgemein", fieldKey: "customerName", keywords: "Kunde, Auftraggeber, Firma, Company, Client" },
  { sourceName: "Allgemein", fieldKey: "eventName", keywords: "Event, Veranstaltung, Anlass, Eventname" },
  { sourceName: "Allgemein", fieldKey: "deliveryDate", keywords: "Lieferdatum, Delivery Date, Eventdatum, Auslieferung am, Datum" },
  { sourceName: "Allgemein", fieldKey: "deliveryTime", keywords: "Lieferzeit, Delivery Time, Uhrzeit, Anlieferung, Zeitfenster, Time Slot" },
  { sourceName: "Allgemein", fieldKey: "deliveryAddress", keywords: "Lieferadresse, Delivery Address, Location, Adresse, Lieferort, Venue" },
  { sourceName: "Allgemein", fieldKey: "contactName", keywords: "Kontaktperson, Ansprechpartner, Contact Person, Kontakt" },
  { sourceName: "Allgemein", fieldKey: "contactPhone", keywords: "Telefon, Phone, Telefonnummer, Mobile, Mobil" },
  { sourceName: "Allgemein", fieldKey: "personCount", keywords: "Personenanzahl, Personen, Teilnehmer, Pax, Guests, Anzahl Personen" },
  { sourceName: "Allgemein", fieldKey: "items", keywords: "Positionen, Produkte, Menu, Men?, Speisen, Artikel, Items, Bowl, Buffet, Wrap, Dessert, Fr?hst?ck, Lunch" },
  { sourceName: "Allgemein", fieldKey: "allergens", keywords: "Allergene, Allergies, Unvertr?glichkeiten, Unvertraeglichkeiten, Hinweise, vegan, vegetarisch, glutenfrei, laktosefrei" },
  { sourceName: "Allgemein", fieldKey: "budget", keywords: "Budget, Preis, Gesamtpreis, Amount, Total, Netto, Brutto" },
  { sourceName: "Allgemein", fieldKey: "invoiceAddress", keywords: "Rechnungsadresse, Billing Address, Rechnung, Invoice" },
  { sourceName: "Heycater", fieldKey: "deliveryDate", keywords: "Delivery Date, Lieferdatum, Event Date" },
  { sourceName: "Heycater", fieldKey: "deliveryAddress", keywords: "Delivery Address, Location, Venue" },
  { sourceName: "Heycater", fieldKey: "items", keywords: "Menu, Items, Order Details, Food" },
  { sourceName: "Egora", fieldKey: "deliveryDate", keywords: "Eventdatum, Lieferdatum, Datum" },
  { sourceName: "Egora", fieldKey: "deliveryAddress", keywords: "Location, Lieferort, Adresse" },
  { sourceName: "Egora", fieldKey: "items", keywords: "Positionen, Speisen, Produkte" },
];

function splitKeywords(value: string) {
  return String(value || "")
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

async function ensureImportRuleTable(prisma: any) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OrderImportRule" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "sourceName" TEXT,
      "fieldKey" TEXT NOT NULL,
      "keywords" TEXT NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "OrderImportRule"
      ADD COLUMN IF NOT EXISTS "name" TEXT,
      ADD COLUMN IF NOT EXISTS "senderContains" TEXT,
      ADD COLUMN IF NOT EXISTS "subjectContains" TEXT,
      ADD COLUMN IF NOT EXISTS "bodyContains" TEXT,
      ADD COLUMN IF NOT EXISTS "matchMode" TEXT NOT NULL DEFAULT 'ANY',
      ADD COLUMN IF NOT EXISTS "documentType" TEXT,
      ADD COLUMN IF NOT EXISTS "action" TEXT,
      ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OrderImportRule_priority_idx" ON "OrderImportRule" ("priority");`);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OrderImportRule_tenantId_idx" ON "OrderImportRule" ("tenantId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OrderImportRule_fieldKey_idx" ON "OrderImportRule" ("fieldKey");`);
}

function createId() {
  return "oir_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function meta() {
  return [{ title: "Import-Regeln - Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access?.tenantId) {
    throw new Response("Nicht angemeldet", { status: 401 });
  }

  await ensureImportRuleTable(prisma);

  const rules = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "OrderImportRule"
     WHERE "tenantId" = $1
     ORDER BY "active" DESC, "fieldKey" ASC, "createdAt" DESC`,
    access.tenantId
  );

  return {
    tenant: access.tenant,
    rules,
    fieldOptions: FIELD_OPTIONS,
  };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access?.tenantId) {
    throw new Response("Nicht angemeldet", { status: 401 });
  }

  await ensureImportRuleTable(prisma);

  const formData = await request.formData();
  const intent = safeText(formData.get("_intent"));

  if (intent === "seedDefaults") {
    let created = 0;

    for (const rule of DEFAULT_RULES) {
      const existing = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "id" FROM "OrderImportRule"
         WHERE "tenantId" = $1 AND "sourceName" = $2 AND "fieldKey" = $3 AND "keywords" = $4
         LIMIT 1`,
        access.tenantId,
        rule.sourceName,
        rule.fieldKey,
        rule.keywords
      );

      if (existing.length === 0) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "OrderImportRule"
            ("id", "tenantId", "sourceName", "fieldKey", "keywords", "active", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)`,
          createId(),
          access.tenantId,
          rule.sourceName,
          rule.fieldKey,
          rule.keywords
        );
        created++;
      }
    }

    return { success: created + " Standard-Regeln wurden eingespielt." };
  }

  if (intent === "testText") {
    const testText = safeText(formData.get("testText"));
    const normalizedText = testText.toLowerCase();

    const rules = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "OrderImportRule"
       WHERE "tenantId" = $1 AND "active" = true
       ORDER BY "fieldKey" ASC`,
      access.tenantId
    );

    const matches = rules
      .map((rule) => {
        const hits = splitKeywords(rule.keywords).filter((keyword) =>
          normalizedText.includes(keyword.toLowerCase())
        );

        return {
          fieldKey: rule.fieldKey,
          sourceName: rule.sourceName || "Alle",
          keywords: hits,
        };
      })
      .filter((match) => match.keywords.length > 0);

    return {
      success: matches.length > 0 ? "Test abgeschlossen: Treffer gefunden." : "Test abgeschlossen: Noch keine Treffer.",
      matches,
      testText,
    };
  }

  if (intent === "delete") {
    const ruleId = safeText(formData.get("ruleId"));

    await prisma.$executeRawUnsafe(
      `DELETE FROM "OrderImportRule" WHERE "id" = $1 AND "tenantId" = $2`,
      ruleId,
      access.tenantId
    );

    return { success: "Regel wurde geloescht." };
  }

  if (intent === "toggle") {
    const ruleId = safeText(formData.get("ruleId"));
    const currentActive = safeText(formData.get("active")) === "true";

    await prisma.$executeRawUnsafe(
      `UPDATE "OrderImportRule"
       SET "active" = $1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $2 AND "tenantId" = $3`,
      !currentActive,
      ruleId,
      access.tenantId
    );

    return { success: "Regel wurde aktualisiert." };
  }

  if (intent === "createClassificationRule") {
    const name = safeText(formData.get("name"));
    const sourceName = safeText(formData.get("sourceName"));
    const senderContains = safeText(formData.get("senderContains"));
    const subjectContains = safeText(formData.get("subjectContains"));
    const bodyContains = safeText(formData.get("bodyContains"));

    const matchMode =
      safeText(formData.get("matchMode")).toUpperCase() === "ALL"
        ? "ALL"
        : "ANY";

    const documentType =
      safeText(formData.get("documentType"));

    const ruleAction =
      safeText(formData.get("action"));

    const parsedPriority =
      Number(safeText(formData.get("priority")) || "0");

    const priority =
      Number.isFinite(parsedPriority)
        ? Math.max(
            0,
            Math.min(
              1000,
              Math.trunc(parsedPriority)
            )
          )
        : 0;

    if (!name) {
      return {
        error: "Bitte einen Namen für die feste Importregel eintragen.",
      };
    }

    if (
      !senderContains &&
      !subjectContains &&
      !bodyContains
    ) {
      return {
        error:
          "Bitte mindestens eine Bedingung für Absender, Betreff oder Nachrichtentext eintragen.",
      };
    }

    if (!documentType || !ruleAction) {
      return {
        error:
          "Bitte Dokumenttyp und Aktion auswählen.",
      };
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "OrderImportRule"
        (
          "id",
          "tenantId",
          "name",
          "sourceName",
          "fieldKey",
          "keywords",
          "senderContains",
          "subjectContains",
          "bodyContains",
          "matchMode",
          "documentType",
          "action",
          "priority",
          "active",
          "updatedAt"
        )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13,
         true, CURRENT_TIMESTAMP
       )`,
      createId(),
      access.tenantId,
      name,
      sourceName || null,
      "__classification__",
      "",
      senderContains || null,
      subjectContains || null,
      bodyContains || null,
      matchMode,
      documentType,
      ruleAction,
      priority
    );

    return {
      success: "Feste Importregel wurde gespeichert.",
    };
  }

  const sourceName = safeText(formData.get("sourceName"));
  const fieldKey = safeText(formData.get("fieldKey"));
  const keywords = safeText(formData.get("keywords"));

  if (!fieldKey || !keywords) {
    return { error: "Bitte Feld und Erkennungswoerter eintragen." };
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "OrderImportRule"
      ("id", "tenantId", "sourceName", "fieldKey", "keywords", "active", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)`,
    createId(),
    access.tenantId,
    sourceName || null,
    fieldKey,
    keywords
  );

  return { success: "Import-Regel wurde gespeichert." };
}

export default function ImportRegelnPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const anyAction = actionData as any;
  const rules = data.rules as any[];

  return (
    <AppLayout>
      <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Import & Auftragserkennung</p>
          <h1 style={titleStyle}>Import-Regeln</h1>
          <p style={subtitleStyle}>
            Lege Woerter fest, an denen Gastario PDF-Auftraege erkennt. Jede Firma kann eigene Begriffe verwenden.
          </p>
        </div>
      </div>

      {actionData && "error" in actionData ? <div style={errorStyle}>{actionData.error}</div> : null}
      {actionData && "success" in actionData ? <div style={successStyle}>{actionData.success}</div> : null}

      <section style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Schnellstart</p>
            <h2 style={sectionTitleStyle}>Standard-Regeln und PDF-Test</h2>
          </div>

          <Form method="post">
            <input type="hidden" name="_intent" value="seedDefaults" />
            <button type="submit" style={secondaryButtonStyle}>Standard-Regeln einspielen</button>
          </Form>
        </div>

        <Form method="post" style={testGridStyle}>
          <input type="hidden" name="_intent" value="testText" />
          <label style={fieldStyle}>
            <span>PDF-Text testen</span>
            <textarea
              name="testText"
              rows={5}
              placeholder="Hier testweise Text aus einem PDF einfuegen, z. B. Lieferdatum, Lieferadresse, Positionen..."
              defaultValue={anyAction?.testText || ""}
              style={textareaStyle}
            />
          </label>
          <div style={formActionStyle}>
            <button type="submit" style={primaryButtonStyle}>Erkennung testen</button>
          </div>
        </Form>

        {anyAction?.matches ? (
          <div style={matchBoxStyle}>
            <strong>Erkannte Felder</strong>
            {anyAction.matches.length === 0 ? (
              <p style={matchEmptyStyle}>Keine Treffer. Bitte mehr Erkennungswoerter anlegen.</p>
            ) : (
              <div style={matchListStyle}>
                {anyAction.matches.map((match: any, index: number) => {
                  const label = FIELD_OPTIONS.find((option) => option.value === match.fieldKey)?.label || match.fieldKey;

                  return (
                    <div key={index} style={matchRowStyle}>
                      <strong>{label}</strong>
                      <span>{match.sourceName}</span>
                      <small>{match.keywords.join(", ")}</small>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>
              Garantierte Erkennung
            </p>

            <h2 style={sectionTitleStyle}>
              Feste E-Mail-Regel anlegen
            </h2>

            <p style={subtitleStyle}>
              Diese Regeln werden vor der KI geprüft und legen
              den Dokumenttyp verbindlich fest.
            </p>
          </div>
        </div>

        <Form method="post" style={formGridStyle}>
          <input
            type="hidden"
            name="_intent"
            value="createClassificationRule"
          />

          <Field label="Regelname">
            <input
              name="name"
              required
              placeholder="z. B. Heycater finale Bestätigung"
            />
          </Field>

          <Field label="Quelle">
            <input
              name="sourceName"
              placeholder="z. B. Heycater"
            />
          </Field>

          <Field label="Absender enthält">
            <input
              name="senderContains"
              placeholder="z. B. heycater"
            />
          </Field>

          <Field label="Betreff enthält">
            <input
              name="subjectContains"
              placeholder="z. B. Bitte bestätige den Auftrag"
            />
          </Field>

          <Field label="Nachrichtentext enthält">
            <input
              name="bodyContains"
              placeholder="z. B. hat Euer Angebot bestätigt"
            />
          </Field>

          <Field label="Bedingungen">
            <select
              name="matchMode"
              defaultValue="ALL"
            >
              <option value="ALL">
                Alle ausgefüllten Bedingungen müssen stimmen
              </option>

              <option value="ANY">
                Mindestens eine Bedingung muss stimmen
              </option>
            </select>
          </Field>

          <Field label="Dokumenttyp">
            <select
              name="documentType"
              defaultValue="ORDER_CONFIRMATION"
            >
              <option value="ORDER_CONFIRMATION">
                Auftragsbestätigung
              </option>

              <option value="INQUIRY">
                Anfrage
              </option>

              <option value="ORDER_CHANGE">
                Auftragsänderung
              </option>

              <option value="CANCELLATION">
                Absage / Stornierung
              </option>

              <option value="DELIVERY_NOTE">
                Lieferschein / Erinnerung
              </option>

              <option value="TRASH">
                Ignorieren
              </option>
            </select>
          </Field>

          <Field label="Aktion">
            <select
              name="action"
              defaultValue="CREATE_REVIEW_ORDER"
            >
              <option value="CREATE_REVIEW_ORDER">
                Prüfauftrag erstellen
              </option>

              <option value="CREATE_INQUIRY">
                Als Anfrage markieren
              </option>

              <option value="SEND_TO_REVIEW">
                Nur zur Prüfung vorlegen
              </option>

              <option value="IGNORE">
                Ignorieren
              </option>
            </select>
          </Field>

          <Field label="Priorität">
            <input
              name="priority"
              type="number"
              min="0"
              max="1000"
              defaultValue="100"
            />
          </Field>

          <div style={formActionStyle}>
            <button
              type="submit"
              style={primaryButtonStyle}
            >
              Feste Regel speichern
            </button>
          </div>
        </Form>
      </section>

      <section style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Neue Regel</p>
            <h2 style={sectionTitleStyle}>Erkennungswoerter speichern</h2>
          </div>
        </div>

        <Form method="post" style={formGridStyle}>
          <input type="hidden" name="_intent" value="create" />

          <Field label="Quelle optional">
            <input name="sourceName" placeholder="z. B. Heycater, Egora, E-Mail" />
          </Field>

          <Field label="Welches Feld soll erkannt werden?">
            <select name="fieldKey" defaultValue="deliveryDate">
              {FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Erkennungswoerter / Synonyme">
            <input name="keywords" placeholder="z. B. Lieferdatum, Delivery Date, Eventdatum" />
          </Field>

          <div style={formActionStyle}>
            <button type="submit" style={primaryButtonStyle}>Regel speichern</button>
          </div>
        </Form>
      </section>

      <section style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Gespeichert</p>
            <h2 style={sectionTitleStyle}>Aktive Import-Regeln</h2>
          </div>
          <span style={countPillStyle}>{rules.length} Regeln</span>
        </div>

        {rules.length === 0 ? (
          <div style={emptyStyle}>
            Noch keine Import-Regeln vorhanden. Lege zuerst Begriffe fuer Lieferdatum, Lieferadresse und Positionen an.
          </div>
        ) : (
          <div style={ruleListStyle}>
            {rules.map((rule) => {
              const label = FIELD_OPTIONS.find((option) => option.value === rule.fieldKey)?.label || rule.fieldKey;

              return (
                <div key={rule.id} style={ruleRowStyle}>
                  <div style={ruleMainStyle}>
                    <div style={ruleTopStyle}>
                      <strong style={ruleTitleStyle}>{label}</strong>
                      <span style={ruleStatusStyle(rule.active)}>
                        {rule.active ? "Aktiv" : "Aus"}
                      </span>
                    </div>

                    <div style={ruleMetaStyle}>
                      {rule.sourceName ? <span>Quelle: {rule.sourceName}</span> : <span>Quelle: Alle</span>}
                    </div>

                    <div style={keywordBoxStyle}>{rule.keywords}</div>
                  </div>

                  <div style={ruleActionsStyle}>
                    <Form method="post">
                      <input type="hidden" name="_intent" value="toggle" />
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <input type="hidden" name="active" value={String(rule.active)} />
                      <button type="submit" style={secondaryButtonStyle}>
                        {rule.active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                    </Form>

                    <Form
                      method="post"
                      onSubmit={(event) => {
                        if (!window.confirm("Diese Import-Regel wirklich l" + String.fromCharCode(246) + "schen?")) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="_intent" value="delete" />
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <button type="submit" style={dangerButtonStyle}>
                        {"L" + String.fromCharCode(246) + "schen"}
                      </button>
                    </Form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      </div>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={fieldStyle}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const pageStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#057a67",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  fontSize: 11,
  fontWeight: 750,
};

const titleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#0f172a",
  fontSize: 34,
  letterSpacing: "-0.04em",
  fontWeight: 760,
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 15,
  fontWeight: 600,
  maxWidth: 760,
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe5eb",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.045)",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 22,
  color: "#0f172a",
  letterSpacing: "-0.025em",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1.4fr auto",
  gap: 14,
  alignItems: "end",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
};

const formActionStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 11,
  border: "1px solid #057a67",
  background: "#057a67",
  color: "#ffffff",
  padding: "0 16px",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(5, 122, 103, 0.16)",
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 36,
  borderRadius: 10,
  border: "1px solid #c8d4dd",
  background: "#ffffff",
  color: "#0f172a",
  padding: "0 12px",
  fontWeight: 750,
  cursor: "pointer",
  width: "100%",
};

const dangerButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  borderColor: "#ffc9c0",
  background: "#fff7f5",
  color: "#b42318",
};

const errorStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#9f1239",
  borderRadius: 14,
  padding: 14,
  fontWeight: 750,
};

const successStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  borderRadius: 14,
  padding: 14,
  fontWeight: 750,
};

const countPillStyle: React.CSSProperties = {
  border: "1px solid #dbe5eb",
  borderRadius: 999,
  padding: "7px 11px",
  color: "#475569",
  fontWeight: 800,
  fontSize: 12,
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  color: "#64748b",
  fontWeight: 650,
};

const ruleListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const ruleRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 170px",
  gap: 16,
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 14,
  alignItems: "center",
};

const ruleMainStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const ruleTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const ruleTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 16,
};

const ruleStatusStyle = (active: boolean): React.CSSProperties => ({
  border: "1px solid " + (active ? "#bbf7d0" : "#e2e8f0"),
  background: active ? "#f0fdf4" : "#f8fafc",
  color: active ? "#166534" : "#64748b",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 850,
});

const ruleMetaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 650,
};

const keywordBoxStyle: React.CSSProperties = {
  color: "#0f172a",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "9px 11px",
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 650,
  wordBreak: "break-word",
};

const ruleActionsStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};


const testGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 14,
  alignItems: "end",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  font: "inherit",
  resize: "vertical",
  minHeight: 110,
};

const matchBoxStyle: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid #dbe5eb",
  borderRadius: 14,
  padding: 14,
  background: "#f8fafc",
  display: "grid",
  gap: 10,
};

const matchListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const matchRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "180px 110px 1fr",
  gap: 10,
  alignItems: "center",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "10px 12px",
};

const matchEmptyStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontWeight: 650,
};
