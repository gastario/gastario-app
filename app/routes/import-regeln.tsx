import { useState } from "react";
import { Form, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";
import {
  GastarioPage,
  GastarioHeader,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioNotice,
  GastarioSection,
  GastarioFormGrid,
  GastarioField,
  GastarioInput,
  GastarioSelect,
  GastarioTextarea,
  GastarioToolbar,
  GastarioDataList,
  GastarioDataRow,
  GastarioEmptyState,
  GastarioStack,
  GastarioDialog,
  GastarioDetailDialog,
  GastarioDetailTabs,
  GastarioDetailPane,
  gastarioButtonClass,
} from "../components/ui";




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
    const ruleId =
      safeText(formData.get("ruleId"));

    const name =
      safeText(formData.get("name"));

    const sourceName =
      safeText(formData.get("sourceName"));

    const senderContains =
      safeText(formData.get("senderContains"));

    const subjectContains =
      safeText(formData.get("subjectContains"));

    const bodyContains =
      safeText(formData.get("bodyContains"));

    const matchMode =
      safeText(
        formData.get("matchMode")
      ).toUpperCase() === "ALL"
        ? "ALL"
        : "ANY";

    const documentType =
      safeText(
        formData.get("documentType")
      );

    const ruleAction =
      safeText(
        formData.get("action")
      );

    const parsedPriority =
      Number(
        safeText(
          formData.get("priority")
        ) || "0"
      );

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
        error:
          "Bitte einen Namen für die feste Importregel eintragen.",
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

    if (
      !documentType ||
      !ruleAction
    ) {
      return {
        error:
          "Bitte Dokumenttyp und Aktion auswählen.",
      };
    }

    if (ruleId) {
      const updated =
        await prisma.$executeRawUnsafe(
          `UPDATE "OrderImportRule"
           SET
             "name" = $1,
             "sourceName" = $2,
             "senderContains" = $3,
             "subjectContains" = $4,
             "bodyContains" = $5,
             "matchMode" = $6,
             "documentType" = $7,
             "action" = $8,
             "priority" = $9,
             "updatedAt" = CURRENT_TIMESTAMP
           WHERE
             "id" = $10
             AND "tenantId" = $11
             AND "fieldKey" = '__classification__'`,
          name,
          sourceName || null,
          senderContains || null,
          subjectContains || null,
          bodyContains || null,
          matchMode,
          documentType,
          ruleAction,
          priority,
          ruleId,
          access.tenantId
        );

      if (!updated) {
        return {
          error:
            "Die E-Mail-Regel wurde nicht gefunden.",
        };
      }

      return {
        success:
          "E-Mail-Regel wurde gespeichert.",
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
      success:
        "Feste Importregel wurde gespeichert.",
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

  const activeEmailRules =
    safeEmailRules.filter(
      (rule) => Boolean(rule.active)
    ).length;
  const [
    selectedRuleId,
    setSelectedRuleId,
  ] = useState<string | null>(null);

  const [
    selectedRuleTab,
    setSelectedRuleTab,
  ] = useState("detection");

  const [
    createRuleOpen,
    setCreateRuleOpen,
  ] = useState(false);

  const [
    fieldRuleOpen,
    setFieldRuleOpen,
  ] = useState(false);

  const [
    pdfTestOpen,
    setPdfTestOpen,
  ] = useState(false);

  const selectedRule =
    safeEmailRules.find(
      (rule) =>
        rule.id === selectedRuleId
    ) || null;

  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Eingang"
          title="Import-Regeln"
          description="Lege fest, wie Gastario bestätigte Aufträge und wichtige Felder zuverlässig erkennt."
          actions={
            <button
              type="button"
              className={gastarioButtonClass("primary")}
              onClick={() =>
                setCreateRuleOpen(true)
              }
            >
              Neue Regel
            </button>
          }
        />

        <GastarioMetricGrid>
          <GastarioMetric
            label="Aktive E-Mail-Regeln"
            value={activeEmailRules}
            description="Werden beim automatischen Abruf angewendet"
          />

          <GastarioMetric
            label="E-Mail-Regeln"
            value={safeEmailRules.length}
            description="Regeln zur sicheren Auftragserkennung"
          />

          <GastarioMetric
            label="PDF-Feldregeln"
            value={pdfFieldRules.length}
            description="Zusätzliche Regeln zur Dokumenterkennung"
          />
        </GastarioMetricGrid>

        {actionData &&
        "error" in actionData ? (
          <GastarioNotice type="danger">
            {actionData.error}
          </GastarioNotice>
        ) : null}

        {actionData &&
        "success" in actionData ? (
          <GastarioNotice type="success">
            {actionData.success}
          </GastarioNotice>
        ) : null}

        <GastarioStack>
          <GastarioSection
            eyebrow="Gespeichert"
            title="Sichere E-Mail-Regeln"
            description="Aktive Regeln werden beim automatischen E-Mail-Abruf angewendet."
          >
            {safeEmailRules.length === 0 ? (
              <GastarioEmptyState title="Noch keine Regel vorhanden">
                Lege oben die erste sichere Erkennungsregel an.
              </GastarioEmptyState>
            ) : (
              <GastarioDataList>
                {safeEmailRules.map(
                  (rule) => (
                    <GastarioDataRow
                      key={rule.id}
                      onClick={() => {
                        setSelectedRuleId(
                          rule.id
                        );
                        setSelectedRuleTab(
                          "detection"
                        );
                      }}
                    >
                      <div className="g-ui-data-row-main">
                        <strong className="g-ui-data-row-title">
                          {rule.name || "E-Mail-Regel"}
                        </strong>

                        <span className="g-ui-data-row-description">
                          Plattform: {rule.senderContains || "Alle"}
                          {" · "}
                          Ergebnis: Prüfauftrag
                          {rule.subjectContains
                            ? ` · Betreff: ${rule.subjectContains}`
                            : ""}
                          {rule.bodyContains
                            ? ` · Text: ${rule.bodyContains}`
                            : ""}
                        </span>
                      </div>

                      <div className="g-ui-data-row-meta">
                        <strong>
                          {rule.active
                            ? "Aktiv"
                            : "Aus"}
                        </strong>
                      </div>
                      <span
                        className="g-ui-data-row-chevron"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </GastarioDataRow>
                  )
                )}
              </GastarioDataList>
            )}
          </GastarioSection>

          <GastarioSection
            eyebrow="PDF-Erkennung"
            title="Dokumenterkennung"
            description="Teste Dokumenttext und ergänze zusätzliche Erkennungswörter für wichtige Auftragsfelder."
          >
            <GastarioToolbar align="end">
              <Form method="post">
                <input
                  type="hidden"
                  name="_intent"
                  value="seedDefaults"
                />

                <button
                  type="submit"
                  className={gastarioButtonClass("secondary")}
                >
                  Standardregeln einspielen
                </button>
              </Form>
            </GastarioToolbar>

            <GastarioToolbar>
              <button
                type="button"
                className={gastarioButtonClass("secondary")}
                onClick={() =>
                  setPdfTestOpen(true)
                }
              >
                Dokumenttext prüfen
              </button>
            </GastarioToolbar>

            <GastarioToolbar>
              <button
                type="button"
                className={gastarioButtonClass("secondary")}
                onClick={() =>
                  setFieldRuleOpen(true)
                }
              >
                Erkennungswort hinzufügen
              </button>
            </GastarioToolbar>
          </GastarioSection>
        </GastarioStack>



        <GastarioDialog
          open={pdfTestOpen}
          title="Dokumenttext prüfen"
          description="Füge Text aus einem PDF ein und prüfe die aktuelle Erkennung."
          onClose={() =>
            setPdfTestOpen(false)
          }
          size="lg"
          footer={
            <GastarioToolbar>
              <button
                type="button"
                className={gastarioButtonClass("secondary")}
                onClick={() =>
                  setPdfTestOpen(false)
                }
              >
                Schließen
              </button>

              <button
                type="submit"
                form="pdf-test-form"
                className={gastarioButtonClass("primary")}
              >
                Testen
              </button>
            </GastarioToolbar>
          }
        >
          <Form
            id="pdf-test-form"
            method="post"
          >
            <input
              type="hidden"
              name="_intent"
              value="testText"
            />

            <GastarioField label="PDF-Text">
              <GastarioTextarea
                name="testText"
                rows={8}
                placeholder="Text aus einem PDF einfügen"
                defaultValue={
                  anyAction?.testText || ""
                }
              />
            </GastarioField>

            <GastarioNotice type="info">
              Der Test verändert keine Regeln oder Aufträge.
              Gastario prüft nur, welche vorhandenen
              Erkennungsregeln auf den Text reagieren.
            </GastarioNotice>
          </Form>
        </GastarioDialog>

        <GastarioDialog
          open={fieldRuleOpen}
          title="Erkennungswort hinzufügen"
          description="Lege zusätzliche Begriffe für Lieferdatum, Kunde, Adresse oder andere Felder fest."
          onClose={() =>
            setFieldRuleOpen(false)
          }
          size="lg"
          footer={
            <GastarioToolbar>
              <button
                type="button"
                className={gastarioButtonClass("secondary")}
                onClick={() =>
                  setFieldRuleOpen(false)
                }
              >
                Abbrechen
              </button>

              <button
                type="submit"
                form="create-field-rule-form"
                className={gastarioButtonClass("primary")}
              >
                Feldregel speichern
              </button>
            </GastarioToolbar>
          }
        >
          <Form
            id="create-field-rule-form"
            method="post"
          >
            <input
              type="hidden"
              name="_intent"
              value="create"
            />

            <GastarioFormGrid>
              <GastarioField label="Quelle – optional">
                <GastarioInput
                  name="sourceName"
                  placeholder="Heycater, Feedr oder Egora"
                />
              </GastarioField>

              <GastarioField
                label="Feld"
                required
              >
                <GastarioSelect
                  name="fieldKey"
                  defaultValue="deliveryDate"
                  required
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
                </GastarioSelect>
              </GastarioField>

              <GastarioField
                label="Erkennungswörter"
                required
              >
                <GastarioInput
                  name="keywords"
                  placeholder="Lieferdatum, Eventdatum"
                  required
                />
              </GastarioField>
            </GastarioFormGrid>

            <GastarioNotice type="info">
              Mehrere Begriffe können kommasepariert eingetragen werden.
            </GastarioNotice>
          </Form>
        </GastarioDialog>

        <GastarioDetailDialog
          open={Boolean(selectedRule)}
          title={
            selectedRule?.name ||
            "E-Mail-Regel"
          }
          description="Erkennungsregel bearbeiten und verwalten."
          onClose={() =>
            setSelectedRuleId(null)
          }
          footer={
            selectedRule ? (
              <GastarioToolbar>
                <button
                  type="button"
                  className={gastarioButtonClass("secondary")}
                  onClick={() =>
                    setSelectedRuleId(null)
                  }
                >
                  Schließen
                </button>

                <button
                  type="submit"
                  form="email-rule-detail-form"
                  name="_intent"
                  value="toggle"
                  formNoValidate
                  className={gastarioButtonClass("secondary")}
                >
                  {selectedRule.active
                    ? "Deaktivieren"
                    : "Aktivieren"}
                </button>

                <button
                  type="submit"
                  form="email-rule-detail-form"
                  name="_intent"
                  value="delete"
                  formNoValidate
                  className={gastarioButtonClass("danger")}
                  onClick={(event) => {
                    if (
                      !window.confirm(
                        "Diese E-Mail-Regel wirklich löschen?"
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  Löschen
                </button>

                <button
                  type="submit"
                  form="email-rule-detail-form"
                  name="_intent"
                  value="createClassificationRule"
                  className={gastarioButtonClass("primary")}
                >
                  Änderungen speichern
                </button>
              </GastarioToolbar>
            ) : null
          }
        >
          {selectedRule ? (
            <Form
              id="email-rule-detail-form"
              method="post"
              key={`${selectedRule.id}-${String(
                selectedRule.updatedAt || ""
              )}`}
            >
              <input
                type="hidden"
                name="ruleId"
                value={selectedRule.id}
              />

              <input
                type="hidden"
                name="active"
                value={String(
                  selectedRule.active
                )}
              />

              <input
                type="hidden"
                name="sourceName"
                value={
                  selectedRule.sourceName ||
                  ""
                }
              />

              <input
                type="hidden"
                name="documentType"
                value={
                  selectedRule.documentType ||
                  "ORDER_CONFIRMATION"
                }
              />

              <input
                type="hidden"
                name="action"
                value={
                  selectedRule.action ||
                  "CREATE_REVIEW_ORDER"
                }
              />

              <GastarioDetailTabs
                items={[
                  {
                    id: "detection",
                    label: "Erkennung",
                  },
                  {
                    id: "processing",
                    label: "Verarbeitung",
                  },
                ]}
                activeId={selectedRuleTab}
                onChange={setSelectedRuleTab}
              />

              <GastarioDetailPane
                active={
                  selectedRuleTab ===
                  "detection"
                }
              >
                <GastarioFormGrid>
                  <GastarioField
                    label="Regelname"
                    required
                  >
                    <GastarioInput
                      name="name"
                      defaultValue={
                        selectedRule.name ||
                        ""
                      }
                      required
                    />
                  </GastarioField>

                  <GastarioField label="Plattform oder Absender">
                    <GastarioInput
                      name="senderContains"
                      defaultValue={
                        selectedRule.senderContains ||
                        ""
                      }
                      placeholder="z. B. Heycater"
                    />
                  </GastarioField>

                  <GastarioField label="Betreff enthält">
                    <GastarioInput
                      name="subjectContains"
                      defaultValue={
                        selectedRule.subjectContains ||
                        ""
                      }
                      placeholder="z. B. Auftragsbestätigung"
                    />
                  </GastarioField>

                  <GastarioField label="Text enthält – optional">
                    <GastarioInput
                      name="bodyContains"
                      defaultValue={
                        selectedRule.bodyContains ||
                        ""
                      }
                      placeholder="Optionaler Begriff im Nachrichtentext"
                    />
                  </GastarioField>

                  <GastarioField label="Trefferlogik">
                    <GastarioSelect
                      name="matchMode"
                      defaultValue={
                        selectedRule.matchMode ||
                        "ALL"
                      }
                    >
                      <option value="ALL">
                        Alle Bedingungen müssen zutreffen
                      </option>

                      <option value="ANY">
                        Eine Bedingung reicht aus
                      </option>
                    </GastarioSelect>
                  </GastarioField>
                </GastarioFormGrid>
              </GastarioDetailPane>

              <GastarioDetailPane
                active={
                  selectedRuleTab ===
                  "processing"
                }
              >
                <GastarioDataList>
                  <GastarioDataRow>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        Ergebnis
                      </strong>

                      <span className="g-ui-data-row-description">
                        Erkannte Nachricht wird als Prüfauftrag
                        in die Eingangszentrale übernommen.
                      </span>
                    </div>

                    <div className="g-ui-data-row-meta">
                      Prüfauftrag
                    </div>
                  </GastarioDataRow>

                  <GastarioDataRow>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        Status
                      </strong>

                      <span className="g-ui-data-row-description">
                        Legt fest, ob diese Regel aktuell angewendet wird.
                      </span>
                    </div>

                    <div className="g-ui-data-row-meta">
                      <strong>
                        {selectedRule.active
                          ? "Aktiv"
                          : "Deaktiviert"}
                      </strong>
                    </div>
                  </GastarioDataRow>
                </GastarioDataList>

                <GastarioFormGrid>
                  <GastarioField label="Priorität">
                    <GastarioInput
                      name="priority"
                      type="number"
                      min="0"
                      max="1000"
                      defaultValue={
                        selectedRule.priority ??
                        100
                      }
                    />
                  </GastarioField>
                </GastarioFormGrid>
              </GastarioDetailPane>
            </Form>
          ) : null}
        </GastarioDetailDialog>

        <GastarioDialog
          open={createRuleOpen}
          title="Neue E-Mail-Regel"
          description="Lege fest, wann eine eingehende Nachricht automatisch als Auftrag erkannt wird."
          onClose={() =>
            setCreateRuleOpen(false)
          }
          size="lg"
          footer={
            <GastarioToolbar>
              <button
                type="button"
                className={gastarioButtonClass("secondary")}
                onClick={() =>
                  setCreateRuleOpen(false)
                }
              >
                Abbrechen
              </button>

              <button
                type="submit"
                form="create-email-rule-form"
                className={gastarioButtonClass("primary")}
              >
                Regel speichern
              </button>
            </GastarioToolbar>
          }
        >
          <Form
            id="create-email-rule-form"
            method="post"
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

            <GastarioFormGrid>
              <GastarioField
                label="Regelname"
                required
              >
                <GastarioInput
                  name="name"
                  required
                  placeholder="z. B. Heycater – finale Bestätigung"
                />
              </GastarioField>

              <GastarioField label="Plattform oder Absender">
                <GastarioSelect
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
                </GastarioSelect>
              </GastarioField>

              <GastarioField
                label="Betreff enthält"
                required
              >
                <GastarioInput
                  name="subjectContains"
                  required
                  placeholder="Bitte bestätige den Auftrag"
                />
              </GastarioField>

              <GastarioField label="Text enthält – optional">
                <GastarioInput
                  name="bodyContains"
                  placeholder="hat Euer Angebot bestätigt"
                />
              </GastarioField>
            </GastarioFormGrid>

            <GastarioNotice type="info">
              Bei einem eindeutigen Treffer erstellt Gastario einen
              Prüfauftrag in der Eingangszentrale.
            </GastarioNotice>
          </Form>
        </GastarioDialog>
      </GastarioPage>
    </AppLayout>
  );
}
