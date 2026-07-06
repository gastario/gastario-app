const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

// dateRange Standard: letzte 7 Tage statt leer / alle
content = content.replace(
  'const dateRange = url.searchParams.get("dateRange") || "";',
  'const dateRange = url.searchParams.get("dateRange") || "last7";'
);

// Zeitraum-Logik ersetzen
content = content.replace(
`  if (!selectedDate && dateRange) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateRange === "today") {
      selectedDateStart = new Date(today);
      selectedDateEnd = new Date(today);
      selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);
    }

    if (dateRange === "tomorrow") {
      selectedDateStart = new Date(today);
      selectedDateStart.setDate(selectedDateStart.getDate() + 1);
      selectedDateEnd = new Date(selectedDateStart);
      selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);
    }

    if (dateRange === "week") {
      selectedDateStart = new Date(today);
      selectedDateEnd = new Date(today);
      selectedDateEnd.setDate(selectedDateEnd.getDate() + 7);
    }
  }`,
`  if (!selectedDate && dateRange) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateRange === "last7") {
      selectedDateStart = new Date(today);
      selectedDateStart.setDate(selectedDateStart.getDate() - 7);
      selectedDateEnd = new Date(today);
      selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);
    }

    if (dateRange === "today") {
      selectedDateStart = new Date(today);
      selectedDateEnd = new Date(today);
      selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);
    }

    if (dateRange === "yesterday") {
      selectedDateStart = new Date(today);
      selectedDateStart.setDate(selectedDateStart.getDate() - 1);
      selectedDateEnd = new Date(today);
    }
  }`
);

// Fallbacks auch auf last7 setzen
content = content.replaceAll(
  'dateRange: "",',
  'dateRange: "last7",'
);

// Select schöner machen: keine Zukunft, sondern Postfach-Zeiträume
content = content.replace(
`                      <option value="">Alle Zeiträume</option>
                      <option value="today">Heute</option>
                      <option value="tomorrow">Morgen</option>
                      <option value="week">Nächste 7 Tage</option>`,
`                      <option value="last7">Letzte 7 Tage</option>
                      <option value="today">Heute</option>
                      <option value="yesterday">Gestern</option>`
);

// Label im UI klarer machen
content = content.replaceAll("Zeitraum", "Postfach-Zeitraum");

// Zurücksetzen soll wieder letzte 7 Tage zeigen
content = content.replace(
  'href={"/auftragseingang?emailCategory=" + data.selectedEmailCategory}',
  'href={"/auftragseingang?emailCategory=" + data.selectedEmailCategory + "&dateRange=last7"}'
);

fs.writeFileSync(path, content, "utf8");
console.log("Auftragseingang: Postfach standardmaessig letzte 7 Tage, Auftraege ohne Frist.");
