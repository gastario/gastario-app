export async function loader() {
  const csv = [
    "name;kategorie;einheit;preis;mwst;aktiv",
    "Chicken Bowl;Bowls;Portion;9,90;7;ja",
    "Vegane Bowl;Bowls;Portion;8,90;7;ja",
    "Burger Classic;Burger;Stueck;10,50;7;ja",
    "Cola 0,33l;Getraenke;Flasche;2,50;19;ja",
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="gastario-produkt-import-vorlage.csv"',
    },
  });
}
