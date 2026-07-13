import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

type DeliveryNoteItem = {
  name: string;
  quantity: number;
  unit: string;
  notes?: string | null;
};

type DeliveryNoteInput = {
  number: string;
  orderNumber: string;
  tenantName: string;
  customerName: string;
  deliveryAddress?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  deliveryDate?: Date | string | null;
  deliveryTimeText?: string | null;
  notes?: string | null;
  items: DeliveryNoteItem[];
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 42;

function safeText(value: unknown) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .trim();
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("de-DE");
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? current + " " + word : word;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  return lines.length ? lines : [""];
}

function drawTextLines(params: {
  page: PDFPage;
  lines: string[];
  x: number;
  y: number;
  font: PDFFont;
  size: number;
  lineHeight: number;
  color?: ReturnType<typeof rgb>;
}) {
  let y = params.y;

  for (const line of params.lines) {
    params.page.drawText(line, {
      x: params.x,
      y,
      size: params.size,
      font: params.font,
      color: params.color || rgb(0.08, 0.12, 0.1),
    });

    y -= params.lineHeight;
  }

  return y;
}

export async function renderDeliveryNotePdf(
  input: DeliveryNoteInput
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - MARGIN;

  const green = rgb(0.02, 0.45, 0.34);
  const dark = rgb(0.06, 0.13, 0.1);
  const muted = rgb(0.35, 0.42, 0.39);
  const line = rgb(0.82, 0.87, 0.85);
  const light = rgb(0.95, 0.97, 0.96);

  const addPage = () => {
    page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    y = A4_HEIGHT - MARGIN;

    page.drawText("Lieferschein " + safeText(input.number), {
      x: MARGIN,
      y,
      size: 10,
      font: bold,
      color: green,
    });

    y -= 28;
  };

  page.drawText("LIEFERSCHEIN", {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: green,
  });

  page.drawText(safeText(input.tenantName), {
    x: A4_WIDTH - MARGIN - 220,
    y,
    size: 10,
    font: bold,
    color: dark,
  });

  y -= 28;

  page.drawText(safeText(input.number), {
    x: MARGIN,
    y,
    size: 24,
    font: bold,
    color: dark,
  });

  y -= 20;

  page.drawText(
    "Auftrag " +
      safeText(input.orderNumber) +
      " · " +
      formatDate(input.deliveryDate) +
      " · " +
      (safeText(input.deliveryTimeText) || "-") +
      " Uhr",
    {
      x: MARGIN,
      y,
      size: 10,
      font: regular,
      color: muted,
    }
  );

  y -= 22;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4_WIDTH - MARGIN, y },
    thickness: 1,
    color: line,
  });

  y -= 26;

  const detailRows = [
    ["Kunde", input.customerName],
    ["Adresse", input.deliveryAddress || "-"],
    [
      "Kontakt",
      [input.contactName, input.contactPhone]
        .filter(Boolean)
        .join(" · ") || "-",
    ],
  ];

  for (const [label, value] of detailRows) {
    page.drawText(label.toUpperCase(), {
      x: MARGIN,
      y,
      size: 8,
      font: bold,
      color: muted,
    });

    const lines = wrapText(
      safeText(value),
      regular,
      10,
      A4_WIDTH - MARGIN * 2 - 105
    );

    const nextY = drawTextLines({
      page,
      lines,
      x: MARGIN + 105,
      y,
      font: regular,
      size: 10,
      lineHeight: 13,
      color: dark,
    });

    y = Math.min(y - 18, nextY - 5);
  }

  y -= 8;

  const tableX = MARGIN;
  const tableWidth = A4_WIDTH - MARGIN * 2;
  const quantityX = tableX + tableWidth - 145;
  const unitX = tableX + tableWidth - 75;

  page.drawRectangle({
    x: tableX,
    y: y - 24,
    width: tableWidth,
    height: 24,
    color: light,
    borderColor: line,
    borderWidth: 1,
  });

  page.drawText("POSITION", {
    x: tableX + 10,
    y: y - 16,
    size: 8,
    font: bold,
    color: muted,
  });

  page.drawText("MENGE", {
    x: quantityX,
    y: y - 16,
    size: 8,
    font: bold,
    color: muted,
  });

  page.drawText("EINHEIT", {
    x: unitX,
    y: y - 16,
    size: 8,
    font: bold,
    color: muted,
  });

  y -= 24;

  for (const item of input.items) {
    const itemLines = wrapText(
      safeText(item.name),
      bold,
      10,
      quantityX - tableX - 25
    );

    const noteLines = item.notes
      ? wrapText(
          safeText(item.notes),
          regular,
          8,
          quantityX - tableX - 25
        )
      : [];

    const rowHeight =
      Math.max(1, itemLines.length) * 13 +
      noteLines.length * 10 +
      13;

    if (y - rowHeight < 120) {
      addPage();
    }

    page.drawRectangle({
      x: tableX,
      y: y - rowHeight,
      width: tableWidth,
      height: rowHeight,
      borderColor: line,
      borderWidth: 1,
    });

    let textY = y - 17;

    textY = drawTextLines({
      page,
      lines: itemLines,
      x: tableX + 10,
      y: textY,
      font: bold,
      size: 10,
      lineHeight: 13,
      color: dark,
    });

    if (noteLines.length) {
      drawTextLines({
        page,
        lines: noteLines,
        x: tableX + 10,
        y: textY - 2,
        font: regular,
        size: 8,
        lineHeight: 10,
        color: muted,
      });
    }

    page.drawText(String(item.quantity || 0), {
      x: quantityX,
      y: y - 18,
      size: 10,
      font: regular,
      color: dark,
    });

    page.drawText(safeText(item.unit || "Stück"), {
      x: unitX,
      y: y - 18,
      size: 10,
      font: regular,
      color: dark,
    });

    y -= rowHeight;
  }

  y -= 22;

  if (input.notes) {
    if (y < 155) addPage();

    page.drawText("HINWEISE", {
      x: MARGIN,
      y,
      size: 8,
      font: bold,
      color: muted,
    });

    y -= 15;

    y = drawTextLines({
      page,
      lines: wrapText(
        safeText(input.notes),
        regular,
        9,
        A4_WIDTH - MARGIN * 2
      ),
      x: MARGIN,
      y,
      font: regular,
      size: 9,
      lineHeight: 12,
      color: dark,
    });

    y -= 16;
  }

  /*
   * gastario-delivery-note-checklists-20260713
   */
  const checklistGroups = [
    {
      title: "Auftrag und Lieferung",
      items: [
        "Lieferadresse kontrolliert",
        "Lieferzeit kontrolliert",
        "Ansprechpartner kontrolliert",
        "Telefonnummer kontrolliert",
        "Zufahrt und Aufbauort geprüft",
      ],
    },
    {
      title: "Speisen vollständig",
      items: [
        "Alle bestellten Positionen gepackt",
        "Mengen kontrolliert",
        "Soßen und Dressings eingepackt",
        "Beilagen und Toppings eingepackt",
        "Brot und Servietten eingepackt",
        "Allergien und Sonderwünsche geprüft",
        "Kalte Speisen gekühlt",
        "Warme Speisen transportsicher",
      ],
    },
    {
      title: "Buffet und Equipment",
      items: [
        "Chafing Dishes eingepackt",
        "Deckel und Einsätze eingepackt",
        "Brennpaste eingepackt",
        "Feuerzeug eingepackt",
        "Servierzangen eingepackt",
        "Schöpfkellen eingepackt",
        "Buffetbesteck eingepackt",
        "Teller, Bowls und Becher eingepackt",
      ],
    },
    {
      title: "Aufbau und Dekoration",
      items: [
        "Deko für den Aufbau eingepackt",
        "Tischdecken oder Buffetläufer eingepackt",
        "Speiseschilder eingepackt",
        "Allergenschilder eingepackt",
        "Klebeband, Schere und Kabelbinder eingepackt",
        "Müllbeutel und Reinigungstücher eingepackt",
      ],
    },
    {
      title: "Übergabe beim Kunden",
      items: [
        "Kunde über Ankunft informiert",
        "Aufbauort abgestimmt",
        "Buffet vollständig aufgebaut",
        "Soßen und Besteck bereitgestellt",
        "Ware vollständig übergeben",
        "Leihequipment dokumentiert",
        "Empfang bestätigt",
      ],
    },
  ];

  function drawChecklistGroup(
    title: string,
    items: string[]
  ) {
    const columnGap = 18;
    const columnWidth =
      (A4_WIDTH - MARGIN * 2 - columnGap) / 2;

    const rows = Math.ceil(items.length / 2);
    const groupHeight = 32 + rows * 19 + 14;

    if (y - groupHeight < 100) {
      addPage();
    }

    page.drawRectangle({
      x: MARGIN,
      y: y - groupHeight,
      width: A4_WIDTH - MARGIN * 2,
      height: groupHeight,
      borderColor: line,
      borderWidth: 1,
      color: rgb(0.985, 0.99, 0.988),
    });

    page.drawRectangle({
      x: MARGIN,
      y: y - 28,
      width: A4_WIDTH - MARGIN * 2,
      height: 28,
      color: light,
      borderColor: line,
      borderWidth: 1,
    });

    page.drawText(title.toUpperCase(), {
      x: MARGIN + 12,
      y: y - 18,
      size: 8,
      font: bold,
      color: green,
    });

    const left = items.slice(0, rows);
    const right = items.slice(rows);

    const drawColumn = (
      values: string[],
      x: number
    ) => {
      let rowY = y - 47;

      for (const value of values) {
        page.drawRectangle({
          x,
          y: rowY - 2,
          width: 9,
          height: 9,
          borderColor: green,
          borderWidth: 1,
        });

        drawTextLines({
          page,
          lines: wrapText(
            value,
            regular,
            8.2,
            columnWidth - 25
          ),
          x: x + 16,
          y: rowY,
          font: regular,
          size: 8.2,
          lineHeight: 10,
          color: dark,
        });

        rowY -= 19;
      }
    };

    drawColumn(left, MARGIN + 12);
    drawColumn(
      right,
      MARGIN + columnWidth + columnGap
    );

    y -= groupHeight + 12;
  }

  y -= 12;

  for (const group of checklistGroups) {
    drawChecklistGroup(group.title, group.items);
  }

  if (y < 150) {
    addPage();
  }

  page.drawText("FEHLENDE ODER NACHGELIEFERTE ARTIKEL", {
    x: MARGIN,
    y,
    size: 8,
    font: bold,
    color: muted,
  });

  y -= 21;

  for (let index = 0; index < 2; index += 1) {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4_WIDTH - MARGIN, y },
      thickness: 0.6,
      color: line,
    });

    y -= 21;
  }

  page.drawText("LEIHEQUIPMENT / RÜCKHOLUNG", {
    x: MARGIN,
    y,
    size: 8,
    font: bold,
    color: muted,
  });

  y -= 21;

  for (let index = 0; index < 2; index += 1) {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4_WIDTH - MARGIN, y },
      thickness: 0.6,
      color: line,
    });

    y -= 21;
  }

  if (y < 115) addPage();

  const signatureY = Math.max(55, y - 45);

  page.drawLine({
    start: { x: MARGIN, y: signatureY },
    end: { x: MARGIN + 205, y: signatureY },
    thickness: 0.8,
    color: muted,
  });

  page.drawLine({
    start: { x: A4_WIDTH - MARGIN - 205, y: signatureY },
    end: { x: A4_WIDTH - MARGIN, y: signatureY },
    thickness: 0.8,
    color: muted,
  });

  page.drawText("Fahrer / Übergabe", {
    x: MARGIN,
    y: signatureY - 14,
    size: 8,
    font: regular,
    color: muted,
  });

  page.drawText("Kunde / Empfang", {
    x: A4_WIDTH - MARGIN - 205,
    y: signatureY - 14,
    size: 8,
    font: regular,
    color: muted,
  });

  pdf.setTitle("Lieferschein " + safeText(input.number));
  pdf.setSubject("Lieferschein zu Auftrag " + safeText(input.orderNumber));
  pdf.setCreator("Gastario");

  return Buffer.from(await pdf.save());
}
