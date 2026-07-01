const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Produkt-Modal-State entfernen
text = text.replace(
`  const [productDraft, setProductDraft] = useState<{
    open: boolean;
    name: string;
    unit: string;
    priceEuro: string;
    taxRate: string;
  }>({
    open: false,
    name: "",
    unit: "Stück",
    priceEuro: "",
    taxRate: "19",
  });

`, "");

// Server-Action createProductFromPosition entfernen
text = text.replace(
/  if \(intent === "createProductFromPosition"\) \{[\s\S]*?  \}\r?\n\r?\n  if \(intent === "createOrder"\) \{/,
`  if (intent === "createOrder") {`
);

// Runde Nummer wieder neutral machen
text = text.replace(
/                    <button\s+type="button"\s+title="Position später verschieben"[\s\S]*?                    >\r?\n\s*\{rowIndex \+ 1\}\r?\n\s*<\/button>/,
`                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      background: "#f1f5f9",
                      color: "#334155",
                      border: "1px solid #dbe3ec",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 850,
                      marginTop: row.type === "text" ? 24 : 26
                    }}>
                      {rowIndex + 1}
                    </div>`
);

// "+ als Produkt speichern" Button entfernen
text = text.replace(
/\s*<button\s+type="button"\s+onClick=\{\(event\) => \{[\s\S]*?\}\}\s+style=\{\{[\s\S]*?\}\}\s*>\r?\n\s*\+ als Produkt speichern\r?\n\s*<\/button>/,
""
);

// Product-Modal komplett entfernen
text = text.replace(
/\r?\n\s*\{productDraft\.open \? \([\s\S]*?\) : null\}\r?\n\s*<\/section>/,
`
        </section>`
);

// Buttonleiste vereinfachen: Optional und Gesamtrabatt entfernen
text = text.replace(
/\s*<button type="button" style=\{\{ border: "none", background: "#ffffff", color: "#333", padding: "8px 6px", fontWeight: 850, cursor: "pointer" \}\}>\r?\n\s*◉ OPTIONAL\r?\n\s*<\/button>/,
""
);

text = text.replace(
/\s*<button type="button" style=\{\{ border: "none", background: "#ffffff", color: "#333", padding: "8px 6px", fontWeight: 850, cursor: "pointer" \}\}>\r?\n\s*% GESAMTRABATT\r?\n\s*<\/button>/,
""
);

// Falls andere Formatierung der Buttons vorhanden ist, Text entfernen
text = text.replaceAll("◉ OPTIONAL", "");
text = text.replaceAll("% GESAMTRABATT", "");

// Buttonleiste linksbündig statt künstlich zentriert
text = text.replaceAll(
  `justifyContent: "center",
                  gap: 22,`,
  `justifyContent: "flex-start",
                  gap: 14,`
);

fs.writeFileSync(file, text, "utf8");
