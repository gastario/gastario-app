const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

const marker = "const visibleOrders = sortedOrders.filter";

if (!content.includes(marker)) {
  const returnMarker = "\n  return (\n    <AppLayout>";
  const index = content.indexOf(returnMarker);

  if (index === -1) {
    throw new Error("Return-Marker nicht gefunden.");
  }

  const insert = `
  const visibleOrders = sortedOrders.filter((order: any) => {
    if (!order.deliveryDate) return true;

    const deliveryDate = new Date(order.deliveryDate);

    if (Number.isNaN(deliveryDate.getTime())) return true;

    const match = String(order.deliveryTimeText || "").match(/(\\d{1,2})[:.](\\d{2})/);

    if (match) {
      deliveryDate.setHours(Number(match[1]), Number(match[2]), 0, 0);
    } else {
      deliveryDate.setHours(23, 59, 59, 999);
    }

    return deliveryDate.getTime() >= Date.now();
  });

  const hiddenPastOrderCount = sortedOrders.length - visibleOrders.length;
`;

  content = content.slice(0, index) + insert + content.slice(index);
}

// Auftragseingang nutzt ab jetzt sichtbare, nicht vergangene Aufträge
content = content.replaceAll("sortedOrders.length === 0", "visibleOrders.length === 0");
content = content.replaceAll("sortedOrders.map((order: any) => {", "visibleOrders.map((order: any) => {");

// Empty-State verständlicher machen
content = content.replace(
  "Keine Aufträge im aktuellen Filter.",
  "Keine aktuellen Aufträge im Auftragseingang. Vergangene Lieferungen findest du unter „Vergangene Aufträge“."
);

// Optionalen Hinweis unter der Tabelle ergänzen
const hintMarker = "/* past-orders-hidden-hint-v1 */";

if (!content.includes(hintMarker)) {
  const css = `
      <style>{\`
        ${hintMarker}

        .pastOrdersHint {
          margin-top: 8px;
          padding: 8px 10px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          color: #64748b;
          font-size: 12px;
          font-weight: 500;
        }

        .pastOrdersHint a {
          color: #047857;
          font-weight: 600;
          text-decoration: none;
        }
      \`}</style>
`;

  const insertAt = content.lastIndexOf("</AppLayout>");

  if (insertAt === -1) {
    throw new Error("AppLayout-Ende nicht gefunden.");
  }

  content = content.slice(0, insertAt) + css + "\n    " + content.slice(insertAt);
}

// Hinweis nach ordersTable ergänzen, falls vergangene Aufträge ausgeblendet wurden
if (!content.includes("hiddenPastOrderCount > 0")) {
  content = content.replace(
`          </div>
        </section>
      </div>`,
`          </div>

          {hiddenPastOrderCount > 0 ? (
            <div className="pastOrdersHint">
              {hiddenPastOrderCount} vergangene Auftrag{hiddenPastOrderCount === 1 ? "" : "e"} ausgeblendet.{" "}
              <a href="/auftraege?view=past">Vergangene Aufträge öffnen</a>
            </div>
          ) : null}
        </section>
      </div>`
  );
}

fs.writeFileSync(path, content, "utf8");
console.log("Vergangene Aufträge im Auftragseingang ausgeblendet.");
