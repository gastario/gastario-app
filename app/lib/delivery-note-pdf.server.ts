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

const PAGE_MARGIN = 42;
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;
const FOOTER_HEIGHT = 36;

function safeText(value: unknown) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\u0000/g, "")
    .trim();
}

function formatDate(
  value: Date | string | null | undefined
) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("de-DE");
}

function formatQuantity(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value.toLocaleString("de-DE", {
    maximumFractionDigits: 2,
  });
}

function isDeliveryServiceItem(
  item: DeliveryNoteItem
) {
  const value = safeText(item.name)
    .toLowerCase();

  const serviceSignals = [
    "delivery cost",
    "delivery costs",
    "lieferung",
    "abholung",
    "transport",
    "aufbau",
    "abbau",
    "servicepersonal",
    "personal",
    "equipment",
    "besteck",
    "geschirr",
    "gläser",
    "glaeser",
    "chafing",
    "brennpaste",
    "mietartikel",
    "logistik",
  ];

  return serviceSignals.some(
    (signal) => value.includes(signal)
  );
}

function getVisibleDeliveryNoteItems(
  items: DeliveryNoteItem[]
) {
  return items.filter((item) => {
    const name = safeText(item.name);

    if (!name) {
      return false;
    }

    return Number(item.quantity) > 0;
  });
}
function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const source = safeText(text);

  if (!source) {
    return [""];
  }

  const paragraphs = source.split("\n");
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) {
      result.push("");
      continue;
    }

    let current = "";

    for (const word of words) {
      const candidate = current
        ? current + " " + word
        : word;

      if (
        font.widthOfTextAtSize(candidate, size) <=
        maxWidth
      ) {
        current = candidate;
        continue;
      }

      if (current) {
        result.push(current);
      }

      if (
        font.widthOfTextAtSize(word, size) <=
        maxWidth
      ) {
        current = word;
        continue;
      }

      let fragment = "";

      for (const character of word) {
        const nextFragment = fragment + character;

        if (
          font.widthOfTextAtSize(
            nextFragment,
            size
          ) <= maxWidth
        ) {
          fragment = nextFragment;
        } else {
          if (fragment) {
            result.push(fragment);
          }

          fragment = character;
        }
      }

      current = fragment;
    }

    if (current) {
      result.push(current);
    }
  }

  return result.length > 0 ? result : [""];
}

function drawTextLines(params: {
  page: PDFPage;
  lines: string[];
  x: number;
  y: number;
  font: PDFFont;
  size: number;
  lineHeight: number;
  color: ReturnType<typeof rgb>;
}) {
  let currentY = params.y;

  for (const line of params.lines) {
    params.page.drawText(line, {
      x: params.x,
      y: currentY,
      size: params.size,
      font: params.font,
      color: params.color,
    });

    currentY -= params.lineHeight;
  }

  return currentY;
}

export async function renderDeliveryNotePdf(
  input: DeliveryNoteInput
) {
  const pdf = await PDFDocument.create();

  const regular = await pdf.embedFont(
    StandardFonts.Helvetica
  );

  const bold = await pdf.embedFont(
    StandardFonts.HelveticaBold
  );

  const green = rgb(0.035, 0.51, 0.39);
  const greenDark = rgb(0.025, 0.34, 0.27);
  const greenSoft = rgb(0.91, 0.97, 0.95);

  const dark = rgb(0.08, 0.15, 0.13);
  const body = rgb(0.19, 0.28, 0.25);
  const muted = rgb(0.39, 0.47, 0.44);

  const border = rgb(0.82, 0.88, 0.86);
  const borderSoft = rgb(0.9, 0.93, 0.92);
  const surface = rgb(0.975, 0.985, 0.982);
  const white = rgb(1, 1, 1);

  let page: PDFPage;
  let y = 0;

  const tableX = PAGE_MARGIN;
  const tableWidth = CONTENT_WIDTH;

  const positionWidth = 335;
  const quantityWidth = 82;
  const unitWidth =
    tableWidth -
    positionWidth -
    quantityWidth;

  const quantityX =
    tableX + positionWidth;

  const unitX =
    quantityX + quantityWidth;

  function drawContinuationHeader() {
    page.drawText(
      safeText(input.tenantName) || "Gastario",
      {
        x: PAGE_MARGIN,
        y: A4_HEIGHT - 45,
        size: 10,
        font: bold,
        color: greenDark,
      }
    );

    const documentText =
      "Lieferschein " + safeText(input.number);

    const documentWidth =
      bold.widthOfTextAtSize(documentText, 9);

    page.drawText(documentText, {
      x:
        A4_WIDTH -
        PAGE_MARGIN -
        documentWidth,
      y: A4_HEIGHT - 45,
      size: 9,
      font: bold,
      color: muted,
    });

    page.drawLine({
      start: {
        x: PAGE_MARGIN,
        y: A4_HEIGHT - 58,
      },
      end: {
        x: A4_WIDTH - PAGE_MARGIN,
        y: A4_HEIGHT - 58,
      },
      thickness: 0.8,
      color: border,
    });

    y = A4_HEIGHT - 82;
  }

  function addPage(
    continuation = false
  ) {
    page = pdf.addPage([
      A4_WIDTH,
      A4_HEIGHT,
    ]);

    if (continuation) {
      drawContinuationHeader();
    } else {
      y = A4_HEIGHT - PAGE_MARGIN;
    }
  }

  function drawTableHeader() {
    page.drawRectangle({
      x: tableX,
      y: y - 28,
      width: tableWidth,
      height: 28,
      color: greenSoft,
      borderColor: border,
      borderWidth: 0.8,
    });

    page.drawLine({
      start: {
        x: quantityX,
        y,
      },
      end: {
        x: quantityX,
        y: y - 28,
      },
      thickness: 0.6,
      color: border,
    });

    page.drawLine({
      start: {
        x: unitX,
        y,
      },
      end: {
        x: unitX,
        y: y - 28,
      },
      thickness: 0.6,
      color: border,
    });

    page.drawText("POSITION", {
      x: tableX + 12,
      y: y - 18,
      size: 8,
      font: bold,
      color: greenDark,
    });

    page.drawText("MENGE", {
      x: quantityX + 12,
      y: y - 18,
      size: 8,
      font: bold,
      color: greenDark,
    });

    page.drawText("EINHEIT", {
      x: unitX + 12,
      y: y - 18,
      size: 8,
      font: bold,
      color: greenDark,
    });

    y -= 28;
  }

  function ensureSpace(
    requiredHeight: number,
    repeatTableHeader = false
  ) {
    const minimumY =
      PAGE_MARGIN + FOOTER_HEIGHT + 20;

    if (y - requiredHeight >= minimumY) {
      return;
    }

    addPage(true);

    if (repeatTableHeader) {
      drawTableHeader();
    }
  }

  addPage(false);

  /*
   * Kopfbereich
   */

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: A4_HEIGHT - 154,
    width: CONTENT_WIDTH,
    height: 112,
    color: greenDark,
  });

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: A4_HEIGHT - 154,
    width: 7,
    height: 112,
    color: green,
  });

  page.drawText(
    safeText(input.tenantName) || "Gastario",
    {
      x: PAGE_MARGIN + 22,
      y: A4_HEIGHT - 70,
      size: 13,
      font: bold,
      color: white,
    }
  );

  page.drawText("LIEFERSCHEIN", {
    x: PAGE_MARGIN + 22,
    y: A4_HEIGHT - 101,
    size: 9,
    font: bold,
    color: rgb(0.72, 0.9, 0.84),
  });

  page.drawText(
    safeText(input.number),
    {
      x: PAGE_MARGIN + 22,
      y: A4_HEIGHT - 132,
      size: 24,
      font: bold,
      color: white,
    }
  );

  const orderLabel =
    "Auftrag " + safeText(input.orderNumber);

  const orderLabelWidth =
    bold.widthOfTextAtSize(orderLabel, 10);

  page.drawText(orderLabel, {
    x:
      A4_WIDTH -
      PAGE_MARGIN -
      22 -
      orderLabelWidth,
    y: A4_HEIGHT - 132,
    size: 10,
    font: bold,
    color: rgb(0.82, 0.94, 0.9),
  });

  y = A4_HEIGHT - 178;

  /*
   * Lieferinformationen
   */

  const cardGap = 12;
  const cardWidth =
    (CONTENT_WIDTH - cardGap * 2) / 3;
  const cardHeight = 66;

  const informationCards = [
    {
      label: "LIEFERDATUM",
      value: formatDate(input.deliveryDate),
    },
    {
      label: "LIEFERZEIT",
      value:
        safeText(input.deliveryTimeText) ||
        "Noch offen",
    },
    {
      label: "POSITIONEN",
      value: String(input.items.length),
    },
  ];

  informationCards.forEach(
    (information, index) => {
      const x =
        PAGE_MARGIN +
        index * (cardWidth + cardGap);

      page.drawRectangle({
        x,
        y: y - cardHeight,
        width: cardWidth,
        height: cardHeight,
        color: surface,
        borderColor: border,
        borderWidth: 0.8,
      });

      page.drawText(information.label, {
        x: x + 14,
        y: y - 21,
        size: 7.5,
        font: bold,
        color: muted,
      });

      const valueLines = wrapText(
        information.value,
        bold,
        12,
        cardWidth - 28
      );

      drawTextLines({
        page,
        lines: valueLines.slice(0, 2),
        x: x + 14,
        y: y - 43,
        font: bold,
        size: 12,
        lineHeight: 14,
        color: dark,
      });
    }
  );

  y -= cardHeight + 22;

  /*
   * Empfängerblock
   */

  page.drawText("LIEFERUNG AN", {
    x: PAGE_MARGIN,
    y,
    size: 8,
    font: bold,
    color: green,
  });

  y -= 14;

  const recipientHeight = 104;

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - recipientHeight,
    width: CONTENT_WIDTH,
    height: recipientHeight,
    color: white,
    borderColor: border,
    borderWidth: 0.8,
  });

  const recipientLeftX =
    PAGE_MARGIN + 16;

  const recipientRightX =
    PAGE_MARGIN + CONTENT_WIDTH / 2 + 12;

  page.drawText(
    safeText(input.customerName) || "-",
    {
      x: recipientLeftX,
      y: y - 24,
      size: 13,
      font: bold,
      color: dark,
    }
  );

  const addressLines = wrapText(
    safeText(input.deliveryAddress) || "-",
    regular,
    9.5,
    CONTENT_WIDTH / 2 - 36
  );

  drawTextLines({
    page,
    lines: addressLines.slice(0, 4),
    x: recipientLeftX,
    y: y - 46,
    font: regular,
    size: 9.5,
    lineHeight: 13,
    color: body,
  });

  page.drawLine({
    start: {
      x: PAGE_MARGIN + CONTENT_WIDTH / 2,
      y: y - 14,
    },
    end: {
      x: PAGE_MARGIN + CONTENT_WIDTH / 2,
      y: y - recipientHeight + 14,
    },
    thickness: 0.7,
    color: borderSoft,
  });

  page.drawText("ANSPRECHPARTNER", {
    x: recipientRightX,
    y: y - 23,
    size: 7.5,
    font: bold,
    color: muted,
  });

  page.drawText(
    safeText(input.contactName) || "-",
    {
      x: recipientRightX,
      y: y - 42,
      size: 10,
      font: bold,
      color: dark,
    }
  );

  page.drawText("TELEFON", {
    x: recipientRightX,
    y: y - 65,
    size: 7.5,
    font: bold,
    color: muted,
  });

  page.drawText(
    safeText(input.contactPhone) || "-",
    {
      x: recipientRightX,
      y: y - 84,
      size: 10,
      font: regular,
      color: body,
    }
  );

  y -= recipientHeight + 24;

  /*
   * Positionstabelle
   */

  page.drawText("BESTELLTE POSITIONEN", {
    x: PAGE_MARGIN,
    y,
    size: 8,
    font: bold,
    color: green,
  });

  y -= 14;

  drawTableHeader();

  const allVisibleItems =
    getVisibleDeliveryNoteItems(
      input.items
    );

  const foodItems = allVisibleItems.filter(
    (item) => !isDeliveryServiceItem(item)
  );

  const serviceItems = allVisibleItems.filter(
    (item) => isDeliveryServiceItem(item)
  );

  const displayedFoodItems =
    foodItems.length > 0
      ? foodItems
      : [
          {
            name: "Keine Speisen hinterlegt",
            quantity: 0,
            unit: "-",
            notes: null,
          },
        ];

  displayedFoodItems.forEach((item, index) => {
    const itemLines = wrapText(
      safeText(item.name) || "-",
      bold,
      9.5,
      positionWidth - 24
    );

    const noteLines = item.notes
      ? wrapText(
          safeText(item.notes),
          regular,
          8,
          positionWidth - 24
        )
      : [];

    const rowTextHeight =
      itemLines.length * 13 +
      noteLines.length * 10;

    const rowHeight =
      Math.max(42, rowTextHeight + 18);

    ensureSpace(rowHeight, true);

    page.drawRectangle({
      x: tableX,
      y: y - rowHeight,
      width: tableWidth,
      height: rowHeight,
      color:
        index % 2 === 0
          ? white
          : surface,
      borderColor: borderSoft,
      borderWidth: 0.7,
    });

    page.drawLine({
      start: {
        x: quantityX,
        y,
      },
      end: {
        x: quantityX,
        y: y - rowHeight,
      },
      thickness: 0.6,
      color: borderSoft,
    });

    page.drawLine({
      start: {
        x: unitX,
        y,
      },
      end: {
        x: unitX,
        y: y - rowHeight,
      },
      thickness: 0.6,
      color: borderSoft,
    });

    let textY = drawTextLines({
      page,
      lines: itemLines,
      x: tableX + 12,
      y: y - 17,
      font: bold,
      size: 9.5,
      lineHeight: 13,
      color: dark,
    });

    if (noteLines.length > 0) {
      drawTextLines({
        page,
        lines: noteLines,
        x: tableX + 12,
        y: textY - 1,
        font: regular,
        size: 8,
        lineHeight: 10,
        color: muted,
      });
    }

    page.drawText(
      formatQuantity(item.quantity),
      {
        x: quantityX + 12,
        y: y - 23,
        size: 9.5,
        font: bold,
        color: dark,
      }
    );

    page.drawText(
      safeText(item.unit) || "St\u00fcck",
      {
        x: unitX + 12,
        y: y - 23,
        size: 9,
        font: regular,
        color: body,
      }
    );

    y -= rowHeight;
  });

  y -= 22;

  if (serviceItems.length > 0) {
    const serviceRowHeight = 24;
    const serviceHeight =
      35 +
      serviceItems.length *
        serviceRowHeight;

    ensureSpace(serviceHeight + 22);

    page.drawText("ZUSATZLEISTUNGEN", {
      x: PAGE_MARGIN,
      y,
      size: 8,
      font: bold,
      color: green,
    });

    y -= 14;

    page.drawRectangle({
      x: PAGE_MARGIN,
      y: y - serviceHeight,
      width: CONTENT_WIDTH,
      height: serviceHeight,
      color: surface,
      borderColor: border,
      borderWidth: 0.8,
    });

    let serviceY = y - 22;

    serviceItems.forEach(
      (item, index) => {
        if (index > 0) {
          page.drawLine({
            start: {
              x: PAGE_MARGIN + 12,
              y: serviceY + 8,
            },
            end: {
              x:
                A4_WIDTH -
                PAGE_MARGIN -
                12,
              y: serviceY + 8,
            },
            thickness: 0.5,
            color: borderSoft,
          });
        }

        page.drawText(
          safeText(item.name),
          {
            x: PAGE_MARGIN + 14,
            y: serviceY,
            size: 9,
            font: bold,
            color: dark,
          }
        );

        const quantityText =
          formatQuantity(item.quantity) +
          " " +
          safeText(item.unit);

        const quantityWidth =
          regular.widthOfTextAtSize(
            quantityText,
            8.5
          );

        page.drawText(quantityText, {
          x:
            A4_WIDTH -
            PAGE_MARGIN -
            14 -
            quantityWidth,
          y: serviceY,
          size: 8.5,
          font: regular,
          color: body,
        });

        serviceY -= serviceRowHeight;
      }
    );

    y -= serviceHeight + 22;
  }
  /*
   * Hinweise
   */

  if (safeText(input.notes)) {
    const noteLines = wrapText(
      safeText(input.notes),
      regular,
      9,
      CONTENT_WIDTH - 28
    );

    const noteHeight =
      Math.max(
        62,
        noteLines.length * 12 + 34
      );

    ensureSpace(noteHeight + 18);

    page.drawRectangle({
      x: PAGE_MARGIN,
      y: y - noteHeight,
      width: CONTENT_WIDTH,
      height: noteHeight,
      color: greenSoft,
      borderColor: border,
      borderWidth: 0.8,
    });

    page.drawText("HINWEISE ZUR LIEFERUNG", {
      x: PAGE_MARGIN + 14,
      y: y - 19,
      size: 7.5,
      font: bold,
      color: greenDark,
    });

    drawTextLines({
      page,
      lines: noteLines,
      x: PAGE_MARGIN + 14,
      y: y - 39,
      font: regular,
      size: 9,
      lineHeight: 12,
      color: body,
    });

    y -= noteHeight + 22;
  }

  /*
   * Übergabe und Unterschrift
   */

  const handoverHeight = 142;

  ensureSpace(handoverHeight);

  page.drawText("ÜBERGABEBESTÄTIGUNG", {
    x: PAGE_MARGIN,
    y,
    size: 8,
    font: bold,
    color: green,
  });

  y -= 14;

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - handoverHeight,
    width: CONTENT_WIDTH,
    height: handoverHeight,
    color: white,
    borderColor: border,
    borderWidth: 0.8,
  });

  const checkboxY = y - 25;

  const confirmationItems = [
    "Ware vollständig erhalten",
    "Abweichungen dokumentiert",
    "Leihequipment übergeben",
  ];

  confirmationItems.forEach(
    (label, index) => {
      const x =
        PAGE_MARGIN +
        16 +
        index * 166;

      page.drawRectangle({
        x,
        y: checkboxY - 7,
        width: 10,
        height: 10,
        borderColor: green,
        borderWidth: 1,
      });

      const confirmationLines = wrapText(
        label,
        regular,
        8,
        138
      );

      drawTextLines({
        page,
        lines: confirmationLines,
        x: x + 17,
        y: checkboxY,
        font: regular,
        size: 8,
        lineHeight: 10,
        color: body,
      });
    }
  );

  const signatureY =
    y - handoverHeight + 35;

  const signatureWidth = 210;

  page.drawLine({
    start: {
      x: PAGE_MARGIN + 16,
      y: signatureY,
    },
    end: {
      x:
        PAGE_MARGIN +
        16 +
        signatureWidth,
      y: signatureY,
    },
    thickness: 0.8,
    color: muted,
  });

  page.drawText(
    "Datum / Name Fahrer",
    {
      x: PAGE_MARGIN + 16,
      y: signatureY - 14,
      size: 7.5,
      font: regular,
      color: muted,
    }
  );

  const customerSignatureX =
    A4_WIDTH -
    PAGE_MARGIN -
    16 -
    signatureWidth;

  page.drawLine({
    start: {
      x: customerSignatureX,
      y: signatureY,
    },
    end: {
      x:
        customerSignatureX +
        signatureWidth,
      y: signatureY,
    },
    thickness: 0.8,
    color: muted,
  });

  page.drawText(
    "Datum / Name / Unterschrift Empfänger",
    {
      x: customerSignatureX,
      y: signatureY - 14,
      size: 7.5,
      font: regular,
      color: muted,
    }
  );

  /*
   * Fußzeilen und Seitennummern
   */

  const pages = pdf.getPages();

  pages.forEach(
    (currentPage, index) => {
      const footerY = 28;

      currentPage.drawLine({
        start: {
          x: PAGE_MARGIN,
          y: footerY + 16,
        },
        end: {
          x: A4_WIDTH - PAGE_MARGIN,
          y: footerY + 16,
        },
        thickness: 0.6,
        color: borderSoft,
      });

      currentPage.drawText(
        safeText(input.tenantName) ||
          "Gastario",
        {
          x: PAGE_MARGIN,
          y: footerY,
          size: 7.5,
          font: bold,
          color: muted,
        }
      );

      const footerCenterText =
        "Auftrag " +
        safeText(input.orderNumber);

      const footerCenterWidth =
        regular.widthOfTextAtSize(
          footerCenterText,
          7.5
        );

      currentPage.drawText(
        footerCenterText,
        {
          x:
            A4_WIDTH / 2 -
            footerCenterWidth / 2,
          y: footerY,
          size: 7.5,
          font: regular,
          color: muted,
        }
      );

      const pageText =
        "Seite " +
        String(index + 1) +
        " von " +
        String(pages.length);

      const pageTextWidth =
        regular.widthOfTextAtSize(
          pageText,
          7.5
        );

      currentPage.drawText(pageText, {
        x:
          A4_WIDTH -
          PAGE_MARGIN -
          pageTextWidth,
        y: footerY,
        size: 7.5,
        font: regular,
        color: muted,
      });
    }
  );

  pdf.setTitle(
    "Lieferschein " +
      safeText(input.number)
  );

  pdf.setSubject(
    "Lieferschein zu Auftrag " +
      safeText(input.orderNumber)
  );

  pdf.setCreator("Gastario");

  return Buffer.from(
    await pdf.save()
  );
}