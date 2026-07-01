const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

const start = text.indexOf("export default function AuftragseingangPage()");
const end = text.indexOf("export function ErrorBoundary", start);

if (start === -1 || end === -1) {
  throw new Error("Konnte Component-Grenzen nicht finden.");
}

const newComponent = String.raw`
export default function AuftragseingangPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [positionRows, setPositionRows] = useState<Array<{ id: number; type: "item" | "text" }>>([
    { id: Date.now(), type: "item" },
  ]);

  const [liveNetTotalCents, setLiveNetTotalCents] = useState(0);
  const [liveTaxTotalCents, setLiveTaxTotalCents] = useState(0);
  const [liveGrossTotalCents, setLiveGrossTotalCents] = useState(0);

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
    let taxTotalCents = 0;
    let grossTotalCents = 0;

    const rows = Array.from(form.querySelectorAll('[data-position-row="item"]'));

    for (const row of rows) {
      const quantityInput = row.querySelector('input[name="quantity"]') as HTMLInputElement | null;
      const priceInput = row.querySelector('input[name="unitPriceEuro"]') as HTMLInputElement | null;
      const discountInput = row.querySelector('input[name="discountPercent"]') as HTMLInputElement | null;
      const taxInput = row.querySelector('select[name="taxRate"]') as HTMLSelectElement | null;
      const totalElement = row.querySelector("[data-line-total]") as HTMLElement | null;

      const quantity = Number(String(quantityInput?.value || "1").replace(",", "."));
      const unitCents = parseEuroInput(priceInput?.value || "0");
      const discountPercent = Number(String(discountInput?.value || "0").replace(",", "."));
      const taxRate = Number(String(taxInput?.value || "19").replace(",", "."));

      const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
      const safeDiscount = Number.isFinite(discountPercent) && discountPercent > 0 ? discountPercent : 0;
      const safeTaxRate = Number.isFinite(taxRate) && taxRate > 0 ? taxRate : 0;

      const beforeDiscount = Math.round(unitCents * safeQuantity);
      const discountCents = Math.round(beforeDiscount * (safeDiscount / 100));
      const netLineCents = Math.max(0, beforeDiscount - discountCents);
      const taxLineCents = Math.round(netLineCents * (safeTaxRate / 100));
      const grossLineCents = netLineCents + taxLineCents;

      netTotalCents += netLineCents;
      taxTotalCents += taxLineCents;
      grossTotalCents += grossLineCents;

      if (totalElement) {
        totalElement.textContent = formatEuroCents(netLineCents);
      }
    }

    setLiveNetTotalCents(netTotalCents);
    setLiveTaxTotalCents(taxTotalCents);
    setLiveGrossTotalCents(grossTotalCents);
  }

  const pageStyle: any = {
    minHeight: "100vh",
    background: "#f2f2f2",
    padding: "28px 0 56px",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    color: "#111827",
  };

  const shellStyle: any = {
    width: "100%",
    maxWidth: 1080,
    margin: "0 auto",
    padding: "0 24px",
  };

  const documentStyle: any = {
    background: "#ffffff",
    border: "1px solid #d2d2d2",
    borderRadius: 4,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    padding: 22,
  };

  const inputStyle: any = {
    width: "100%",
    minHeight: 42,
    border: "1px solid #cfd8e3",
    borderRadius: 3,
    padding: "0 12px",
    fontSize: 14,
    fontWeight: 600,
    color: "#111827",
    background: "#ffffff",
    boxSizing: "border-box",
  };

  const labelStyle: any = {
    display: "grid",
    gap: 5,
    color: "#555",
    fontSize: 12,
    fontWeight: 700,
  };

  const sectionLabelStyle: any = {
    color: "#00796b",
    textTransform: "uppercase",
    letterSpacing: ".08em",
    fontSize: 11,
    fontWeight: 950,
  };

  const smallButtonStyle: any = {
    border: "1px solid #cfd8e3",
    background: "#ffffff",
    borderRadius: 3,
    padding: "8px 12px",
    fontWeight: 850,
    cursor: "pointer",
    color: "#111827",
  };

  const primaryButtonStyle: any = {
    border: "1px solid #009b72",
    background: "#ffffff",
    color: "#009b72",
    borderRadius: 3,
    padding: "8px 14px",
    fontWeight: 950,
    cursor: "pointer",
  };

  const submitButtonStyle: any = {
    border: "none",
    background: "#079682",
    color: "#ffffff",
    borderRadius: 999,
    padding: "12px 18px",
    fontWeight: 950,
    cursor: "pointer",
    width: "fit-content",
  };

  const thStyle: any = {
    textAlign: "left",
    padding: "12px 14px",
    color: "#64748b",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: ".04em",
    borderBottom: "1px solid #e5e7eb",
  };

  const tdStyle: any = {
    padding: "13px 14px",
    borderBottom: "1px solid #edf2f7",
    verticalAlign: "top",
    fontSize: 14,
  };

  if (data.setupError) {
    return (
      <div style={pageStyle}>
        <div style={shellStyle}>
          <section style={{ ...documentStyle, maxWidth: 760 }}>
            <div style={sectionLabelStyle}>Fehler</div>
            <h1 style={{ margin: "8px 0 10px", fontSize: 30 }}>Auftragseingang konnte nicht geladen werden</h1>
            <p style={{ margin: 0, color: "#475569", fontWeight: 650 }}>{data.setupError}</p>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <a href="/logout" style={smallButtonStyle}>Ausloggen</a>
              <a href="/login" style={primaryButtonStyle}>Neu einloggen</a>
              <a href="/super-admin" style={smallButtonStyle}>Super Admin</a>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 22 }}>
          <div>
            <div style={sectionLabelStyle}>Gastario</div>
            <h1 style={{ margin: "4px 0 0", fontSize: 34, lineHeight: 1, letterSpacing: "-0.05em" }}>
              Auftragseingang
            </h1>
            <p style={{ margin: "8px 0 0", color: "#64748b", fontWeight: 650 }}>
              Neue Aufträge erfassen, prüfen und übernehmen.
            </p>
          </div>

          <div style={{
            border: "1px solid #d2d2d2",
            background: "#ffffff",
            borderRadius: 4,
            padding: "12px 16px",
            fontWeight: 900,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            whiteSpace: "nowrap",
          }}>
            {data.tenant.name}
          </div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 18 }}>
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
                background: data.activeStatus === status ? "#087f72" : "#ffffff",
                color: data.activeStatus === status ? "#ffffff" : "#111827",
                border: "1px solid #d2d2d2",
                borderRadius: 4,
                padding: "14px 16px",
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 850 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 950, lineHeight: 1.1 }}>{count}</div>
            </a>
          ))}
        </section>

        {actionData?.error ? (
          <div style={{
            background: "#fff7ed",
            border: "1px solid #fdba74",
            color: "#9a3412",
            borderRadius: 4,
            padding: 12,
            fontWeight: 800,
            marginBottom: 16,
          }}>
            {actionData.error}
          </div>
        ) : null}

        <section style={documentStyle}>
          <Form
            method="post"
            onInput={(event) => recalculatePositionTotals(event.currentTarget)}
            onChange={(event) => recalculatePositionTotals(event.currentTarget)}
            style={{ display: "grid", gap: 18 }}
          >
            <input type="hidden" name="intent" value="createOrder" />

            <div>
              <div style={sectionLabelStyle}>Neuer Auftrag</div>
              <h2 style={{ margin: "5px 0 0", fontSize: 23, letterSpacing: "-0.03em" }}>
                Auftrag manuell erfassen
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12 }}>
                  <label style={labelStyle}>
                    Quelle
                    <select name="source" defaultValue="DIRECT" style={inputStyle}>
                      {SOURCES.map((source) => (
                        <option key={source.value} value={source.value}>{source.label}</option>
                      ))}
                    </select>
                  </label>

                  <label style={labelStyle}>
                    Externe Nummer optional
                    <input name="externalOrderNumber" placeholder="z. B. Heycater ID" style={inputStyle} />
                  </label>
                </div>

                <input name="customerEmail" type="email" placeholder="Kunden-E-Mail" style={inputStyle} />
                <input name="customerPhone" placeholder="Kunden-Telefon" style={inputStyle} />
                <input name="contactName" placeholder="Ansprechpartner vor Ort" style={inputStyle} />
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <label style={labelStyle}>
                  Kunde
                  <input name="customerName" placeholder="Firma / Kunde" style={inputStyle} />
                </label>

                <input name="eventName" placeholder="Event / Anlass" style={inputStyle} />

                <div style={{ display: "grid", gridTemplateColumns: "160px 140px 1fr", gap: 12 }}>
                  <input name="deliveryDate" type="date" style={inputStyle} />
                  <input name="deliveryTime" placeholder="Uhrzeit" style={inputStyle} />
                  <input name="deliveryAddress" placeholder="Lieferadresse" style={inputStyle} />
                </div>

                <input name="contactPhone" placeholder="Telefon vor Ort" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <div>
                  <div style={sectionLabelStyle}>Positionen</div>
                  <h3 style={{ margin: "4px 0 0", fontSize: 20, letterSpacing: "-0.03em" }}>
                    Artikel
                  </h3>
                </div>

                <div style={{ color: "#64748b", fontSize: 12, fontWeight: 750 }}>
                  {positionRows.length} / 50 Positionen
                </div>
              </div>

              <div style={{ border: "1px solid #d2d2d2", borderRadius: 4, background: "#ffffff", overflow: "hidden" }}>
                {positionRows.map((row, rowIndex) => (
                  <div
                    key={row.id}
                    data-position-row={row.type}
                    style={{
                      display: "grid",
                      gridTemplateColumns: row.type === "text"
                        ? "34px minmax(0, 1fr) 32px"
                        : "34px minmax(330px, 1fr) 78px 100px 120px 82px 142px 30px",
                      gap: 8,
                      alignItems: "start",
                      padding: "14px",
                      borderTop: rowIndex === 0 ? "none" : "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      background: "#eeeeee",
                      color: "#555",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 850,
                      marginTop: 25,
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

                        <label style={labelStyle}>
                          Freitext
                          <textarea
                            name="itemName"
                            placeholder="Freitext eingeben"
                            rows={3}
                            style={{ ...inputStyle, minHeight: 82, resize: "vertical", paddingTop: 10 }}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => setPositionRows((rows) => rows.filter((item) => item.id !== row.id))}
                          style={{ border: "none", background: "transparent", color: "#777", cursor: "pointer", fontWeight: 950, fontSize: 16, marginTop: 26 }}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        <input type="hidden" name="itemKind" value="item" />

                        <div style={{ display: "grid", gap: 6 }}>
                          <label style={labelStyle}>
                            Artikel
                            <input name="itemName" placeholder="Bezeichnung des Artikels" style={inputStyle} />
                          </label>

                          <details>
                            <summary style={{ cursor: "pointer", color: "#333", fontSize: 12, fontWeight: 800, listStyle: "none" }}>
                              ≡ FREITEXT zu dieser Position
                            </summary>
                            <textarea
                              name="itemNotes"
                              placeholder="z. B. ohne Koriander, extra Sauce, separat verpacken"
                              rows={3}
                              style={{ ...inputStyle, marginTop: 8, minHeight: 76, resize: "vertical", paddingTop: 10 }}
                            />
                          </details>
                        </div>

                        <label style={labelStyle}>
                          Menge
                          <input name="quantity" type="number" min="1" defaultValue="1" style={inputStyle} />
                        </label>

                        <label style={labelStyle}>
                          Einheit
                          <input name="unit" defaultValue="Stück" style={inputStyle} />
                        </label>

                        <label style={labelStyle}>
                          VK Netto
                          <input name="unitPriceEuro" placeholder="0,00 €" style={{ ...inputStyle, textAlign: "right" }} />
                        </label>

                        <label style={labelStyle}>
                          Rabatt
                          <input name="discountPercent" type="number" min="0" defaultValue="0" style={{ ...inputStyle, textAlign: "right" }} />
                        </label>

                        <div style={{ display: "grid", gap: 4, color: "#555", fontSize: 12, fontWeight: 700 }}>
                          Gesamt
                          <div
                            data-line-total
                            style={{
                              minHeight: 24,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              color: "#111",
                              fontWeight: 950,
                              fontSize: 14,
                            }}
                          >
                            0,00 €
                          </div>
                          <select
                            name="taxRate"
                            defaultValue="19"
                            style={{
                              height: 27,
                              border: "none",
                              borderRadius: 999,
                              background: "#444",
                              color: "white",
                              fontSize: 11,
                              fontWeight: 850,
                              padding: "2px 8px",
                              cursor: "pointer",
                            }}
                          >
                            <option value="19">USt 19 %</option>
                            <option value="7">USt 7 %</option>
                            <option value="0">USt 0 %</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPositionRows((rows) => rows.length > 1 ? rows.filter((item) => item.id !== row.id) : rows)}
                          style={{ border: "none", background: "transparent", color: "#777", cursor: "pointer", fontWeight: 950, fontSize: 16, marginTop: 26 }}
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                ))}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "14px", borderTop: "1px solid #d2d2d2" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setPositionRows((rows) => rows.length >= 50 ? rows : [...rows, { id: Date.now() + Math.random(), type: "item" }])}
                      style={primaryButtonStyle}
                    >
                      + ARTIKEL
                    </button>

                    <button
                      type="button"
                      onClick={() => setPositionRows((rows) => rows.length >= 50 ? rows : [...rows, { id: Date.now() + Math.random(), type: "text" }])}
                      style={{ ...smallButtonStyle, border: "none" }}
                    >
                      ≡ FREITEXT
                    </button>

                    <button type="button" style={{ ...smallButtonStyle, border: "none" }}>◉ OPTIONAL</button>
                    <button type="button" style={{ ...smallButtonStyle, border: "none" }}>% GESAMTRABATT</button>
                  </div>

                  <div style={{
                    minWidth: 390,
                    background: "#555",
                    color: "white",
                    padding: "11px 16px",
                    fontWeight: 800,
                    textAlign: "center",
                    fontSize: 13,
                  }}>
                    Netto {formatEuroCents(liveNetTotalCents)} · MwSt {formatEuroCents(liveTaxTotalCents)} · Gesamt {formatEuroCents(liveGrossTotalCents)}
                  </div>
                </div>
              </div>
            </div>

            <textarea
              name="notes"
              placeholder="Notizen / Besonderheiten"
              rows={4}
              style={{ ...inputStyle, minHeight: 96, resize: "vertical", paddingTop: 12 }}
            />

            <button type="submit" style={submitButtonStyle}>Auftrag anlegen</button>
          </Form>
        </section>

        <section style={{ ...documentStyle, marginTop: 18 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={sectionLabelStyle}>Eingang</div>
            <h2 style={{ margin: "5px 0 0", fontSize: 23, letterSpacing: "-0.03em" }}>Aufträge</h2>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 4 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#ffffff" }}>
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
                    <td style={tdStyle} colSpan={8}>
                      <strong>Noch keine Aufträge vorhanden.</strong>
                    </td>
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
                            <div key={item.id} style={{ marginBottom: 4 }}>
                              {item.quantity} × {item.name}
                              {item.notes ? (
                                <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>+ {item.notes}</div>
                              ) : null}
                            </div>
                          ))}
                        </td>
                        <td style={tdStyle}><strong>{centsToEuro(total)}</strong></td>
                        <td style={tdStyle}>
                          <span style={{
                            display: "inline-flex",
                            border: "1px solid #d2d2d2",
                            borderRadius: 999,
                            padding: "5px 9px",
                            fontSize: 12,
                            fontWeight: 850,
                          }}>
                            {statusLabel(order.status)}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Form method="post" style={{ display: "flex", gap: 8 }}>
                              <input type="hidden" name="intent" value="updateStatus" />
                              <input type="hidden" name="orderId" value={order.id} />
                              <select name="status" defaultValue={order.status} style={{ ...inputStyle, minHeight: 36 }}>
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
    </div>
  );
}

`;

text = text.slice(0, start) + newComponent + text.slice(end);

fs.writeFileSync(file, text, "utf8");

