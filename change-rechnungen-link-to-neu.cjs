const fs = require("fs");

const file = "app/routes/rechnungen.tsx";
let text = fs.readFileSync(file, "utf8");

text = text.replaceAll(`to="/auftraege"`, `to="/rechnungen/neu"`);
text = text.replaceAll(`Zu den Aufträgen`, `Neue Rechnung`);

fs.writeFileSync(file, text, "utf8");
