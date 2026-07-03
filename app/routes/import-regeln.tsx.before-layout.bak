import { Form, useActionData, useLoaderData } from "react-router";

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
  const rules = data.rules as any[];

  return (
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
