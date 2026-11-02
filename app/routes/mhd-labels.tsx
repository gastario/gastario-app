import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";
import {
  GastarioActionCard,
  GastarioActionGrid,
  GastarioButton,
  GastarioDataList,
  GastarioDataRow,
  GastarioDialog,
  GastarioDetailDialog,
  GastarioEmptyState,
  GastarioField,
  GastarioFormGrid,
  GastarioHeader,
  GastarioInput,
  GastarioNotice,
  GastarioPanel,
  GastarioSection,
  GastarioSelect,
  GastarioTabs,
} from "../components/ui";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateValue: string, days: number) {
  const date = new Date(dateValue + "T00:00:00.000Z");
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const date = new Date(raw + "T00:00:00.000Z");
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function toInputDate(value: Date | string | null | undefined) {
  if (!value) return todayInput();
  return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

function buildQrValue(label: any) {
  return "https://gastario-app-production.up.railway.app/mhd-labels?print=" + label.id;
}



export function meta() {
  return [{ title: "MHD-Labels · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");
  const { ensureFoodLabelTable } = await import("../lib/food-labels.server");

  const url = new URL(request.url);
  const printId = url.searchParams.get("print");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const access = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
  });

  if (!access?.tenant) {
    return {
      tenantName: "Gastario",
      labels: [],
      today: todayInput(),
    };
  }

  await ensureFoodLabelTable(prisma);

  const labels = await prisma.foodLabel.findMany({
    where: { tenantId: access.tenantId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const printLabel = printId
    ? await prisma.foodLabel.findFirst({
        where: {
          id: printId,
          tenantId: access.tenantId,
        },
      })
    : null;

  return {
    tenantName: access.tenant.name || "Gastario",
    labels,
    printLabel,
    today: todayInput(),
  };
}

export async function action({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");
  const { ensureFoodLabelTable, createFoodLabelPublicToken } = await import("../lib/food-labels.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const access = await prisma.tenantUser.findFirst({
    where: { userId },
  });

  if (!access) {
    return { error: "Kein Mandant gefunden." };
  }

  await ensureFoodLabelTable(prisma);

  const formData = await request.formData();
  const actionType = String(formData.get("_action") || "").trim();

  if (actionType === "delete") {
    const labelId = String(formData.get("labelId") || "").trim();

    if (!labelId) {
      return { error: "Label wurde nicht gefunden." };
    }

    await prisma.foodLabel.deleteMany({
      where: {
        id: labelId,
        tenantId: access.tenantId,
      },
    });

    return { success: "Label wurde geloescht." };
  }
  const intent = String(formData.get("intent") || "");

  if (intent === "createLabel") {
    const productName = String(formData.get("productName") || "").trim();
    const customerName = String(formData.get("customerName") || "").trim();
    const productionDate = parseDateInput(formData.get("productionDate"));
    const bestBeforeDate = parseDateInput(formData.get("bestBeforeDate"));
    const batchNumber = String(formData.get("batchNumber") || "").trim();
    const storageNote = String(formData.get("storageNote") || "").trim();
    const ingredients = String(formData.get("ingredients") || "").trim();
  const allergens = String(formData.get("allergens") || "").trim();
    const quantityText = String(formData.get("quantityText") || "").trim();
    const labelSize = String(formData.get("labelSize") || "76x51").trim();
    const labelCountRaw = Number(String(formData.get("labelCount") || "1"));
    const labelCount = Math.max(1, Math.min(Number.isFinite(labelCountRaw) ? labelCountRaw : 1, 200));

    if (!productName) return { error: "Produktname fehlt." };
    if (!productionDate) return { error: "Produktionsdatum fehlt." };
    if (!bestBeforeDate) return { error: "MHD fehlt." };

    await prisma.foodLabel.create({
      data: {
        tenantId: access.tenantId,
        productName,
        customerName: customerName || null,
        productionDate,
        bestBeforeDate,
        batchNumber: batchNumber || null,
        storageNote: storageNote || null,
        ingredients: ingredients || null,
        allergens: allergens || null,
        quantityText: quantityText || null,
        labelCount,
        labelSize,
        publicToken: createFoodLabelPublicToken(),
      },
    });

    return { success: "MHD-Label wurde gespeichert." };
  }

  return { error: "Unbekannte Aktion." };
}

export default function MhdLabelsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData =
    useActionData<typeof action>() as any;

  const today = data.today;
  const defaultMhd =
    addDays(today, 2);

  const [createOpen, setCreateOpen] =
    useState(false);

  const [createTab, setCreateTab] =
    useState("general");

  const [selectedId, setSelectedId] =
    useState<string | null>(
      data.printLabel?.id || null
    );

  const selected =
    selectedId
      ? data.labels.find(
          (label: any) =>
            label.id === selectedId
        ) ||
        (
          data.printLabel?.id ===
          selectedId
            ? data.printLabel
            : null
        )
      : null;

  return (
    <AppLayout>




      <section className="g-ui-screen-only">

        <GastarioHeader
          eyebrow="Betrieb"
          title="MHD-Labels"
        />


        {actionData?.error ? (
          <GastarioNotice type="danger">
            {actionData.error}
          </GastarioNotice>
        ) : null}


        {actionData?.success ? (
          <GastarioNotice type="success">
            {actionData.success}
          </GastarioNotice>
        ) : null}


        {/* ================================================
            AKTION
        ================================================= */}

        <GastarioSection
          title="Was möchtest du machen?"
          description="MHD-Labels erstellen, gespeicherte Etiketten öffnen und erneut drucken."
        >

          <GastarioActionGrid columns={3}>

            <GastarioActionCard
              title="MHD-Label erstellen"
              tone="sand"
              description="Produkt, Charge, MHD, Lagerhinweise und Druckformat erfassen."
              meta="Neu"
              onClick={() => {
                setCreateTab("general");
                setCreateOpen(true);
              }}
            />

          </GastarioActionGrid>

        </GastarioSection>


        {/* ================================================
            GESPEICHERTE LABELS
        ================================================= */}

        <GastarioSection
          eyebrow="Übersicht"
          title="Gespeicherte MHD-Labels"
          description={
            data.labels.length === 1
              ? "1 MHD-Label gespeichert"
              : `${data.labels.length} MHD-Labels gespeichert`
          }
        >

          {data.labels.length === 0 ? (

            <GastarioEmptyState
              title="Noch keine MHD-Labels"
            >
              Erstelle dein erstes MHD-Label
              über die Aktion oben.
            </GastarioEmptyState>

          ) : (

            <GastarioDataList>

              {data.labels.map(
                (label: any) => (

                  <GastarioDataRow
                    key={label.id}
                    onClick={() => {
                      setSelectedId(
                        label.id
                      );
                    }}
                  >

                    <div className="g-ui-data-row-main">

                      <strong className="g-ui-data-row-title">
                        {label.productName}
                      </strong>

                      <span className="g-ui-data-row-description">
                        MHD:{" "}
                        {formatDate(
                          label.bestBeforeDate
                        )}
                        {" · "}
                        Charge:{" "}
                        {label.batchNumber ||
                          "–"}
                      </span>

                    </div>


                    <div className="g-ui-data-row-meta">

                      <span>
                        {label.labelCount} Labels
                      </span>

                      <span>
                        {label.labelSize}
                      </span>

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


        {/* ================================================
            NEUES MHD-LABEL
        ================================================= */}

        <GastarioDialog
          open={createOpen}
          title="Neues MHD-Label"
          description="Produktdaten erfassen und anschließend direkt drucken."
          size="xl"
          onClose={() =>
            setCreateOpen(false)
          }
          footer={
            <>

              <GastarioButton
                type="button"
                variant="secondary"
                onClick={() =>
                  setCreateOpen(false)
                }
              >
                Abbrechen
              </GastarioButton>


              <GastarioButton
                type="submit"
                variant="primary"
                form="mhd-label-create-form"
              >
                Label speichern
              </GastarioButton>

            </>
          }
        >

          <GastarioTabs
            activeId={createTab}
            onChange={setCreateTab}
            items={[
              {
                id: "general",
                label: "Allgemein",
              },
              {
                id: "content",
                label: "Inhalt",
              },
              {
                id: "output",
                label: "Ausgabe",
              },
            ]}
          />


          <Form
            id="mhd-label-create-form"
            method="post"
            className="g-ui-dialog-form"
          >

            <input
              type="hidden"
              name="intent"
              value="createLabel"
            />


            {/* ALLGEMEIN */}

            <div
              className="g-ui-form-section"
              hidden={
                createTab !== "general"
              }
            >

              <div className="g-ui-form-section-heading">

                <h3>Allgemein</h3>

                <p>
                  Produkt und Haltbarkeit
                  festlegen.
                </p>

              </div>


              <GastarioFormGrid columns={2}>

                <GastarioField
                  label="Produktname"
                  required
                >

                  <GastarioInput
                    name="productName"
                    placeholder="z. B. Chicken Bowl"
                    required
                  />

                </GastarioField>


                <GastarioField
                  label="Kunde"
                >

                  <GastarioInput
                    name="customerName"
                    placeholder="Optional"
                  />

                </GastarioField>


                <GastarioField
                  label="Produziert am"
                  required
                >

                  <GastarioInput
                    name="productionDate"
                    type="date"
                    defaultValue={today}
                    required
                  />

                </GastarioField>


                <GastarioField
                  label="MHD / Verbrauchsdatum"
                  required
                >

                  <GastarioInput
                    name="bestBeforeDate"
                    type="date"
                    defaultValue={
                      defaultMhd
                    }
                    required
                  />

                </GastarioField>

              </GastarioFormGrid>

            </div>


            {/* INHALT */}

            <div
              className="g-ui-form-section"
              hidden={
                createTab !== "content"
              }
            >

              <div className="g-ui-form-section-heading">

                <h3>Inhalt</h3>

                <p>
                  Charge, Menge und
                  Produktinformationen
                  ergänzen.
                </p>

              </div>


              <GastarioFormGrid columns={2}>

                <GastarioField
                  label="Charge / Losnummer"
                >

                  <GastarioInput
                    name="batchNumber"
                    defaultValue={
                      "CH-" +
                      today.replaceAll(
                        "-",
                        ""
                      ) +
                      "-001"
                    }
                  />

                </GastarioField>


                <GastarioField
                  label="Menge / Portion"
                >

                  <GastarioInput
                    name="quantityText"
                    defaultValue="1 Portion"
                  />

                </GastarioField>


                <GastarioField
                  label="Lagerhinweis"
                >

                  <GastarioInput
                    name="storageNote"
                    defaultValue="Gekühlt lagern bei max. +7 °C"
                  />

                </GastarioField>


                <GastarioField
                  label="Zutaten"
                >

                  <GastarioInput
                    name="ingredients"
                    placeholder="z. B. Reis, Hähnchen, Gemüse, Sauce"
                  />

                </GastarioField>


                <GastarioField
                  label="Allergene"
                >

                  <GastarioInput
                    name="allergens"
                    placeholder="z. B. Soja, Sesam, Gluten"
                  />

                </GastarioField>

              </GastarioFormGrid>

            </div>


            {/* AUSGABE */}

            <div
              className="g-ui-form-section"
              hidden={
                createTab !== "output"
              }
            >

              <div className="g-ui-form-section-heading">

                <h3>Ausgabe</h3>

                <p>
                  Druckformat und benötigte
                  Anzahl festlegen.
                </p>

              </div>


              <GastarioFormGrid columns={2}>

                <GastarioField
                  label="Druckformat"
                >

                  <GastarioSelect
                    name="labelSize"
                    defaultValue="76x51"
                  >

                    <option value="a4-2">
                      A4 Hochformat – 2 Labels pro Reihe
                    </option>

                    <option value="a4-3">
                      A4 Hochformat – 3 Labels pro Reihe
                    </option>

                    <option value="a4-4">
                      A4 Hochformat – 4 Labels pro Reihe
                    </option>

                    <option value="76x51">
                      Etikettenrolle – 76 × 51 mm
                    </option>

                    <option value="57x32">
                      Etikettenrolle – 57 × 32 mm
                    </option>

                  </GastarioSelect>

                </GastarioField>


                <GastarioField
                  label="Anzahl Labels"
                >

                  <GastarioInput
                    name="labelCount"
                    type="number"
                    min="1"
                    max="200"
                    defaultValue="12"
                  />

                </GastarioField>

              </GastarioFormGrid>

            </div>

          </Form>

        </GastarioDialog>


        {/* ================================================
            DETAILDIALOG
        ================================================= */}

        <GastarioDetailDialog
          open={Boolean(selected)}
          size="xl"
          title={
            selected?.productName ||
            "MHD-Label"
          }
          description={
            selected
              ? `MHD ${formatDate(
                  selected.bestBeforeDate
                )} · Charge ${
                  selected.batchNumber ||
                  "–"
                }`
              : undefined
          }
          onClose={() =>
            setSelectedId(null)
          }
          footer={
            selected ? (
              <>

                <Form
                  method="post"
                  onSubmit={(event) => {

                    if (
                      !window.confirm(
                        "Dieses MHD-Label wirklich löschen?"
                      )
                    ) {
                      event.preventDefault();
                    }

                  }}
                >

                  <input
                    type="hidden"
                    name="_action"
                    value="delete"
                  />

                  <input
                    type="hidden"
                    name="labelId"
                    value={selected.id}
                  />


                  <GastarioButton
                    type="submit"
                    variant="danger"
                  >
                    Löschen
                  </GastarioButton>

                </Form>


                <GastarioButton
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setSelectedId(null)
                  }
                >
                  Schließen
                </GastarioButton>


                <Link
                  to={`/mhd-labels/print/${selected.id}`}
                  className="g-ui-button g-ui-button--primary"
                >
                  Drucken
                </Link>

              </>
            ) : null
          }
        >

          {selected ? (

            <div className="g-ui-detail-stack">


              <GastarioPanel variant="soft">

                <LabelCard
                  label={selected}
                  tenantName={
                    data.tenantName
                  }
                />

              </GastarioPanel>


              <div className="g-ui-detail-meta">

                <div>

                  <span>
                    MHD / Verbrauchsdatum
                  </span>

                  <strong>
                    {formatDate(
                      selected.bestBeforeDate
                    )}
                  </strong>

                </div>


                <div>

                  <span>
                    Produziert am
                  </span>

                  <strong>
                    {formatDate(
                      selected.productionDate
                    )}
                  </strong>

                </div>


                <div>

                  <span>
                    Charge
                  </span>

                  <strong>
                    {selected.batchNumber ||
                      "–"}
                  </strong>

                </div>


                <div>

                  <span>
                    Anzahl
                  </span>

                  <strong>
                    {selected.labelCount} Labels
                  </strong>

                </div>

              </div>


              <GastarioDataList>

                <GastarioDataRow>

                  <div className="g-ui-data-row-main">

                    <strong className="g-ui-data-row-title">
                      Menge / Portion
                    </strong>

                    <span className="g-ui-data-row-description">
                      {selected.quantityText ||
                        "Keine Angabe"}
                    </span>

                  </div>

                </GastarioDataRow>


                {selected.customerName ? (

                  <GastarioDataRow>

                    <div className="g-ui-data-row-main">

                      <strong className="g-ui-data-row-title">
                        Kunde
                      </strong>

                      <span className="g-ui-data-row-description">
                        {selected.customerName}
                      </span>

                    </div>

                  </GastarioDataRow>

                ) : null}


                {selected.storageNote ? (

                  <GastarioDataRow>

                    <div className="g-ui-data-row-main">

                      <strong className="g-ui-data-row-title">
                        Lagerhinweis
                      </strong>

                      <span className="g-ui-data-row-description">
                        {selected.storageNote}
                      </span>

                    </div>

                  </GastarioDataRow>

                ) : null}

              </GastarioDataList>


              {selected.ingredients ? (

                <GastarioPanel variant="soft">

                  <strong>
                    Zutaten
                  </strong>

                  <div>
                    {selected.ingredients}
                  </div>

                </GastarioPanel>

              ) : null}


              {selected.allergens ? (

                <GastarioPanel variant="soft">

                  <strong>
                    Allergene
                  </strong>

                  <div>
                    {selected.allergens}
                  </div>

                </GastarioPanel>

              ) : null}

            </div>

          ) : null}

        </GastarioDetailDialog>

      </section>


      {/* ================================================
          REINER DRUCKBEREICH
      ================================================= */}

      <section className="g-ui-print-only">

        {data.printLabel
          ? Array.from(
              {
                length:
                  data.printLabel
                    .labelCount,
              },
              (_, index) => (

                <LabelCard
                  key={index}
                  label={
                    data.printLabel
                  }
                  tenantName={
                    data.tenantName
                  }
                />

              )
            )
          : null}

      </section>

    </AppLayout>
  );
}


function QrCode({ value }: { value: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(value, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 160,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    }).then((url) => {
      if (active) setSrc(url);
    });

    return () => {
      active = false;
    };
  }, [value]);

  if (!src) {
    return <div className="g-ui-mhd-qr-placeholder" />;
  }

  return <img src={src} alt="QR-Code" className="g-ui-mhd-qr" />;
}

function LabelCard({ label, tenantName }: { label: any; tenantName: string }) {
  const isSmall = label.labelSize === "57x32";

  return (
    <article
      className={
        isSmall
          ? "g-ui-label-card g-ui-mhd-label-card g-ui-mhd-label-card--small"
          : "g-ui-label-card g-ui-mhd-label-card"
      }
    >
      <div className="g-ui-mhd-label-top">
        <strong>{label.quantityText || ""}</strong>
        <span className="g-ui-mhd-label-brand">{tenantName}</span>
      </div>

      {label.customerName ? (
        <div className="g-ui-mhd-label-customer">
          {label.customerName}
        </div>
      ) : null}

      <h3
        className={
          isSmall
            ? "g-ui-mhd-label-product g-ui-mhd-label-product--small"
            : "g-ui-mhd-label-product"
        }
      >
        {label.productName}
      </h3>

      <div className="g-ui-mhd-label-dates">
        <span>mindestens haltbar bis: <strong>{formatDate(label.bestBeforeDate)}</strong></span>
        <span>hergestellt am: <strong>{formatDate(label.productionDate)}</strong></span>
      </div>

      <div className="g-ui-mhd-label-batch">
        Los/Charge:{" "}
        {label.batchNumber
          ? label.batchNumber.startsWith("L")
            ? label.batchNumber
            : "L-" + label.batchNumber
          : "-"}
      </div>

      {label.storageNote ? (
        <div className="g-ui-mhd-label-storage">
          {label.storageNote}
        </div>
      ) : null}

      <div className="g-ui-mhd-label-bottom">
        <div className="g-ui-mhd-label-allergens">
          <span>Allergene:</span>
          <strong>{label.allergens || "-"}</strong>
        </div>

        <QrCode value={buildQrValue(label)} />
      </div>
    </article>
  );
}
