import { prisma } from "./prisma.server";
import { renderDeliveryNotePdf } from "./delivery-note-pdf.server";

function cleanDeliveryNoteItemNote(
  value: unknown
) {
  const text = String(value || "")
    .replace(/\r/g, "")
    .trim();

  if (!text) {
    return null;
  }

  /*
   * Lange Zutatenlisten gehören nicht auf den Lieferschein.
   * Echte Sonderwünsche und Lieferhinweise bleiben sichtbar.
   */
  const relevantSignals = [
    "ohne ",
    "extra ",
    "separat",
    "glutenfrei",
    "gluten-free",
    "vegan",
    "vegetarisch",
    "allergie",
    "sonderwunsch",
    "bitte ",
    "warmhalten",
    "kalt liefern",
  ];

  const normalized = text.toLowerCase();

  const isRelevant = relevantSignals.some(
    (signal) => normalized.includes(signal)
  );

  if (!isRelevant) {
    return null;
  }

  return text.length > 180
    ? text.slice(0, 177).trimEnd() + "..."
    : text;
}

function extractEventStartTime(
  value: unknown
) {
  const text = String(value || "")
    .replace(/\r/g, " ")
    .trim();

  if (!text) {
    return null;
  }

  const match = text.match(
    /(?:Eventbeginn|Eventzeitpunkt|Eventzeit|Eventstart|Beginn)\s*:?\s*(\d{1,2})[.:](\d{2})(?:\s*Uhr)?/i
  );

  if (!match) {
    return null;
  }

  const hours = String(match[1])
    .padStart(2, "0");

  const minutes = String(match[2])
    .padStart(2, "0");

  return hours + ":" + minutes;
}
function cleanDeliveryNoteGeneralNotes(
  value: unknown
) {
  const text = String(value || "")
    .replace(/\r/g, "")
    .trim();

  if (!text) {
    return null;
  }

  const cleanedLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const normalized = line.toLowerCase();

      return !(
        normalized.includes(
          "automatisch aus e-mail erkannt"
        ) ||
        normalized.startsWith("eventdatum:") ||
        normalized.startsWith("eventbeginn:") ||
        normalized.startsWith("importquelle:") ||
        normalized.startsWith("klassifizierung:")
      );
    });

  const cleaned = cleanedLines.join("\n").trim();

  return cleaned || null;
}

function normalizeDeliveryNoteUnit(
  value: unknown
) {
  const unit = String(value || "")
    .trim()
    .toLowerCase();

  if (
    !unit ||
    unit === "stück" ||
    unit === "stueck" ||
    unit === "piece" ||
    unit === "pieces"
  ) {
    return "Stk.";
  }

  if (
    unit === "portion" ||
    unit === "portionen"
  ) {
    return "Port.";
  }

  if (
    unit === "person" ||
    unit === "personen" ||
    unit === "pax"
  ) {
    return "Pers.";
  }

  if (unit === "kilogramm") {
    return "kg";
  }

  if (unit === "liter") {
    return "l";
  }

  return String(value || "").trim();
}
function joinAddressParts(
  street: unknown,
  houseNumber: unknown,
  postalCode: unknown,
  city: unknown,
  country?: unknown
) {
  const streetLine = [
    String(street || "").trim(),
    String(houseNumber || "").trim(),
  ]
    .filter(Boolean)
    .join(" ");

  const cityLine = [
    String(postalCode || "").trim(),
    String(city || "").trim(),
  ]
    .filter(Boolean)
    .join(" ");

  const countryText =
    String(country || "").trim();

  return [
    streetLine,
    cityLine,
    countryText &&
    countryText.toUpperCase() !== "DE"
      ? countryText
      : "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function buildDeliveryAddress(
  order: {
    deliveryAddress?: string | null;
    customer?: {
      address?: string | null;
      street?: string | null;
      houseNumber?: string | null;
      postalCode?: string | null;
      city?: string | null;
      country?: string | null;
      differentDeliveryAddress?: boolean;
      deliveryStreet?: string | null;
      deliveryHouseNumber?: string | null;
      deliveryPostalCode?: string | null;
      deliveryCity?: string | null;
      deliveryCountry?: string | null;
    } | null;
  }
) {
  const customer = order.customer;

  const orderAddress =
    String(order.deliveryAddress || "")
      .trim();

  const legacyCustomerAddress =
    String(customer?.address || "")
      .trim();

  const standardCustomerAddress =
    joinAddressParts(
      customer?.street,
      customer?.houseNumber,
      customer?.postalCode,
      customer?.city,
      customer?.country
    );

  const differentDeliveryAddress =
    joinAddressParts(
      customer?.deliveryStreet,
      customer?.deliveryHouseNumber,
      customer?.deliveryPostalCode,
      customer?.deliveryCity,
      customer?.deliveryCountry
    );

  const candidates = [
    orderAddress,
    customer?.differentDeliveryAddress
      ? differentDeliveryAddress
      : "",
    standardCustomerAddress,
    legacyCustomerAddress,
    differentDeliveryAddress,
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  if (candidates.length === 0) {
    return null;
  }

  /*
   * Die vollständigste vorhandene Anschrift verwenden.
   * So gewinnt z. B. "Straße 12\n10587 Berlin"
   * gegen den unvollständigen Wert "10587 Berlin".
   */
  return candidates.sort(
    (left, right) =>
      right.length - left.length
  )[0];
}
export async function ensureDeliveryNoteForOrder(
  orderId: string,
  options?: {
    force?: boolean;
  }
) {
  const existing = await prisma.deliveryNote.findUnique({
    where: {
      orderId,
    },
  });


  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    include: {
      items: true,
      tenant: true,
      customer: true,
      incomingEmail: {
        select: {
          bodyText: true,
          attachments: {
            select: {
              textContent: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error("Auftrag nicht gefunden.");
  }

  /*
   * gastario-delivery-note-original-event-time-20260726
   *
   * Bei bestehenden Aufträgen den tatsächlichen Eventbeginn
   * erneut aus der ursprünglichen E-Mail und den gespeicherten
   * PDF-Texten auslesen.
   */
  const originalImportText = [
    order.incomingEmail?.bodyText,
    ...(order.incomingEmail?.attachments || [])
      .map((attachment) =>
        String(
          attachment.textContent || ""
        ).trim()
      ),
  ]
    .filter(Boolean)
    .join("\n");

  const eventTimeFromOriginalImport =
    extractEventStartTime(
      originalImportText
    );

  const eventTimeFromStoredNotes =
    extractEventStartTime(
      order.notes
    );

  const normalizeComparableTime = (
    value: unknown
  ) => {
    const text = String(value || "")
      .replace(/\s*Uhr$/i, "")
      .trim();

    const match = text.match(
      /^(\d{1,2})[.:](\d{2})$/
    );

    if (!match) {
      return text;
    }

    return (
      String(match[1]).padStart(2, "0") +
      ":" +
      String(match[2]).padStart(2, "0")
    );
  };

  const normalizedDeliveryTime =
    normalizeComparableTime(
      order.deliveryTimeText
    );

  const normalizedStoredEventTime =
    normalizeComparableTime(
      eventTimeFromStoredNotes
    );

  const resolvedDeliveryNoteEventTime =
    eventTimeFromOriginalImport ||
    (
      normalizedStoredEventTime &&
      normalizedStoredEventTime !==
        normalizedDeliveryTime
        ? normalizedStoredEventTime
        : null
    );

  /*
   * gastario-complete-delivery-address-20260713
   * Die vollständigere Adresse aus Auftrag oder Kundenstamm verwenden.
   */
  const completeDeliveryAddress =
    buildDeliveryAddress(order);

  const allowedStatuses = [
    "CONFIRMED",
    "IN_PRODUCTION",
    "PACKING_OPEN",
    "DELIVERED",
  ];

  if (!allowedStatuses.includes(String(order.status))) {
    throw new Error(
      "Für diesen Auftragsstatus kann noch kein Lieferschein erstellt werden."
    );
  }

  const number = "LS-" + order.orderNumber;
  const filename =
    number.replace(/[^a-zA-Z0-9._-]+/g, "-") + ".pdf";

  const pdfData = await renderDeliveryNotePdf({
    number,
    orderNumber: order.orderNumber,
    tenantName: order.tenant.name,
    customerName: order.customerName,
    deliveryAddress: completeDeliveryAddress,
    contactName: order.contactName,
    contactPhone:
      String(
        order.contactPhone ||
        order.customer?.phone ||
        ""
      ).trim() || null,
    deliveryDate: order.deliveryDate,
    deliveryTimeText: order.deliveryTimeText,
    eventTimeText:
      resolvedDeliveryNoteEventTime,
    notes: cleanDeliveryNoteGeneralNotes(
      order.notes
    ),
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: normalizeDeliveryNoteUnit(
        item.unit
      ),
      notes: cleanDeliveryNoteItemNote(
        item.notes
      ),
    })),
  });

  return prisma.deliveryNote.upsert({
    where: {
      orderId: order.id,
    },
    update: {
      number,
      filename,
      mimeType: "application/pdf",
      pdfData,
      generatedAt: new Date(),
    },
    create: {
      tenantId: order.tenantId,
      orderId: order.id,
      number,
      filename,
      mimeType: "application/pdf",
      pdfData,
    },
  });
}
