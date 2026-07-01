const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// 1) Datum-Parsing im Server: akzeptiert yyyy-mm-dd UND tt.mm.jjjj
text = text.replace(
  `    const deliveryDate = deliveryDateRaw ? new Date(deliveryDateRaw + "T00:00:00") : null;`,
  `    let deliveryDate: Date | null = null;

    if (deliveryDateRaw) {
      const germanDateMatch = deliveryDateRaw.match(/^(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})$/);

      if (germanDateMatch) {
        const day = germanDateMatch[1].padStart(2, "0");
        const month = germanDateMatch[2].padStart(2, "0");
        const year = germanDateMatch[3];
        deliveryDate = new Date(year + "-" + month + "-" + day + "T00:00:00");
      } else {
        deliveryDate = new Date(deliveryDateRaw + "T00:00:00");
      }
    }`
);

// 2) Hässliches Browser-Date-Feld durch Lexoffice-artiges Textfeld ersetzen
text = text.replace(
  `<input name="deliveryDate" type="date" style={inputStyle} />`,
  `<input
              name="deliveryDate"
              type="text"
              inputMode="numeric"
              placeholder="Datum, z. B. 01.07.2026"
              style={{ ...inputStyle, borderRadius: 3 }}
            />`
);

// 3) Zeitfeld auch ruhiger
text = text.replace(
  `<input name="deliveryTime" placeholder="Uhrzeit" style={inputStyle} />`,
  `<input
              name="deliveryTime"
              placeholder="Uhrzeit"
              style={{ ...inputStyle, borderRadius: 3 }}
            />`
);

// 4) Lieferadresse optisch angleichen
text = text.replace(
  `<input name="deliveryAddress" placeholder="Lieferadresse" style={inputStyle} />`,
  `<input
              name="deliveryAddress"
              placeholder="Lieferadresse"
              style={{ ...inputStyle, borderRadius: 3 }}
            />`
);

fs.writeFileSync(file, text, "utf8");
