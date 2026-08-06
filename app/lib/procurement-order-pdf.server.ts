import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

type ProcurementOrderPdfItem = {
  ingredientName: string;
  catalogItemName: string;
  articleNumber?: string | null;
  packageCount: number;
  packContent?: number | null;
  baseUnit?: string | null;
  netUnitPriceCents: number;
  netTotalCents: number;
};

type ProcurementOrderPdfInput = {
  tenantName: string;
  supplierName: string;
  planningDate: Date | string;
  planType: string;
  status: string;
  createdAt: Date | string;
  orderedAt?: Date | string | null;
  receivedAt?: Date | string | null;
  netTotalCents: number;
  items: ProcurementOrderPdfItem[];
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 42;

function safeText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(cents || 0) / 100);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "–";
  }

  return new Date(value).toLocaleDateString(
    "de-DE"
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Entwurf",
    ORDERED: "Bestellt",
    PARTIALLY_RECEIVED: "Teilweise geliefert",
    RECEIVED: "Geliefert",
    CANCELLED: "Storniert",
  };

  return labels[status] || status;
}

function planTypeLabel(planType: string) {
  return planType === "PRACTICAL"
    ? "Praktischer Einkaufsplan"
    : "Günstigster Einkaufsplan";
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

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current
      ? `${current} ${word}`
      : word;

    if (
      font.widthOfTextAtSize(
        candidate,
        size
      ) <= maxWidth
    ) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }

      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
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
      font: params.font,
      size: params.size,
      color: params.color,
    });

    currentY -= params.lineHeight;
  }

  return currentY;
}

export async function renderProcurementOrderPdf(
  input: ProcurementOrderPdfInput
) {
  const pdf = await PDFDocument.create();

  const regular = await pdf.embedFont(
    StandardFonts.Helvetica
  );

  const bold = await pdf.embedFont(
    StandardFonts.HelveticaBold
  );

  const green = rgb(0.03, 0.45, 0.36);
  const greenDark = rgb(0.04, 0.24, 0.2);
  const greenSoft = rgb(0.9, 0.97, 0.94);
  const gray = rgb(0.42, 0.51, 0.48);
  const lightGray = rgb(0.9, 0.93, 0.92);
  const white = rgb(1, 1, 1);
  const black = rgb(0.12, 0.16, 0.15);

  let page: PDFPage;
  let y = 0;

  function addPage(continuation = false) {
    page = pdf.addPage([
      A4_WIDTH,
      A4_HEIGHT,
    ]);

    y = A4_HEIGHT - MARGIN;

    page.drawRectangle({
      x: 0,
      y: A4_HEIGHT - 84,
      width: A4_WIDTH,
      height: 84,
      color: greenDark,
    });

    page.drawText("GASTARIO", {
      x: MARGIN,
      y: A4_HEIGHT - 46,
      font: bold,
      size: 18,
      color: white,
    });

    page.drawText(
      continuation
        ? "Einkaufsbestellung – Fortsetzung"
        : "Einkaufsbestellung",
      {
        x: MARGIN,
        y: A4_HEIGHT - 67,
        font: regular,
        size: 10,
        color: white,
      }
    );

    page.drawText(
      safeText(input.tenantName),
      {
        x: A4_WIDTH - MARGIN - 210,
        y: A4_HEIGHT - 52,
        font: regular,
        size: 9,
        color: white,
        maxWidth: 210,
      }
    );

    y = A4_HEIGHT - 110;
  }

  addPage(false);

  page.drawText("Lieferant", {
    x: MARGIN,
    y,
    font: regular,
    size: 8,
    color: gray,
  });

  page.drawText(
    safeText(input.supplierName),
    {
      x: MARGIN,
      y: y - 18,
      font: bold,
      size: 16,
      color: greenDark,
    }
  );

  page.drawText("Planungstag", {
    x: 340,
    y,
    font: regular,
    size: 8,
    color: gray,
  });

  page.drawText(
    formatDate(input.planningDate),
    {
      x: 340,
      y: y - 18,
      font: bold,
      size: 12,
      color: black,
    }
  );

  y -= 54;

  const facts = [
    [
      "Plan",
      planTypeLabel(input.planType),
    ],
    [
      "Status",
      statusLabel(input.status),
    ],
    [
      "Erstellt",
      formatDate(input.createdAt),
    ],
    [
      "Bestellt",
      formatDate(input.orderedAt),
    ],
  ];

  const factWidth =
    (A4_WIDTH - MARGIN * 2 - 18) / 4;

  facts.forEach((fact, index) => {
    const x =
      MARGIN + index * (factWidth + 6);

    page.drawRectangle({
      x,
      y: y - 42,
      width: factWidth,
      height: 42,
      color: greenSoft,
      borderColor: lightGray,
      borderWidth: 0.6,
    });

    page.drawText(fact[0], {
      x: x + 9,
      y: y - 13,
      font: regular,
      size: 7,
      color: gray,
    });

    page.drawText(fact[1], {
      x: x + 9,
      y: y - 29,
      font: bold,
      size: 9,
      color: greenDark,
      maxWidth: factWidth - 18,
    });
  });

  y -= 66;

  const columns = {
    article: MARGIN,
    number: 270,
    quantity: 365,
    unitPrice: 435,
    total: 510,
  };

  function drawTableHeader() {
    page.drawRectangle({
      x: MARGIN,
      y: y - 24,
      width: A4_WIDTH - MARGIN * 2,
      height: 24,
      color: green,
    });

    const headers = [
      ["Artikel", columns.article],
      ["Art.-Nr.", columns.number],
      ["Menge", columns.quantity],
      ["Einzel", columns.unitPrice],
      ["Gesamt", columns.total],
    ];

    for (const [label, x] of headers) {
      page.drawText(String(label), {
        x: Number(x),
        y: y - 16,
        font: bold,
        size: 7,
        color: white,
      });
    }

    y -= 30;
  }

  drawTableHeader();

  for (const item of input.items) {
    const titleLines = wrapText(
      item.ingredientName,
      bold,
      8,
      205
    );

    const articleLines = wrapText(
      item.catalogItemName,
      regular,
      7,
      205
    );

    const lineCount = Math.max(
      titleLines.length +
        articleLines.length,
      2
    );

    const rowHeight =
      Math.max(44, lineCount * 10 + 14);

    if (y - rowHeight < 64) {
      addPage(true);
      drawTableHeader();
    }

    page.drawRectangle({
      x: MARGIN,
      y: y - rowHeight,
      width: A4_WIDTH - MARGIN * 2,
      height: rowHeight,
      color: white,
      borderColor: lightGray,
      borderWidth: 0.5,
    });

    let textY = y - 13;

    textY = drawTextLines({
      page,
      lines: titleLines,
      x: columns.article,
      y: textY,
      font: bold,
      size: 8,
      lineHeight: 10,
      color: black,
    });

    drawTextLines({
      page,
      lines: articleLines,
      x: columns.article,
      y: textY - 1,
      font: regular,
      size: 7,
      lineHeight: 9,
      color: gray,
    });

    page.drawText(
      safeText(item.articleNumber) || "–",
      {
        x: columns.number,
        y: y - 20,
        font: regular,
        size: 7,
        color: black,
        maxWidth: 85,
      }
    );

    const quantityText = [
      formatNumber(item.packageCount),
      "Pack.",
      item.packContent
        ? `à ${formatNumber(
            item.packContent
          )} ${safeText(
            item.baseUnit
          )}`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    page.drawText(quantityText, {
      x: columns.quantity,
      y: y - 20,
      font: regular,
      size: 7,
      color: black,
      maxWidth: 65,
    });

    page.drawText(
      formatMoney(
        item.netUnitPriceCents
      ),
      {
        x: columns.unitPrice,
        y: y - 20,
        font: regular,
        size: 7,
        color: black,
      }
    );

    page.drawText(
      formatMoney(item.netTotalCents),
      {
        x: columns.total,
        y: y - 20,
        font: bold,
        size: 7,
        color: greenDark,
      }
    );

    y -= rowHeight;
  }

  if (y < 110) {
    addPage(true);
  }

  y -= 18;

  page.drawRectangle({
    x: 360,
    y: y - 48,
    width: A4_WIDTH - MARGIN - 360,
    height: 48,
    color: greenSoft,
    borderColor: green,
    borderWidth: 0.8,
  });

  page.drawText(
    "Gesamtsumme netto",
    {
      x: 374,
      y: y - 17,
      font: regular,
      size: 8,
      color: gray,
    }
  );

  page.drawText(
    formatMoney(input.netTotalCents),
    {
      x: 374,
      y: y - 36,
      font: bold,
      size: 14,
      color: greenDark,
    }
  );

  const pages = pdf.getPages();

  pages.forEach(
    (currentPage, index) => {
      currentPage.drawLine({
        start: {
          x: MARGIN,
          y: 32,
        },
        end: {
          x: A4_WIDTH - MARGIN,
          y: 32,
        },
        color: lightGray,
        thickness: 0.7,
      });

      currentPage.drawText(
        `Gastario · Seite ${index + 1} von ${pages.length}`,
        {
          x: MARGIN,
          y: 18,
          font: regular,
          size: 7,
          color: gray,
        }
      );
    }
  );

  pdf.setTitle(
    `Einkaufsbestellung ${safeText(
      input.supplierName
    )}`
  );

  pdf.setSubject(
    "Lieferantenbestellung aus Gastario"
  );

  pdf.setCreator("Gastario");

  return Buffer.from(
    await pdf.save()
  );
}