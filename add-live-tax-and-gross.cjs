const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Live-State erweitern
text = text.replace(
  `  const [liveNetTotalCents, setLiveNetTotalCents] = useState(0);`,
  `  const [liveNetTotalCents, setLiveNetTotalCents] = useState(0);
  const [liveTaxTotalCents, setLiveTaxTotalCents] = useState(0);
  const [liveGrossTotalCents, setLiveGrossTotalCents] = useState(0);`
);

// Rechenfunktion erweitern: netto, mwst, brutto
text = text.replace(
  `    let netTotalCents = 0;

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

    setLiveNetTotalCents(netTotalCents);`,
  `    let netTotalCents = 0;
    let taxTotalCents = 0;
    let grossTotalCents = 0;

    const rows = Array.from(form.querySelectorAll('[data-position-row="item"]'));

    for (const row of rows) {
      const quantityInput = row.querySelector('input[name="quantity"]') as HTMLInputElement | null;
      const priceInput = row.querySelector('input[name="unitPriceEuro"]') as HTMLInputElement | null;
      const discountInput = row.querySelector('input[name="discountPercent"]') as HTMLInputElement | null;
      const taxInput = row.querySelector('select[name="taxRate"]') as HTMLSelectElement | null;
      const totalElement = row.querySelector('[data-line-total]') as HTMLElement | null;

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
    setLiveGrossTotalCents(grossTotalCents);`
);

// Summentext ersetzen
text = text.replaceAll(
  `Summe Netto&nbsp;&nbsp; {formatEuroCents(liveNetTotalCents)}`,
  `Netto {formatEuroCents(liveNetTotalCents)} · MwSt {formatEuroCents(liveTaxTotalCents)} · Gesamt {formatEuroCents(liveGrossTotalCents)}`
);

text = text.replaceAll(
  `Summe Netto: {formatEuroCents(liveNetTotalCents)}`,
  `Netto {formatEuroCents(liveNetTotalCents)} · MwSt {formatEuroCents(liveTaxTotalCents)} · Gesamt {formatEuroCents(liveGrossTotalCents)}`
);

// Feldüberschrift rechts klarer machen
text = text.replaceAll(
  `Gesamt
                        <div data-line-total`,
  `Netto
                        <div data-line-total`
);

fs.writeFileSync(file, text, "utf8");
