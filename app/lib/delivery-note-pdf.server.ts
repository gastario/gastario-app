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

const MARGIN = 40;
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;
const FOOTER_LIMIT = 58;

function safeText(value: unknown) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\u0000/g, "")
    .trim();
}

function formatDate(
  value: Date | string | null | undefined
) {
  if (!value) {
    return "-";
  }

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

function wrapText(
  value: unknown,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const text = safeText(value);

  if (!text) {
    return [""];
  }

  const result: string[] = [];

  for (const paragraph of text.split("\n")) {
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
        const candidateFragment =
          fragment + character;

        if (
          font.widthOfTextAtSize(
            candidateFragment,
            size
          ) <= maxWidth
        ) {
          fragment = candidateFragment;
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

  return result.length ? result : [""];
}

function drawLines(params: {
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

function isServiceItem(
  item: DeliveryNoteItem
) {
  const name = safeText(item.name)
    .toLowerCase();

  const signals = [
    "delivery cost",
    "delivery costs",
    "lieferung",
    "abholung",
    "transport",
    "logistik",
    "aufbau",
    "abbau",
    "servicepersonal",
    "personal",
    "equipment",
    "mietartikel",
    "geschirr",
    "besteck",
    "gläser",
    "glaeser",
    "chafing",
    "brennpaste",
  ];

  return signals.some((signal) =>
    name.includes(signal)
  );
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

  const green = rgb(0.04, 0.58, 0.44);
  const greenDark = rgb(0.02, 0.27, 0.21);
  const greenMid = rgb(0.08, 0.42, 0.33);
  const mint = rgb(0.9, 0.97, 0.94);
  const mintLight = rgb(0.965, 0.988, 0.98);

  const dark = rgb(0.055, 0.12, 0.1);
  const body = rgb(0.18, 0.25, 0.22);
  const muted = rgb(0.4, 0.47, 0.44);

  const border = rgb(0.8, 0.87, 0.84);
  const borderSoft = rgb(0.9, 0.94, 0.92);
  const white = rgb(1, 1, 1);

  let page: PDFPage;
  let y = 0;

  const allItems = input.items.filter(
    (item) =>
      safeText(item.name) &&
      Number(item.quantity) > 0
  );

  const foodItems = allItems.filter(
    (item) => !isServiceItem(item)
  );

  const serviceItems = allItems.filter(
    (item) => isServiceItem(item)
  );

  function addPage(continuation = false) {
    page = pdf.addPage([
      A4_WIDTH,
      A4_HEIGHT,
    ]);

    if (!continuation) {
      y = A4_HEIGHT - MARGIN;
      return;
    }

    page.drawText(
      safeText(input.tenantName) || "Gastario",
      {
        x: MARGIN,
        y: A4_HEIGHT - 38,
        size: 9.5,
        font: bold,
        color: greenDark,
      }
    );

    const title =
      "Lieferschein " +
      safeText(input.number);

    const titleWidth =
      regular.widthOfTextAtSize(
        title,
        8.5
      );

    page.drawText(title, {
      x:
        A4_WIDTH -
        MARGIN -
        titleWidth,
      y: A4_HEIGHT - 38,
      size: 8.5,
      font: regular,
      color: muted,
    });

    page.drawLine({
      start: {
        x: MARGIN,
        y: A4_HEIGHT - 51,
      },
      end: {
        x: A4_WIDTH - MARGIN,
        y: A4_HEIGHT - 51,
      },
      thickness: 0.7,
      color: border,
    });

    y = A4_HEIGHT - 76;
  }

  function ensureSpace(
    height: number
  ) {
    if (y - height >= FOOTER_LIMIT) {
      return;
    }

    addPage(true);
  }

  function drawSectionLabel(
    label: string
  ) {
    page.drawText(label, {
      x: MARGIN,
      y,
      size: 8,
      font: bold,
      color: greenMid,
    });

    y -= 14;
  }

  addPage();

  /*
   * Moderner Hero-Header
   */

  const headerHeight = 128;

  page.drawRectangle({
    x: MARGIN,
    y: A4_HEIGHT - MARGIN - headerHeight,
    width: CONTENT_WIDTH,
    height: headerHeight,
    color: greenDark,
  });

  page.drawRectangle({
    x: MARGIN,
    y: A4_HEIGHT - MARGIN - headerHeight,
    width: 8,
    height: headerHeight,
    color: green,
  });

  page.drawText("LIEFERSCHEIN", {
    x: MARGIN + 24,
    y: A4_HEIGHT - MARGIN - 28,
    size: 8.5,
    font: bold,
    color: rgb(0.68, 0.9, 0.82),
  });

  page.drawText(
    safeText(input.number),
    {
      x: MARGIN + 24,
      y: A4_HEIGHT - MARGIN - 60,
      size: 23,
      font: bold,
      color: white,
    }
  );

  page.drawText(
    safeText(input.tenantName) ||
      "Gastario",
    {
      x: MARGIN + 24,
      y: A4_HEIGHT - MARGIN - 89,
      size: 10,
      font: regular,
      color: rgb(0.82, 0.93, 0.89),
    }
  );

  const orderText =
    "Auftrag " +
    safeText(input.orderNumber);

  const orderWidth =
    bold.widthOfTextAtSize(
      orderText,
      9
    );

  page.drawText(orderText, {
    x:
      A4_WIDTH -
      MARGIN -
      22 -
      orderWidth,
    y: A4_HEIGHT - MARGIN - 30,
    size: 9,
    font: bold,
    color: rgb(0.82, 0.93, 0.89),
  });

  const dateText =
    formatDate(input.deliveryDate);

  const dateWidth =
    regular.widthOfTextAtSize(
      dateText,
      9
    );

  page.drawText(dateText, {
    x:
      A4_WIDTH -
      MARGIN -
      22 -
      dateWidth,
    y: A4_HEIGHT - MARGIN - 55,
    size: 9,
    font: regular,
    color: white,
  });

  const timeText =
    safeText(input.deliveryTimeText)
      ? safeText(input.deliveryTimeText) +
        " Uhr"
      : "Uhrzeit offen";

  const timeWidth =
    regular.widthOfTextAtSize(
      timeText,
      9
    );

  page.drawText(timeText, {
    x:
      A4_WIDTH -
      MARGIN -
      22 -
      timeWidth,
    y: A4_HEIGHT - MARGIN - 76,
    size: 9,
    font: regular,
    color: white,
  });

  y =
    A4_HEIGHT -
    MARGIN -
    headerHeight -
    24;

  /*
   * Drei Informationskarten
   */

  const cardGap = 10;
  const cardWidth =
    (CONTENT_WIDTH - cardGap * 2) / 3;
  const cardHeight = 76;

  const cards = [
    {
      label: "KUNDE",
      value:
        safeText(input.customerName) ||
        "-",
    },
    {
      label: "LIEFERADRESSE",
      value:
        safeText(input.deliveryAddress) ||
        "-",
    },
    {
      label: "ANSPRECHPARTNER",
      value: [
        safeText(input.contactName),
        safeText(input.contactPhone),
      ]
        .filter(Boolean)
        .join("\n") || "-",
    },
  ];

  cards.forEach((card, index) => {
    const x =
      MARGIN +
      index * (cardWidth + cardGap);

    page.drawRectangle({
      x,
      y: y - cardHeight,
      width: cardWidth,
      height: cardHeight,
      color: mintLight,
      borderColor: border,
      borderWidth: 0.8,
    });

    page.drawRectangle({
      x,
      y: y - 4,
      width: cardWidth,
      height: 4,
      color: green,
    });

    page.drawText(card.label, {
      x: x + 13,
      y: y - 23,
      size: 7,
      font: bold,
      color: muted,
    });

    const cardLines = wrapText(
      card.value,
      index === 0 ? bold : regular,
      9.2,
      cardWidth - 26
    ).slice(0, 4);

    drawLines({
      page,
      lines: cardLines,
      x: x + 13,
      y: y - 43,
      font:
        index === 0
          ? bold
          : regular,
      size: 9.2,
      lineHeight: 11.5,
      color: dark,
    });
  });

  y -= cardHeight + 25;

  /*
   * Speisen
   */

  drawSectionLabel(
    "BESTELLTE SPEISEN"
  );

  const tableX = MARGIN;
  const tableWidth = CONTENT_WIDTH;

  const numberWidth = 34;
  const positionWidth = 330;
  const quantityWidth = 72;
  const unitWidth =
    tableWidth -
    numberWidth -
    positionWidth -
    quantityWidth;

  const positionX =
    tableX + numberWidth;

  const quantityX =
    positionX + positionWidth;

  const unitX =
    quantityX + quantityWidth;

  function drawTableHeader() {
    page.drawRectangle({
      x: tableX,
      y: y - 30,
      width: tableWidth,
      height: 30,
      color: mint,
      borderColor: border,
      borderWidth: 0.8,
    });

    const headers = [
      {
        text: "NR.",
        x: tableX + 10,
      },
      {
        text: "POSITION",
        x: positionX + 10,
      },
      {
        text: "MENGE",
        x: quantityX + 10,
      },
      {
        text: "EINHEIT",
        x: unitX + 10,
      },
    ];

    headers.forEach((header) => {
      page.drawText(header.text, {
        x: header.x,
        y: y - 19,
        size: 7.5,
        font: bold,
        color: greenDark,
      });
    });

    y -= 30;
  }

  drawTableHeader();

  const displayedFoodItems =
    foodItems.length
      ? foodItems
      : [
          {
            name: "Keine Speisen hinterlegt",
            quantity: 0,
            unit: "-",
            notes: null,
          },
        ];

  displayedFoodItems.forEach(
    (item, index) => {
      const titleLines = wrapText(
        item.name,
        bold,
        9.3,
        positionWidth - 20
      );

      const noteLines = item.notes
        ? wrapText(
            item.notes,
            regular,
            7.8,
            positionWidth - 20
          ).slice(0, 3)
        : [];

      const rowHeight = Math.max(
        42,
        titleLines.length * 12 +
          noteLines.length * 9 +
          17
      );

      if (
        y - rowHeight <
        FOOTER_LIMIT + 20
      ) {
        addPage(true);
        drawTableHeader();
      }

      page.drawRectangle({
        x: tableX,
        y: y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color:
          index % 2 === 0
            ? white
            : mintLight,
        borderColor: borderSoft,
        borderWidth: 0.6,
      });

      page.drawText(
        String(index + 1).padStart(
          2,
          "0"
        ),
        {
          x: tableX + 10,
          y: y - 22,
          size: 8,
          font: bold,
          color: greenMid,
        }
      );

      let textY = drawLines({
        page,
        lines: titleLines,
        x: positionX + 10,
        y: y - 18,
        font: bold,
        size: 9.3,
        lineHeight: 12,
        color: dark,
      });

      if (noteLines.length) {
        drawLines({
          page,
          lines: noteLines,
          x: positionX + 10,
          y: textY - 1,
          font: regular,
          size: 7.8,
          lineHeight: 9,
          color: muted,
        });
      }

      page.drawText(
        formatQuantity(item.quantity),
        {
          x: quantityX + 10,
          y: y - 22,
          size: 9,
          font: bold,
          color: dark,
        }
      );

      page.drawText(
        safeText(item.unit) || "Stk.",
        {
          x: unitX + 10,
          y: y - 22,
          size: 8.5,
          font: regular,
          color: body,
        }
      );

      y -= rowHeight;
    }
  );

  y -= 22;

  /*
   * Zusatzleistungen
   */

  if (serviceItems.length) {
    const serviceHeight =
      42 +
      serviceItems.length * 28;

    ensureSpace(serviceHeight + 25);

    drawSectionLabel(
      "ZUSATZLEISTUNGEN"
    );

    page.drawRectangle({
      x: MARGIN,
      y: y - serviceHeight,
      width: CONTENT_WIDTH,
      height: serviceHeight,
      color: mintLight,
      borderColor: border,
      borderWidth: 0.8,
    });

    let serviceY = y - 24;

    serviceItems.forEach(
      (item, index) => {
        if (index > 0) {
          page.drawLine({
            start: {
              x: MARGIN + 14,
              y: serviceY + 10,
            },
            end: {
              x:
                A4_WIDTH -
                MARGIN -
                14,
              y: serviceY + 10,
            },
            thickness: 0.5,
            color: borderSoft,
          });
        }

        page.drawText(
          safeText(item.name),
          {
            x: MARGIN + 15,
            y: serviceY,
            size: 9,
            font: bold,
            color: dark,
          }
        );

        const value =
          formatQuantity(item.quantity) +
          " " +
          (safeText(item.unit) || "Stk.");

        const valueWidth =
          regular.widthOfTextAtSize(
            value,
            8.5
          );

        page.drawText(value, {
          x:
            A4_WIDTH -
            MARGIN -
            15 -
            valueWidth,
          y: serviceY,
          size: 8.5,
          font: regular,
          color: body,
        });

        serviceY -= 28;
      }
    );

    y -= serviceHeight + 22;
  }

  /*
   * Hinweise
   */

  if (safeText(input.notes)) {
    const noteLines = wrapText(
      input.notes,
      regular,
      8.7,
      CONTENT_WIDTH - 50
    );

    const noteHeight = Math.max(
      62,
      noteLines.length * 11 + 34
    );

    ensureSpace(noteHeight + 22);

    drawSectionLabel(
      "HINWEISE ZUR LIEFERUNG"
    );

    page.drawRectangle({
      x: MARGIN,
      y: y - noteHeight,
      width: CONTENT_WIDTH,
      height: noteHeight,
      color: rgb(0.99, 0.965, 0.88),
      borderColor: rgb(0.9, 0.8, 0.5),
      borderWidth: 0.8,
    });

    page.drawRectangle({
      x: MARGIN + 14,
      y: y - 27,
      width: 18,
      height: 18,
      color: rgb(0.95, 0.74, 0.2),
    });

    page.drawText("!", {
      x: MARGIN + 20,
      y: y - 23,
      size: 10,
      font: bold,
      color: white,
    });

    drawLines({
      page,
      lines: noteLines,
      x: MARGIN + 42,
      y: y - 22,
      font: regular,
      size: 8.7,
      lineHeight: 11,
      color: body,
    });

    y -= noteHeight + 22;
  }

  /*
   * Übergabe
   */

  const handoverHeight = 126;

  ensureSpace(handoverHeight + 18);

  drawSectionLabel(
    "\u00dcBERGABEBEST\u00c4TIGUNG"
  );

  page.drawRectangle({
    x: MARGIN,
    y: y - handoverHeight,
    width: CONTENT_WIDTH,
    height: handoverHeight,
    color: white,
    borderColor: border,
    borderWidth: 0.8,
  });

  const checks = [
    "Ware vollst\u00e4ndig erhalten",
    "Abweichungen dokumentiert",
    "Leihequipment \u00fcbergeben",
  ];

  checks.forEach((label, index) => {
    const x =
      MARGIN +
      16 +
      index * 166;

    page.drawRectangle({
      x,
      y: y - 32,
      width: 10,
      height: 10,
      borderColor: green,
      borderWidth: 1,
    });

    drawLines({
      page,
      lines: wrapText(
        label,
        regular,
        7.7,
        134
      ),
      x: x + 17,
      y: y - 25,
      font: regular,
      size: 7.7,
      lineHeight: 9,
      color: body,
    });
  });

  const signatureY =
    y - handoverHeight + 31;

  const signatureWidth = 205;

  page.drawLine({
    start: {
      x: MARGIN + 16,
      y: signatureY,
    },
    end: {
      x:
        MARGIN +
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
      x: MARGIN + 16,
      y: signatureY - 13,
      size: 7.2,
      font: regular,
      color: muted,
    }
  );

  const recipientX =
    A4_WIDTH -
    MARGIN -
    16 -
    signatureWidth;

  page.drawLine({
    start: {
      x: recipientX,
      y: signatureY,
    },
    end: {
      x:
        recipientX +
        signatureWidth,
      y: signatureY,
    },
    thickness: 0.8,
    color: muted,
  });

  page.drawText(
    "Datum / Name / Unterschrift Empf\u00e4nger",
    {
      x: recipientX,
      y: signatureY - 13,
      size: 7.2,
      font: regular,
      color: muted,
    }
  );

  /*
   * Fußzeilen
   */

  const pages = pdf.getPages();

  pages.forEach(
    (currentPage, index) => {
      const footerY = 26;

      currentPage.drawLine({
        start: {
          x: MARGIN,
          y: footerY + 15,
        },
        end: {
          x: A4_WIDTH - MARGIN,
          y: footerY + 15,
        },
        thickness: 0.6,
        color: borderSoft,
      });

      currentPage.drawText(
        safeText(input.tenantName) ||
          "Gastario",
        {
          x: MARGIN,
          y: footerY,
          size: 7,
          font: bold,
          color: muted,
        }
      );

      const orderFooter =
        "Auftrag " +
        safeText(input.orderNumber);

      const orderFooterWidth =
        regular.widthOfTextAtSize(
          orderFooter,
          7
        );

      currentPage.drawText(
        orderFooter,
        {
          x:
            A4_WIDTH / 2 -
            orderFooterWidth / 2,
          y: footerY,
          size: 7,
          font: regular,
          color: muted,
        }
      );

      const pageLabel =
        "Seite " +
        String(index + 1) +
        " von " +
        String(pages.length);

      const pageLabelWidth =
        regular.widthOfTextAtSize(
          pageLabel,
          7
        );

      currentPage.drawText(
        pageLabel,
        {
          x:
            A4_WIDTH -
            MARGIN -
            pageLabelWidth,
          y: footerY,
          size: 7,
          font: regular,
          color: muted,
        }
      );
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