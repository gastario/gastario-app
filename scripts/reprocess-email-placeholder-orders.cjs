const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function parseGermanDate(value) {
  const match = String(value || "").match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) return null;

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3];

  return new Date(`${year}-${month}-${day}T00:00:00`);
}

function extractLineValue(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped + "\\s*:?\\s*([^\\n\\r]+)", "i");
  const match = String(text || "").match(regex);
  return match?.[1]?.trim() || "";
}

function extractDraft(email) {
  const body = String(email?.bodyText || "");
  const subject = String(email?.subject || "");

  const externalOrderNumber =
    extractLineValue(body, "Auftragsname") ||
    (subject.match(/\b\d{4}-\d{5,}\b/) || [])[0] ||
    null;

  const deliveryDate = parseGermanDate(extractLineValue(body, "Event Datum"));
  const eventType = extractLineValue(body, "Anlass");
  const persons = extractLineValue(body, "Personenanzahl");

  let customerName = "";
  const customerMatch = body.match(/Der Kunde\s+(.+?)\s+hat Dein Angebot gebucht/i);

  if (customerMatch?.[1]) {
    customerName = customerMatch[1].trim();
  }

  const eventName = [
    externalOrderNumber ? `Heycater ${externalOrderNumber}` : subject,
    eventType || "",
    persons ? `${persons} Personen` : "",
  ].filter(Boolean).join(" · ");

  return {
    externalOrderNumber,
    deliveryDate,
    eventType,
    persons,
    customerName,
    eventName,
  };
}

async function main() {
  const orders = await prisma.order.findMany({
    where: {
      source: "EMAIL",
      status: "AUTO_CREATED",
      incomingEmailId: {
        not: null,
      },
    },
    include: {
      incomingEmail: true,
      items: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  console.log("Gefundene E-Mail-Pruefauftraege:", orders.length);

  let updated = 0;

  for (const order of orders) {
    if (!order.incomingEmail) continue;

    const draft = extractDraft(order.incomingEmail);

    const shouldUpdate =
      draft.customerName ||
      draft.deliveryDate ||
      draft.externalOrderNumber ||
      draft.eventName ||
      draft.persons;

    if (!shouldUpdate) {
      console.log("Keine Daten erkannt:", order.orderNumber);
      continue;
    }

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        customerName: draft.customerName || order.customerName,
        externalOrderNumber: draft.externalOrderNumber || order.externalOrderNumber,
        deliveryDate: draft.deliveryDate || order.deliveryDate,
        eventName: draft.eventName || order.eventName,
        reviewReason:
          "Aus E-Mail nacherkannt. Bitte Lieferadresse, Uhrzeit, Positionen und Summe pruefen.",
      },
    });

    if (order.items[0]) {
      await prisma.orderItem.update({
        where: {
          id: order.items[0].id,
        },
        data: {
          name: draft.eventName || order.items[0].name,
          quantity: draft.persons ? Number(draft.persons) || order.items[0].quantity : order.items[0].quantity,
          unit: draft.persons ? "Personen" : order.items[0].unit,
          notes: "Aus E-Mail nacherkannt. Preis, genaue Positionen und Allergene bitte pruefen.",
        },
      });
    }

    updated += 1;
    console.log("Aktualisiert:", order.orderNumber, "=>", draft.customerName || "-", draft.externalOrderNumber || "-", draft.deliveryDate || "-");
  }

  console.log("");
  console.log("Aktualisiert gesamt:", updated);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    prisma.$disconnect();
  });
