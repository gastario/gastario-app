const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Live-State nach actionData ergänzen
text = text.replace(
  `  const actionData = useActionData<typeof action>();
  const [positionRows, setPositionRows]`,
  `  const actionData = useActionData<typeof action>();
  const [liveNetTotalCents, setLiveNetTotalCents] = useState(0);
  const [positionRows, setPositionRows]`
);

// Live-Rechner nach positionRows-State einfügen
text = text.replace(
  `  const [positionRows, setPositionRows] = useState<Array<{ id: number; type: "item" | "text" }>>([
    { id: Date.now(), type: "item" },
  ]);`,
  `  const [positionRows, setPositionRows] = useState<Array<{ id: number; type: "item" | "text" }>>([
    { id: Date.now(), type: "item" },
  ]);

  function parseEuroInput(value: string) {
    const normalized = String(value || "")
      .replace(/€/g, "")
      .replace(/\\s/g, "")
      .replace(/\\./g, "")
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
  }`
);

// Form mit onInput/onChange versehen
text = text.replace(
  `<Form method="post" style={{ display: "grid", gap: 14 }}>`,
  `<Form
          method="post"
          onInput={(event) => recalculatePositionTotals(event.currentTarget)}
          onChange={(event) => recalculatePositionTotals(event.currentTarget)}
          style={{ display: "grid", gap: 14 }}
        >`
);

// Artikel-Zeile mit data-position-row markieren
text = text.replace(
  `background: row.type === "text" ? "#fbfdff" : "#ffffff"
                }}>`,
  `background: row.type === "text" ? "#fbfdff" : "#ffffff"
                }}
                data-position-row={row.type}
                >`
);

// Gesamt-Div mit data-line-total markieren
text = text.replace(
  `<div style={{
                          minHeight: 36,`,
  `<div data-line-total style={{
                          minHeight: 36,`
);

// Summe unten live machen
text = text.replaceAll(
  `Summe Netto: 0,00 €`,
  `Summe Netto: {formatEuroCents(liveNetTotalCents)}`
);

fs.writeFileSync(file, text, "utf8");
