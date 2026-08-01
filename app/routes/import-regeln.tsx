import { Form, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

import {
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import "../styles/gastario-module-workspace.css";

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
  const data =
    useLoaderData<typeof loader>();

  const actionData =
    useActionData<typeof action>();

  const anyAction =
    actionData as any;

  const rules =
    data.rules as any[];

  const safeEmailRules =
    rules.filter(
      (rule) =>
        rule.fieldKey ===
        "__classification__"
    );

  const pdfFieldRules =
    rules.filter(
      (rule) =>
        rule.fieldKey !==
        "__classification__"
    );

  return (
    <AppLayout>
      <PageShell className="modulePage">
        <PageHeader
          eyebrow="Eingang"
          title="Import-Regeln"
          subtitle="Lege fest, wie Gastario bestätigte Aufträge und wichtige Felder zuverlässig erkennt."
          actions={
            <div className="moduleHeaderStatus">
              <span className="moduleBadge moduleBadgeSuccess">
                {safeEmailRules.filter(
                  (rule) => rule.active
                ).length}
                {" aktiv"}
              </span>

              <span className="moduleBadge">
                {pdfFieldRules.length}
                {" PDF-Regeln"}
              </span>
            </div>
          }
        />

        {actionData &&
        "error" in actionData ? (
          <Notice type="danger">
            {actionData.error}
          </Notice>
        ) : null}

        {actionData &&
        "success" in actionData ? (
          <Notice type="success">
            {actionData.success}
          </Notice>
        ) : null}

        <PageSection
          eyebrow="Neue Regel"
          title="Wann ist eine E-Mail ein Auftrag?"
          description="Bei einem eindeutigen Treffer erstellt Gastario einen Prüfauftrag in der Eingangszentrale."
        >
          <Form
            method="post"
            className="moduleFormGrid moduleFormGridRule"
          >
            <input
              type="hidden"
              name="_intent"
              value="createClassificationRule"
            />

            <input
              type="hidden"
              name="documentType"
              value="ORDER_CONFIRMATION"
            />

            <input
              type="hidden"
              name="action"
              value="CREATE_REVIEW_ORDER"
            />

            <input
              type="hidden"
              name="matchMode"
              value="ALL"
            />

            <input
              type="hidden"
              name="priority"
              value="100"
            />

            <Field label="Regelname">
              <input
                name="name"
                required
                placeholder="Heycater – finale Bestätigung"
              />
            </Field>

            <Field label="Plattform oder Absender">
              <select
                name="senderContains"
                defaultValue="heycater"
              >
                <option value="heycater">
                  Heycater
                </option>

                <option value="feedr">
                  Feedr
                </option>

                <option value="egora">
                  Egora
                </option>

                <option value="">
                  Andere oder nicht festlegen
                </option>
              </select>
            </Field>

            <Field label="Betreff enthält">
              <input
                name="subjectContains"
                required
                placeholder="Bitte bestätige den Auftrag"
              />
            </Field>

            <Field label="Text enthält – optional">
              <input
                name="bodyContains"
                placeholder="hat Euer Angebot bestätigt"
              />
            </Field>

            <div className="moduleFormActions">
              <button
                type="submit"
                className="moduleButton moduleButtonPrimary"
              >
                Regel speichern
              </button>
            </div>
          </Form>
        </PageSection>

        <PageSection
          eyebrow="Gespeichert"
          title="Sichere E-Mail-Regeln"
          description="Aktive Regeln werden beim automatischen E-Mail-Abruf angewendet."
          actions={
            <span className="moduleCount">
              {safeEmailRules.length}
            </span>
          }
        >
          {safeEmailRules.length === 0 ? (
            <div className="moduleEmpty">
              <strong>
                Noch keine Regel vorhanden
              </strong>

              <span>
                Lege oben die erste sichere
                Erkennungsregel an.
              </span>
            </div>
          ) : (
            <div className="moduleList">
              {safeEmailRules.map(
                (rule) => (
                  <article
                    key={rule.id}
                    className="moduleListRow moduleRuleRow"
                  >
                    <div className="moduleListMain">
                      <div className="moduleTitleLine">
                        <strong>
                          {rule.name ||
                            "E-Mail-Regel"}
                        </strong>

                        <span
                          className={
                            rule.active
                              ? "moduleBadge moduleBadgeSuccess"
                              : "moduleBadge"
                          }
                        >
                          {rule.active
                            ? "Aktiv"
                            : "Aus"}
                        </span>
                      </div>

                      <div className="moduleMetaLine">
                        <span>
                          <small>
                            Plattform
                          </small>

                          <strong>
                            {rule.senderContains ||
                              "Alle"}
                          </strong>
                        </span>

                        <span>
                          <small>
                            Ergebnis
                          </small>

                          <strong>
                            Prüfauftrag
                          </strong>
                        </span>
                      </div>

                      {rule.subjectContains ? (
                        <div className="moduleKeyword">
                          <small>Betreff</small>

                          <span>
                            {rule.subjectContains}
                          </span>
                        </div>
                      ) : null}

                      {rule.bodyContains ? (
                        <div className="moduleKeyword">
                          <small>Text</small>

                          <span>
                            {rule.bodyContains}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="moduleRowActions moduleRuleActions">
                      <Form method="post">
                        <input
                          type="hidden"
                          name="_intent"
                          value="toggle"
                        />

                        <input
                          type="hidden"
                          name="ruleId"
                          value={rule.id}
                        />

                        <input
                          type="hidden"
                          name="active"
                          value={String(
                            rule.active
                          )}
                        />

                        <button
                          type="submit"
                          className="moduleButton moduleButtonSecondary"
                        >
                          {rule.active
                            ? "Deaktivieren"
                            : "Aktivieren"}
                        </button>
                      </Form>

                      <Form
                        method="post"
                        onSubmit={(event) => {
                          if (
                            !window.confirm(
                              "Diese E-Mail-Regel wirklich löschen?"
                            )
                          ) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input
                          type="hidden"
                          name="_intent"
                          value="delete"
                        />

                        <input
                          type="hidden"
                          name="ruleId"
                          value={rule.id}
                        />

                        <button
                          type="submit"
                          className="moduleButton moduleButtonDanger"
                        >
                          Löschen
                        </button>
                      </Form>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </PageSection>

        <details className="moduleAdvanced">
          <summary>
            <span>
              Erweiterte PDF-Erkennung
            </span>

            <small>
              {pdfFieldRules.length}
              {" Feldregeln"}
            </small>
          </summary>

          <div className="moduleAdvancedBody">
            <PageSection
              eyebrow="PDF-Test"
              title="Dokumenttext prüfen"
              description="Füge Text aus einem PDF ein und prüfe die aktuelle Erkennung."
              flat
            >
              <div className="moduleSectionActions">
                <Form method="post">
                  <input
                    type="hidden"
                    name="_intent"
                    value="seedDefaults"
                  />

                  <button
                    type="submit"
                    className="moduleButton moduleButtonSecondary"
                  >
                    Standardregeln einspielen
                  </button>
                </Form>
              </div>

              <Form
                method="post"
                className="moduleTestGrid"
              >
                <input
                  type="hidden"
                  name="_intent"
                  value="testText"
                />

                <label className="moduleField">
                  <span>PDF-Text</span>

                  <textarea
                    name="testText"
                    rows={5}
                    placeholder="Text aus einem PDF einfügen"
                    defaultValue={
                      anyAction?.testText || ""
                    }
                  />
                </label>

                <button
                  type="submit"
                  className="moduleButton moduleButtonPrimary"
                >
                  Testen
                </button>
              </Form>
            </PageSection>

            <PageSection
              eyebrow="Felderkennung"
              title="Erkennungswort hinzufügen"
              description="Lege zusätzliche Begriffe für Lieferdatum, Kunde, Adresse oder andere Felder fest."
              flat
            >
              <Form
                method="post"
                className="moduleFormGrid moduleFormGridPdf"
              >
                <input
                  type="hidden"
                  name="_intent"
                  value="create"
                />

                <Field label="Quelle – optional">
                  <input
                    name="sourceName"
                    placeholder="Heycater, Feedr oder Egora"
                  />
                </Field>

                <Field label="Feld">
                  <select
                    name="fieldKey"
                    defaultValue="deliveryDate"
                  >
                    {FIELD_OPTIONS.map(
                      (option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <Field label="Erkennungswörter">
                  <input
                    name="keywords"
                    placeholder="Lieferdatum, Eventdatum"
                  />
                </Field>

                <div className="moduleFormActions">
                  <button
                    type="submit"
                    className="moduleButton moduleButtonPrimary"
                  >
                    Feldregel speichern
                  </button>
                </div>
              </Form>
            </PageSection>
          </div>
        </details>
      </PageShell>
    </AppLayout>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="moduleField">
      <span>{label}</span>
      {children}
    </label>
  );
}