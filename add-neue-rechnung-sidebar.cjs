const fs = require("fs");

const file = "app/components/AppLayout.tsx";
let text = fs.readFileSync(file, "utf8");

// Neue Rechnung in Verkauf einfügen
if (!text.includes('{ label: "Neue Rechnung", to: "/rechnungen/neu" }')) {
  text = text.replace(
    `{ label: "Rechnungen", to: "/rechnungen" },`,
    `{ label: "Rechnungen", to: "/rechnungen" },
      { label: "Neue Rechnung", to: "/rechnungen/neu" },`
  );
}

// Active-Logik sauberer machen, damit /rechnungen/neu nicht beide markiert
text = text.replace(
`                const isActive =
                  item.to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.to);`,
`                const isActive =
                  item.to === "/"
                    ? location.pathname === "/"
                    : item.to === "/rechnungen"
                      ? location.pathname === "/rechnungen"
                      : location.pathname === item.to || location.pathname.startsWith(item.to + "/");`
);

fs.writeFileSync(file, text, "utf8");
