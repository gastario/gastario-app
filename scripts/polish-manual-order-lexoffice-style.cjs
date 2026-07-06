const fs = require("fs");

const path = "app/routes/neuer-auftrag.tsx";
let content = fs.readFileSync(path, "utf8");

// 1) Deutsche Datumseingabe serverseitig erlauben
if (!content.includes("function parseGermanDateInput")) {
  content = content.replace(
`function createOrderNumber() {`,
`function parseGermanDateInput(value: string) {
  const raw = String(value || "").trim();

  const germanMatch = raw.match(/^(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})$/);
  if (germanMatch) {
    const day = germanMatch[1].padStart(2, "0");
    const month = germanMatch[2].padStart(2, "0");
    const year = germanMatch[3];
    return new Date(year + "-" + month + "-" + day + "T00:00:00");
  }

  const isoMatch = raw.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  if (isoMatch) {
    return new Date(raw + "T00:00:00");
  }

  return null;
}

function createOrderNumber() {`
  );
}

// 2) deliveryDate Parsing ersetzen
content = content.replace(
`  const deliveryDate = new Date(deliveryDateRaw + "T00:00:00");`,
`  const deliveryDate = parseGermanDateInput(deliveryDateRaw);

  if (!deliveryDate || Number.isNaN(deliveryDate.getTime())) {
    return { error: "Bitte Lieferdatum im Format TT.MM.JJJJ eintragen." };
  }`
);

// 3) Date-Input durch normales Textfeld ersetzen
content = content.replace(
`<input name="deliveryDate" type="date" style={inputStyle} />`,
`<input name="deliveryDate" inputMode="numeric" style={inputStyle} placeholder="TT.MM.JJJJ" />`
);

// 4) Time-Input ruhiger machen, optional bleibt type time
content = content.replace(
`<input name="deliveryTime" type="time" style={inputStyle} />`,
`<input name="deliveryTime" style={inputStyle} placeholder="z. B. 12:00" />`
);

// 5) Typografie und Feldoptik weniger fett / hochwertiger
content = content.replace(
`fontWeight: 950,`,
`fontWeight: 700,`
);

content = content.replaceAll(
`fontWeight: 900,`,
`fontWeight: 650,`
);

content = content.replaceAll(
`fontWeight: 850,`,
`fontWeight: 650,`
);

content = content.replaceAll(
`fontWeight: 800,`,
`fontWeight: 500,`
);

content = content.replaceAll(
`fontSize: 38,`,
`fontSize: 34,`
);

content = content.replaceAll(
`fontSize: 22,`,
`fontSize: 20,`
);

content = content.replaceAll(
`boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",`,
`boxShadow: "0 10px 28px rgba(15, 23, 42, 0.055)",`
);

content = content.replaceAll(
`borderRadius: 24,`,
`borderRadius: 18,`
);

content = content.replaceAll(
`borderRadius: 14,`,
`borderRadius: 10,`
);

content = content.replaceAll(
`minHeight: 44,`,
`minHeight: 40,`
);

content = content.replaceAll(
`padding: "12px 16px",`,
`padding: "10px 14px",`
);

content = content.replaceAll(
`boxShadow: "0 10px 22px rgba(15, 159, 122, 0.18)",`,
`boxShadow: "0 6px 14px rgba(15, 159, 122, 0.13)",`
);

// 6) Globale Feinpolitur für diese Seite ergänzen
if (!content.includes("manual-order-lexoffice-polish")) {
  content = content.replace(
`    </AppLayout>`,
`      <style>{\`
        /* manual-order-lexoffice-polish */
        input,
        textarea,
        select {
          font-size: 14px !important;
          font-weight: 500 !important;
        }

        input::placeholder,
        textarea::placeholder {
          color: #8a94a6 !important;
          font-weight: 500 !important;
        }

        label {
          font-size: 12px !important;
          font-weight: 650 !important;
        }

        h1 {
          font-weight: 700 !important;
        }

        h2 {
          font-weight: 650 !important;
        }

        button,
        a {
          font-weight: 650 !important;
        }
      \`}</style>
    </AppLayout>`
  );
}

fs.writeFileSync(path, content, "utf8");
console.log("Neuer Auftrag: Lexoffice-ruhigere Optik und deutsches Datum gepatcht.");
