import { useState } from "react";
﻿
import { Form, useActionData, useLoaderData } from "react-router";

const SOURCES = [
  { value: "DIRECT", label: "Direkt" },
  { value: "HEYCATER", label: "Heycater" },
  { value: "EGORA", label: "Egora" },
  { value: "EMAIL", label: "E-Mail" },
  { value: "WEBSITE", label: "Website" },
];

const STATUSES = [
  { value: "AUTO_CREATED", label: "Prüfen" },
  { value: "CONFIRMED", label: "Übernommen" },
  { value: "REJECTED", label: "Abgelehnt" },
];

function euroToCents(value: FormDataEntryValue | null) {
  const raw = String(value || "0").replace(",", ".").trim();
  const number = Number(raw);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100);
}

function centsToEuro(value: number | null | undefined) {
  return ((value || 0) / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function createOrderNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.floor(1000 + Math.random() * 9000);
  return "GA-" + date + "-" + random;
}

export async function loader({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    return {
      tenant: null,
      orders: [],
      activeStatus: "",
      counts: { all: 0, review: 0, confirmed: 0, rejected: 0 },
      setupError: "Nicht angemeldet. Bitte neu einloggen.",
    };
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
  });

  if (!tenantUser) {
    return {
      tenant: null,
      orders: [],
      activeStatus: "",
      counts: { all: 0, review: 0, confirmed: 0, rejected: 0 },
      setupError: "Kein Mandant gefunden. Bitte diesen Benutzer im Super Admin einem Mandanten zuordnen.",
    };
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";

  try {
    const orders = await prisma.order.findMany({
      where: {        ...(status ? { status: status as any } : {}),
      },
      include: {
        items: true,
        customer: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    const counts = await Promise.all([
      prisma.order.count({ where: { tenantId: tenantUser.tenantId } }),
      prisma.order.count({ where: { tenantId: tenantUser.tenantId, status: "AUTO_CREATED" as any } }),
      prisma.order.count({ where: { tenantId: tenantUser.tenantId, status: "CONFIRMED" as any } }),
      prisma.order.count({ where: { tenantId: tenantUser.tenantId, status: "REJECTED" as any } }),
    ]);

    return {
      tenant: tenantUser.tenant,
      orders,
      activeStatus: status,
      counts: {
        all: counts[0],
        review: counts[1],
        confirmed: counts[2],
        rejected: counts[3],
      },
      setupError: null,
    };
  } catch (error: any) {
    console.error("Auftragseingang loader failed:", error);

    return {
      tenant: tenantUser.tenant,
      orders: [],
      activeStatus: status,
      counts: { all: 0, review: 0, confirmed: 0, rejected: 0 },
      setupError: "Auftragseingang konnte die Auftragsdaten nicht laden. Wahrscheinlich ist die Railway-Datenbank noch nicht synchron oder es fehlen Tabellen/Spalten.",
    };
  }
}

export async function action({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    return { error: "Nicht angemeldet." };
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
  });

  if (!tenantUser) {
    return { error: "Kein Mandant gefunden." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createOrder") {
    const source = String(formData.get("source") || "DIRECT");
    const externalOrderNumber = String(formData.get("externalOrderNumber") || "").trim();

    const customerName = String(formData.get("customerName") || "").trim();
    const customerEmail = String(formData.get("customerEmail") || "").trim().toLowerCase();
    const customerPhone = String(formData.get("customerPhone") || "").trim();

    const eventName = String(formData.get("eventName") || "").trim();
    const deliveryDateRaw = String(formData.get("deliveryDate") || "").trim();
    const deliveryTime = String(formData.get("deliveryTime") || "").trim();
    const deliveryAddress = String(formData.get("deliveryAddress") || "").trim();

    const contactName = String(formData.get("contactName") || "").trim();
    const contactPhone = String(formData.get("contactPhone") || "").trim();

    const itemKinds = formData.getAll("itemKind").map((value) => String(value || "item"));
    const itemNames = formData.getAll("itemName").map((value) => String(value || "").trim());
    const quantities = formData.getAll("quantity").map((value) => Number(value || 1));
    const units = formData.getAll("unit").map((value) => String(value || "Stück").trim());
    const unitCentsList = formData.getAll("unitPriceEuro").map((value) => euroToCents(value));
    const discountPercents = formData.getAll("discountPercent").map((value) => Number(String(value || "0").replace(",", ".")));
    const taxRates = formData.getAll("taxRate").map((value) => Number(value || 19));
    const itemNotes = formData.getAll("itemNotes").map((value) => String(value || "").trim());
    const notes = String(formData.get("notes") || "").trim();

    const items = itemNames
      .map((name, index) => {
        const kind = itemKinds[index] === "text" ? "text" : "item";
        const quantity = kind === "text" ? 1 : Number.isFinite(quantities[index]) && quantities[index] > 0 ? quantities[index] : 1;
        const unitCents = kind === "text" ? 0 : unitCentsList[index] || 0;
        const discountPercent = Number.isFinite(discountPercents[index]) ? Math.max(0, discountPercents[index]) : 0;
        const taxRate = Number.isFinite(taxRates[index]) ? taxRates[index] : 19;
        const netBeforeDiscount = unitCents * quantity;
        const discountCents = Math.round(netBeforeDiscount * (discountPercent / 100));
        const totalCents = Math.max(0, netBeforeDiscount - discountCents);

        const metaNotes = [
          itemNotes[index] || "",
          kind === "text" ? "Freitext" : "",
          kind === "item" ? "MwSt " + taxRate + "%" : "",
          kind === "item" && discountPercent > 0 ? "Rabatt " + discountPercent + "%" : "",
        ].filter(Boolean).join(" | ");

        return {
          name,
          quantity,
          unit: kind === "text" ? "Text" : units[index] || "Stück",
          unitCents,
          totalCents,
          notes: metaNotes || null,
        };
      })
      .filter((item) => item.name);

    if (!customerName) {
      return { error: "Kundenname fehlt." };
    }

    if (items.length === 0) {
      return { error: "Mindestens eine Position fehlt." };
    }

    let customer = await prisma.customer.findFirst({
      where: {        OR: [
          ...(customerEmail ? [{ email: customerEmail }] : []),
          { name: customerName },
        ],
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {          name: customerName,
          email: customerEmail || null,
          phone: customerPhone || null,
        } as any,
      });
    }

    const deliveryDate = deliveryDateRaw ? new Date(deliveryDateRaw + "T00:00:00") : null;

    const order = await prisma.order.create({
      data: {        customerId: customer.id,
        orderNumber: createOrderNumber(),
        externalOrderNumber: externalOrderNumber || null,
        source: source as any,
        status: "AUTO_CREATED" as any,        customerName,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        eventName: eventName || null,
        deliveryDate,
        deliveryTime: deliveryTime || null,
        deliveryAddress: deliveryAddress || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        notes: notes || null,
      } as any,
    });

    await prisma.orderItem.createMany({
      data: items.map((item) => ({
        orderId: order.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitCents: item.unitCents,
        totalCents: item.totalCents,
        notes: item.notes,
      })),
    });

    return { success: "Auftrag wurde angelegt." };
  }

  if (intent === "updateStatus") {
    const orderId = String(formData.get("orderId") || "");
    const status = String(formData.get("status") || "AUTO_CREATED");

    if (!orderId) {
      return { error: "Auftrag fehlt." };
    }

    await prisma.order.updateMany({
      where: {
        id: orderId,      },
      data: {
        status: status as any,
      },
    });

    return { success: "Auftragsstatus wurde aktualisiert." };
  }

  if (intent === "deleteOrder") {
    const orderId = String(formData.get("orderId") || "");

    if (!orderId) {
      return { error: "Auftrag fehlt." };
    }

    await prisma.orderItem.deleteMany({
      where: {
        orderId,      },
    });

    await prisma.order.deleteMany({
      where: {
        id: orderId,      },
    });

    return { success: "Auftrag wurde gelöscht." };
  }

  return { error: "Unbekannte Aktion." };
}

function statusLabel(status: string) {
  if (status === "AUTO_CREATED") return "Prüfen";
  if (status === "CONFIRMED") return "Übernommen";
  if (status === "REJECTED") return "Abgelehnt";
  return status;
}

function sourceLabel(source: string) {
  const item = SOURCES.find((entry) => entry.value === source);
  return item?.label || source;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

export default function AuftragseingangPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [liveNetTotalCents, setLiveNetTotalCents] = useState(0);
  const [positionRows, setPositionRows] = useState<Array<{ id: number; type: "item" | "text" }>>([
    { id: Date.now(), type: "item" },
  ]);

  function parseEuroInput(value: string) {
    const normalized = String(value || "")
      .replace(/€/g, "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");

    const amount = Number(normalized);
    if (!Number.isFinite(amount)) return 0;

    return Math.round(amount * 100);
  }

  function formatEuroCents(value: number) {
    return (value / 100).toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
    });
  }

  function recalculatePositionTotals(form: HTMLFormElement) {
    let netTotalCents = 0;

    const rows = Array.from(form.querySelectorAll('[data-position-row="item"]'));

    for (const row of rows) {
      const quantityInput = row.querySelector('input[name="quantity"]') as HTMLInputElement | null;
      const priceInput = row.querySelector('input[name="unitPriceEuro"]') as HTMLInputElement | null;
      const discountInput = row.querySelector('input[name="discountPercent"]') as HTMLInputElement | null;
      const totalElement = row.querySelector('[data-line-total]') as HTMLElement | null;

      const quantity = Number(String(quantityInput?.value || "1").replace(",", "."));
      const unitCents = parseEuroInput(priceInput?.value || "0");
      const discountPercent = Number(String(discountInput?.value || "0").replace(",", "."));

      const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
      const safeDiscount = Number.isFinite(discountPercent) && discountPercent > 0 ? discountPercent : 0;

      const beforeDiscount = Math.round(unitCents * safeQuantity);
      const discountCents = Math.round(beforeDiscount * (safeDiscount / 100));
      const lineTotal = Math.max(0, beforeDiscount - discountCents);

      netTotalCents += lineTotal;

      if (totalElement) {
        totalElement.textContent = formatEuroCents(lineTotal);
      }
    }

    setLiveNetTotalCents(netTotalCents);
  }

  if (data.setupError) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#edf2f6",
        padding: 32,
        fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        color: "#07111f"
      }}>
        <section style={{
          maxWidth: 760,
          background: "white",
          border: "1px solid #dbe5ee",
          borderRadius: 28,
          padding: 28,
          boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)"
        }}>
          <div style={{
            color: "#0f766e",
            textTransform: "uppercase",
            letterSpacing: ".11em",
            fontSize: 11,
            fontWeight: 950,
            marginBottom: 8
          }}>
            Gastario
          </div>

          <h1 style={{
            margin: 0,
            fontSize: 38,
            lineHeight: 1,
            letterSpacing: "-0.055em"
          }}>
            Kein Mandant zugeordnet
          </h1>

          <p style={{
            margin: "14px 0 0",
            color: "#475569",
            fontWeight: 750,
            lineHeight: 1.55
          }}>
            {data.setupError}
          </p>

          <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
            <a href="/logout" style={{
              border: "1px solid #dbe5ee",
              background: "white",
              color: "#07111f",
              borderRadius: 999,
              padding: "12px 16px",
              fontWeight: 950,
              textDecoration: "none"
            }}>
              Ausloggen
            </a>

            <a href="/login" style={{
              border: "none",
              background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
              color: "white",
              borderRadius: 999,
              padding: "12px 16px",
              fontWeight: 950,
              textDecoration: "none"
            }}>
              Neu einloggen
            </a>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#edf2f6",
      padding: 32,
      fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      color: "#07111f"
    }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 20,
        alignItems: "flex-start",
        marginBottom: 24
      }}>
        <div>
          <div style={{
            color: "#0f766e",
            textTransform: "uppercase",
            letterSpacing: ".11em",
            fontSize: 11,
            fontWeight: 950,
            marginBottom: 8
          }}>
            Gastario
          </div>
          <h1 style={{
            margin: 0,
            fontSize: 44,
            lineHeight: .95,
            letterSpacing: "-0.065em"
          }}>
            Auftragseingang
          </h1>
          <p style={{
            margin: "12px 0 0",
            color: "#64748b",
            fontWeight: 700
          }}>
            Neue Aufträge erfassen, prüfen und übernehmen.
          </p>
        </div>

        <div style={{
          background: "white",
          border: "1px solid #dbe5ee",
          borderRadius: 14,
          padding: 14,
          fontWeight: 900
        }}>
          {data.tenant?.name}
        </div>
      </header>

      {data.setupError ? (
        <div style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          color: "#9a3412",
          padding: 16,
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {data.setupError}
        </div>
      ) : null}

      {actionData?.success ? (
        <div style={{
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          color: "#065f46",
          padding: 16,
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {actionData.success}
        </div>
      ) : null}

      {actionData?.error ? (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#991b1b",
          padding: 16,
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {actionData.error}
        </div>
      ) : null}

      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 16,
        marginBottom: 20
      }}>
        {[
          ["Alle", data.counts.all, ""],
          ["Prüfen", data.counts.review, "AUTO_CREATED"],
          ["Übernommen", data.counts.confirmed, "CONFIRMED"],
          ["Abgelehnt", data.counts.rejected, "REJECTED"],
        ].map(([label, count, status]) => (
          <a
            key={String(label)}
            href={status ? "/auftragseingang?status=" + status : "/auftragseingang"}
            style={{
              background: data.activeStatus === status ? "#0f766e" : "white",
              color: data.activeStatus === status ? "white" : "#07111f",
              border: "1px solid #dbe5ee",
              borderRadius: 24,
              padding: 20,
              textDecoration: "none",
              boxShadow: "0 12px 32px rgba(15, 23, 42, 0.07)"
            }}
          >
            <div style={{ color: data.activeStatus === status ? "#ccfbf1" : "#64748b", fontWeight: 900, fontSize: 13 }}>
              {label}
            </div>
            <div style={{ fontWeight: 950, fontSize: 36, letterSpacing: "-0.05em" }}>
              {count}
            </div>
          </a>
        ))}
      </section>

      <section style={{
        background: "white",
        border: "1px solid #dbe5ee",
        borderRadius: 28,
        padding: 22,
        boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)",
        marginBottom: 20
      }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            color: "#0f766e",
            textTransform: "uppercase",
            letterSpacing: ".10em",
            fontSize: 11,
            fontWeight: 950
          }}>
            Neuer Auftrag
          </div>
          <h2 style={{ margin: "5px 0 0", fontSize: 24, letterSpacing: "-0.04em" }}>
            Auftrag manuell erfassen
          </h2>
        </div>

        <Form
          method="post"
          onInput={(event) => recalculatePositionTotals(event.currentTarget)}
          onChange={(event) => recalculatePositionTotals(event.currentTarget)}
          style={{ display: "grid", gap: 14 }}
        >
          <input type="hidden" name="intent" value="createOrder" />

          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Quelle
              <select name="source" defaultValue="DIRECT" style={inputStyle}>
                {SOURCES.map((source) => (
                  <option key={source.value} value={source.value}>{source.label}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Externe Nummer optional
              <input name="externalOrderNumber" placeholder="z. B. Heycater ID" style={inputStyle} />
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Kunde
              <input name="customerName" placeholder="Firma / Kunde" style={inputStyle} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <input name="customerEmail" type="email" placeholder="Kunden-E-Mail" style={inputStyle} />
            <input name="customerPhone" placeholder="Kunden-Telefon" style={inputStyle} />
            <input name="eventName" placeholder="Event / Anlass" style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "180px 160px 1fr", gap: 12 }}>
            <input name="deliveryDate" type="date" style={inputStyle} />
            <input name="deliveryTime" placeholder="Uhrzeit" style={inputStyle} />
            <input name="deliveryAddress" placeholder="Lieferadresse" style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input name="contactName" placeholder="Ansprechpartner vor Ort" style={inputStyle} />
            <input name="contactPhone" placeholder="Telefon vor Ort" style={inputStyle} />
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ color: "#0f766e", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 11, fontWeight: 950 }}>
                  Positionen
                </div>
                <h3 style={{ margin: "4px 0 0", fontSize: 18, letterSpacing: "-0.03em" }}>
                  Positionen
                </h3>
              </div>
              <div style={{ color: "#64748b", fontSize: 13, fontWeight: 750 }}>
                {positionRows.length} / 50 Positionen
              </div>
            </div>

            <div style={{
              border: "1px solid #d6d6d6",
              borderRadius: 4,
              background: "#ffffff",
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)"
            }}>
              {positionRows.map((row, rowIndex) => (
                <div key={row.id} style={{
                  display: "grid",
                  gridTemplateColumns: row.type === "text"
                    ? "42px minmax(0, 1fr) 42px"
                    : "42px minmax(300px, 1fr) 86px 110px 130px 86px 88px 98px 34px",
                  gap: 8,
                  alignItems: "center",
                  padding: "14px 16px",
                  borderTop: rowIndex === 0 ? "none" : "1px solid #e5edf5",
                  background: row.type === "text" ? "#fbfdff" : "#ffffff"
                }}
                data-position-row={row.type}
                >
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#eeeeee",
                    color: "#555555",
                    fontWeight: 950
                  }}>
                    {rowIndex + 1}
                  </div>

                  {row.type === "text" ? (
                    <>
                      <input type="hidden" name="itemKind" value="text" />
                      <input type="hidden" name="quantity" value="1" />
                      <input type="hidden" name="unit" value="Text" />
                      <input type="hidden" name="unitPriceEuro" value="0" />
                      <input type="hidden" name="discountPercent" value="0" />
                      <input type="hidden" name="taxRate" value="0" />
                      <input type="hidden" name="itemNotes" value="" />

                      <textarea
                        name="itemName"
                        placeholder="Freitext, z. B. Aufbauhinweis, Sonderwunsch, interne Info"
                        rows={4}
                        style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setPositionRows((rows) => rows.filter((item) => item.id !== row.id))
                        }
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#777777",
                          borderRadius: 4,
                          minHeight: 36,
                          cursor: "pointer",
                          fontWeight: 950
                        }}
                        title="Position löschen"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <>
                      <input type="hidden" name="itemKind" value="item" />

                      <div style={{ display: "grid", gap: 8 }}>
                        <label style={{ display: "grid", gap: 5, color: "#777777", fontSize: 11, fontWeight: 700 }}>
                          Artikel / Leistung
                          <input name="itemName" placeholder="Bezeichnung des Artikels" style={inputStyle} />
                        </label>

                        <details style={{
                          border: "none",
                          borderRadius: 4,
                          padding: "4px 0",
                          background: "transparent"
                        }}>
                          <summary style={{
                            cursor: "pointer",
                            color: "#333333",
                            fontWeight: 700,
                            fontSize: 13
                          }}>
                            ≡ FREITEXT zu dieser Position
                          </summary>
                          <textarea
                            name="itemNotes"
                            placeholder="z. B. ohne Koriander, extra Sauce, separat verpacken"
                            rows={4}
                            style={{ ...inputStyle, marginTop: 9, width: "100%", minHeight: 110, resize: "vertical" }}
                          />
                        </details>
                      </div>

                      <label style={{ display: "grid", gap: 5, color: "#777777", fontSize: 11, fontWeight: 700 }}>
                        Menge
                        <input name="quantity" type="number" min="1" defaultValue="1" style={inputStyle} />
                      </label>

                      <label style={{ display: "grid", gap: 5, color: "#777777", fontSize: 11, fontWeight: 700 }}>
                        Einheit
                        <input name="unit" defaultValue="Stück" style={inputStyle} />
                      </label>

                      <label style={{ display: "grid", gap: 5, color: "#777777", fontSize: 11, fontWeight: 700 }}>
                        VK Netto
                        <input name="unitPriceEuro" placeholder="0,00 €" style={inputStyle} />
                      </label>

                      <label style={{ display: "grid", gap: 5, color: "#777777", fontSize: 11, fontWeight: 700 }}>
                        Rabatt
                        <input name="discountPercent" type="number" min="0" defaultValue="0" style={inputStyle} />
                      </label>

                      <label style={{ display: "grid", gap: 5, color: "#777777", fontSize: 11, fontWeight: 700 }}>
                        MwSt
                        <select name="taxRate" defaultValue="19" style={inputStyle}>
                          <option value="19">19 %</option>
                          <option value="7">7 %</option>
                          <option value="0">0 %</option>
                        </select>
                      </label>

                      <div style={{ display: "grid", gap: 5, color: "#777777", fontSize: 11, fontWeight: 700 }}>
                        Gesamt
                        <div data-line-total style={{
                          minHeight: 36,
                          borderRadius: 0,
                          background: "transparent",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          padding: "0 4px",
                          color: "#111111",
                          fontWeight: 900
                        }}>
                          0,00 €
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setPositionRows((rows) => rows.length > 1 ? rows.filter((item) => item.id !== row.id) : rows)
                        }
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#777777",
                          borderRadius: 4,
                          minHeight: 36,
                          marginTop: 22,
                          cursor: "pointer",
                          fontWeight: 950
                        }}
                        title="Position löschen"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              ))}

              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "16px 18px",
                borderTop: "1px solid #e5edf5",
                background: "#f8fafc"
              }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() =>
                      setPositionRows((rows) =>
                        rows.length >= 50 ? rows : [...rows, { id: Date.now() + Math.random(), type: "item" }]
                      )
                    }
                    style={{
                      border: "1px solid #10a66a",
                      background: "#ffffff",
                      color: "#10a66a",
                      borderRadius: 3,
                      padding: "8px 14px",
                      fontWeight: 950,
                      cursor: "pointer"
                    }}
                  >
                    + ARTIKEL
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPositionRows((rows) =>
                        rows.length >= 50 ? rows : [...rows, { id: Date.now() + Math.random(), type: "text" }]
                      )
                    }
                    style={{
                      border: "none",
                      background: "#ffffff",
                      color: "#333333",
                      borderRadius: 3,
                      padding: "8px 10px",
                      fontWeight: 950,
                      cursor: "pointer"
                    }}
                  >
                    ≡ FREITEXT
                  </button>

                  <button
                    type="button"
                    style={{
                      border: "none",
                      background: "#ffffff",
                      color: "#333333",
                      borderRadius: 3,
                      padding: "8px 10px",
                      fontWeight: 950,
                      cursor: "pointer"
                    }}
                  >
                    ◉ OPTIONAL
                  </button>

                  <button
                    type="button"
                    style={{
                      border: "none",
                      background: "#ffffff",
                      color: "#333333",
                      borderRadius: 3,
                      padding: "8px 10px",
                      fontWeight: 950,
                      cursor: "pointer"
                    }}
                  >
                    % GESAMTRABATT
                  </button>
                </div>

                <div style={{
                  position: "absolute",
                  right: 0,
                  bottom: -44,
                  minWidth: 260,
                  borderRadius: "4px 4px 0 0",
                  background: "#555555",
                  color: "white",
                  padding: "12px 18px",
                  fontWeight: 800,
                  textAlign: "center"
                }}>
                  Summe Netto: {formatEuroCents(liveNetTotalCents)}
                </div>
              </div>
            </div>
          </div>

          <textarea name="notes" placeholder="Notizen / Besonderheiten" rows={3} style={inputStyle} />

          <button type="submit" style={{
            border: "none",
            background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
            color: "white",
            borderRadius: 999,
            padding: "13px 18px",
            fontWeight: 950,
            cursor: "pointer",
            justifySelf: "start"
          }}>
            Auftrag anlegen
          </button>
        </Form>
      </section>

      <section style={{
        background: "white",
        border: "1px solid #dbe5ee",
        borderRadius: 28,
        padding: 22,
        boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)"
      }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            color: "#0f766e",
            textTransform: "uppercase",
            letterSpacing: ".10em",
            fontSize: 11,
            fontWeight: 950
          }}>
            Eingang
          </div>
          <h2 style={{ margin: "5px 0 0", fontSize: 24, letterSpacing: "-0.04em" }}>
            Aufträge
          </h2>
        </div>

        <div style={{ overflow: "auto", border: "1px solid #dbe5ee", borderRadius: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Nummer</th>
                <th style={thStyle}>Kunde</th>
                <th style={thStyle}>Quelle</th>
                <th style={thStyle}>Lieferung</th>
                <th style={thStyle}>Positionen</th>
                <th style={thStyle}>Summe</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={8}>Noch keine Aufträge vorhanden.</td>
                </tr>
              ) : (
                data.orders.map((order) => {
                  const total = order.items.reduce((sum, item) => sum + (item.totalCents || 0), 0);

                  return (
                    <tr key={order.id}>
                      <td style={tdStyle}>
                        <strong>{order.orderNumber}</strong>
                        {order.externalOrderNumber ? (
                          <div style={{ color: "#64748b", fontSize: 12 }}>{order.externalOrderNumber}</div>
                        ) : null}
                      </td>
                      <td style={tdStyle}>
                        <strong>{order.customerName}</strong>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{order.customerEmail || "-"}</div>
                      </td>
                      <td style={tdStyle}>{sourceLabel(order.source)}</td>
                      <td style={tdStyle}>
                        {formatDate(order.deliveryDate)}
                        <div style={{ color: "#64748b", fontSize: 12 }}>{order.deliveryTime || "-"}</div>
                      </td>
                      <td style={tdStyle}>
                        {order.items.map((item) => (
                          <div key={item.id}>
                            {item.quantity} × {item.name}
                            {item.notes ? (
                              <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>
                                + {item.notes}
                              </div>
                            ) : null}
                            {item.notes ? (
                              <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>
                                + {item.notes}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </td>
                      <td style={tdStyle}>{centsToEuro(total)}</td>
                      <td style={tdStyle}>
                        <span style={{
                          display: "inline-flex",
                          borderRadius: 999,
                          padding: "5px 10px",
                          fontWeight: 950,
                          background: order.status === "CONFIRMED" ? "#ecfdf5" : order.status === "REJECTED" ? "#fef2f2" : "#fff7ed",
                          color: order.status === "CONFIRMED" ? "#047857" : order.status === "REJECTED" ? "#b91c1c" : "#c2410c",
                          border: "1px solid " + (order.status === "CONFIRMED" ? "#bbf7d0" : order.status === "REJECTED" ? "#fecaca" : "#fed7aa")
                        }}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Form method="post" style={{ display: "flex", gap: 8 }}>
                            <input type="hidden" name="intent" value="updateStatus" />
                            <input type="hidden" name="orderId" value={order.id} />
                            <select name="status" defaultValue={order.status} style={inputStyle}>
                              {STATUSES.map((status) => (
                                <option key={status.value} value={status.value}>{status.label}</option>
                              ))}
                            </select>
                            <button type="submit" style={smallButtonStyle}>Speichern</button>
                          </Form>

                          <Form method="post">
                            <input type="hidden" name="intent" value="deleteOrder" />
                            <input type="hidden" name="orderId" value={order.id} />
                            <button type="submit" style={{ ...smallButtonStyle, color: "#b91c1c" }}>Löschen</button>
                          </Form>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  font: "inherit",
  background: "white",
};

const thStyle = {
  textAlign: "left" as const,
  background: "#f8fafc",
  color: "#64748b",
  fontSize: 11.5,
  textTransform: "uppercase" as const,
  letterSpacing: ".075em",
  padding: "14px 15px",
  borderBottom: "1px solid #dbe5ee",
  fontWeight: 950,
};

const tdStyle = {
  padding: "15px",
  borderBottom: "1px solid #eef2f7",
  verticalAlign: "top" as const,
  fontWeight: 720,
};

const smallButtonStyle = {
  border: "1px solid #dbe5ee",
  background: "white",
  borderRadius: 999,
  padding: "9px 12px",
  fontWeight: 900,
  cursor: "pointer",
};


export function ErrorBoundary({ error }: { error: any }) {
  const message =
    error?.data ||
    error?.message ||
    "Unbekannter Fehler im Auftragseingang.";

  const status = error?.status || 500;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#edf2f6",
      padding: 32,
      fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      color: "#07111f"
    }}>
      <section style={{
        maxWidth: 760,
        background: "white",
        border: "1px solid #dbe5ee",
        borderRadius: 28,
        padding: 28,
        boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)"
      }}>
        <div style={{
          color: "#b91c1c",
          textTransform: "uppercase",
          letterSpacing: ".11em",
          fontSize: 11,
          fontWeight: 950,
          marginBottom: 8
        }}>
          Fehler {status}
        </div>

        <h1 style={{
          margin: 0,
          fontSize: 38,
          lineHeight: 1,
          letterSpacing: "-0.055em"
        }}>
          Auftragseingang konnte nicht geladen werden
        </h1>

        <p style={{
          margin: "14px 0 0",
          color: "#475569",
          fontWeight: 750,
          lineHeight: 1.55
        }}>
          {String(message)}
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          <a href="/logout" style={{
            border: "1px solid #dbe5ee",
            background: "white",
            color: "#07111f",
            borderRadius: 999,
            padding: "12px 16px",
            fontWeight: 950,
            textDecoration: "none"
          }}>
            Ausloggen
          </a>

          <a href="/login" style={{
            border: "none",
            background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
            color: "white",
            borderRadius: 999,
            padding: "12px 16px",
            fontWeight: 950,
            textDecoration: "none"
          }}>
            Neu einloggen
          </a>

          <a href="/gastario-control" style={{
            border: "1px solid #dbe5ee",
            background: "white",
            color: "#07111f",
            borderRadius: 999,
            padding: "12px 16px",
            fontWeight: 950,
            textDecoration: "none"
          }}>
            Super Admin
          </a>
        </div>
      </section>
    </div>
  );
}

