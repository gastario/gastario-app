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
const CONTENT_WIDTH =
  A4_WIDTH - MARGIN * 2;

function safeText(
  value: unknown
) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[„“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/…/g, "...")
    .replace(
      /[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g,
      ""
    )
    .trim();
}

function formatDate(
  value:
    | Date
    | string
    | null
    | undefined
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return date.toLocaleDateString(
    "de-DE",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  );
}

function wrapText(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number
) {
  const paragraphs =
    safeText(text)
      .split("\n")
      .map((line) =>
        line.trim()
      );

  const result: string[] = [];

  for (
    const paragraph of paragraphs
  ) {
    if (!paragraph) {
      result.push("");
      continue;
    }

    const words =
      paragraph.split(/\s+/);

    let line = "";

    for (
      const word of words
    ) {
      const candidate =
        line
          ? `${line} ${word}`
          : word;

      const width =
        font.widthOfTextAtSize(
          candidate,
          size
        );

      if (
        width <= maxWidth
      ) {
        line = candidate;
        continue;
      }

      if (line) {
        result.push(line);
        line = "";
      }

      if (
        font.widthOfTextAtSize(
          word,
          size
        ) <= maxWidth
      ) {
        line = word;
        continue;
      }

      let part = "";

      for (
        const character of word
      ) {
        const next =
          part + character;

        if (
          font.widthOfTextAtSize(
            next,
            size
          ) > maxWidth &&
          part
        ) {
          result.push(part);
          part = character;
        }
        else {
          part = next;
        }
      }

      line = part;
    }

    if (line) {
      result.push(line);
    }
  }

  return result.length > 0
    ? result
    : [""];
}

export async function renderDeliveryNotePdf(
  input: DeliveryNoteInput
) {
  const pdf =
    await PDFDocument.create();

  const regular =
    await pdf.embedFont(
      StandardFonts.Helvetica
    );

  const bold =
    await pdf.embedFont(
      StandardFonts.HelveticaBold
    );

  /*
   * Gastario Dokumentfarben.
   * PDF/Print ist bewusst vom normalen
   * App-UI-Vertrag ausgenommen.
   */
  const green =
    rgb(
      0.11,
      0.42,
      0.31
    );

  const greenSoft =
    rgb(
      0.94,
      0.975,
      0.96
    );

  const greenBorder =
    rgb(
      0.76,
      0.86,
      0.81
    );

  const dark =
    rgb(
      0.10,
      0.12,
      0.11
    );

  const muted =
    rgb(
      0.42,
      0.45,
      0.43
    );

  const border =
    rgb(
      0.88,
      0.89,
      0.88
    );

  const soft =
    rgb(
      0.975,
      0.978,
      0.975
    );

  const white =
    rgb(
      1,
      1,
      1
    );

  let page: PDFPage;
  let y = 0;

  function drawWrappedText(
    text: string,
    options: {
      x: number;
      y: number;
      width: number;
      size?: number;
      lineHeight?: number;
      font?: PDFFont;
      color?: ReturnType<
        typeof rgb
      >;
    }
  ) {
    const size =
      options.size ?? 9;

    const lineHeight =
      options.lineHeight ??
      size + 3;

    const font =
      options.font ??
      regular;

    const color =
      options.color ??
      dark;

    const lines =
      wrapText(
        font,
        text,
        size,
        options.width
      );

    let currentY =
      options.y;

    for (
      const line of lines
    ) {
      if (line) {
        page.drawText(
          line,
          {
            x: options.x,
            y: currentY,
            size,
            font,
            color,
          }
        );
      }

      currentY -=
        lineHeight;
    }

    return currentY;
  }

  function drawPageHeader(
    continuation = false
  ) {
    page.drawRectangle({
      x: 0,
      y:
        A4_HEIGHT -
        6,
      width:
        A4_WIDTH,
      height: 6,
      color: green,
    });

    page.drawText(
      safeText(
        input.tenantName
      ) || "Gastario",
      {
        x: MARGIN,
        y:
          A4_HEIGHT -
          47,
        size: 11,
        font: bold,
        color: dark,
      }
    );

    page.drawText(
      continuation
        ? "LIEFERSCHEIN · FORTSETZUNG"
        : "LIEFERSCHEIN",
      {
        x: MARGIN,
        y:
          A4_HEIGHT -
          88,
        size:
          continuation
            ? 18
            : 27,
        font: bold,
        color: dark,
      }
    );

    page.drawText(
      safeText(
        input.number
      ),
      {
        x:
          A4_WIDTH -
          MARGIN -
          150,
        y:
          A4_HEIGHT -
          48,
        size: 10,
        font: bold,
        color: green,
      }
    );

    page.drawText(
      `Auftrag ${safeText(
        input.orderNumber
      )}`,
      {
        x:
          A4_WIDTH -
          MARGIN -
          150,
        y:
          A4_HEIGHT -
          65,
        size: 8.5,
        font: regular,
        color: muted,
      }
    );

    page.drawLine({
      start: {
        x: MARGIN,
        y:
          A4_HEIGHT -
          108,
      },
      end: {
        x:
          A4_WIDTH -
          MARGIN,
        y:
          A4_HEIGHT -
          108,
      },
      thickness: 0.7,
      color: border,
    });

    y =
      A4_HEIGHT -
      132;
  }

  function addPage(
    continuation = false
  ) {
    page =
      pdf.addPage([
        A4_WIDTH,
        A4_HEIGHT,
      ]);

    drawPageHeader(
      continuation
    );
  }

  function ensureSpace(
    needed: number
  ) {
    if (
      y - needed <
      78
    ) {
      addPage(true);
      return true;
    }

    return false;
  }

  function drawSectionLabel(
    label: string
  ) {
    page.drawText(
      safeText(label)
        .toUpperCase(),
      {
        x: MARGIN,
        y,
        size: 8,
        font: bold,
        color: green,
      }
    );

    y -= 18;
  }

  function drawInfoCard(params: {
    x: number;
    top: number;
    width: number;
    height: number;
    label: string;
    title: string;
    lines: string[];
  }) {
    const bottom =
      params.top -
      params.height;

    page.drawRectangle({
      x: params.x,
      y: bottom,
      width:
        params.width,
      height:
        params.height,
      color: soft,
      borderColor:
        border,
      borderWidth: 0.7,
    });

    page.drawText(
      params.label
        .toUpperCase(),
      {
        x:
          params.x + 14,
        y:
          params.top - 21,
        size: 7.5,
        font: bold,
        color: green,
      }
    );

    let cardY =
      params.top - 42;

    cardY =
      drawWrappedText(
        params.title,
        {
          x:
            params.x + 14,
          y: cardY,
          width:
            params.width -
            28,
          size: 11,
          lineHeight: 14,
          font: bold,
          color: dark,
        }
      );

    cardY -= 3;

    for (
      const value of params.lines
    ) {
      if (
        !safeText(value)
      ) {
        continue;
      }

      cardY =
        drawWrappedText(
          value,
          {
            x:
              params.x +
              14,
            y: cardY,
            width:
              params.width -
              28,
            size: 8.5,
            lineHeight: 11,
            color: muted,
          }
        );
    }
  }

  function drawTableHeader() {
    const top = y;

    page.drawRectangle({
      x: MARGIN,
      y: top - 24,
      width:
        CONTENT_WIDTH,
      height: 24,
      color:
        greenSoft,
    });

    page.drawText(
      "POS.",
      {
        x:
          MARGIN + 10,
        y:
          top - 16,
        size: 7.5,
        font: bold,
        color: green,
      }
    );

    page.drawText(
      "MENGE",
      {
        x:
          MARGIN + 48,
        y:
          top - 16,
        size: 7.5,
        font: bold,
        color: green,
      }
    );

    page.drawText(
      "EINHEIT",
      {
        x:
          MARGIN + 104,
        y:
          top - 16,
        size: 7.5,
        font: bold,
        color: green,
      }
    );

    page.drawText(
      "ARTIKEL / BESCHREIBUNG",
      {
        x:
          MARGIN + 170,
        y:
          top - 16,
        size: 7.5,
        font: bold,
        color: green,
      }
    );

    y -= 31;
  }

  function drawItemsHeading() {
    drawSectionLabel(
      "Positionen"
    );

    drawTableHeader();
  }


  // ---------------------------------------------------------
  // Dokument starten
  // ---------------------------------------------------------

  addPage(false);


  // ---------------------------------------------------------
  // Info-Karten
  // ---------------------------------------------------------

  const cardsTop = y;

  const cardGap = 12;

  const cardWidth =
    (
      CONTENT_WIDTH -
      cardGap
    ) / 2;

  const deliveryAddress =
    safeText(
      input.deliveryAddress
    );

  const addressLines =
    deliveryAddress
      ? deliveryAddress
          .split("\n")
          .filter(Boolean)
      : [
          "Keine Lieferadresse hinterlegt",
        ];

  drawInfoCard({
    x: MARGIN,
    top: cardsTop,
    width: cardWidth,
    height: 116,
    label:
      "Lieferung an",
    title:
      safeText(
        input.customerName
      ) ||
      "Ohne Kunde",
    lines:
      addressLines,
  });

  const dateText =
    formatDate(
      input.deliveryDate
    );

  const timeText =
    safeText(
      input.deliveryTimeText
    );

  const contactName =
    safeText(
      input.contactName
    );

  const contactPhone =
    safeText(
      input.contactPhone
    );

  drawInfoCard({
    x:
      MARGIN +
      cardWidth +
      cardGap,
    top: cardsTop,
    width: cardWidth,
    height: 116,
    label:
      "Termin & Kontakt",
    title:
      timeText
        ? `${dateText} · ${timeText} Uhr`
        : dateText,
    lines: [
      contactName
        ? `Ansprechpartner: ${contactName}`
        : "Kein Ansprechpartner hinterlegt",
      contactPhone
        ? `Telefon: ${contactPhone}`
        : "Keine Telefonnummer hinterlegt",
    ],
  });

  y =
    cardsTop -
    140;


  // ---------------------------------------------------------
  // Positionen
  // ---------------------------------------------------------

  drawItemsHeading();

  const items =
    Array.isArray(
      input.items
    )
      ? input.items
      : [];

  if (
    items.length === 0
  ) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 42,
      width:
        CONTENT_WIDTH,
      height: 42,
      color: soft,
      borderColor:
        border,
      borderWidth: 0.7,
    });

    page.drawText(
      "Keine Positionen vorhanden.",
      {
        x:
          MARGIN + 12,
        y:
          y - 25,
        size: 9,
        font: regular,
        color: muted,
      }
    );

    y -= 54;
  }
  else {
    for (
      let index = 0;
      index <
      items.length;
      index++
    ) {
      const item =
        items[index];

      const nameLines =
        wrapText(
          bold,
          safeText(
            item.name
          ) ||
            "Position",
          9,
          CONTENT_WIDTH -
            190
        );

      const noteText =
        safeText(
          item.notes
        );

      const noteLines =
        noteText
          ? wrapText(
              regular,
              noteText,
              7.5,
              CONTENT_WIDTH -
                190
            )
          : [];

      const contentLines =
        nameLines.length +
        noteLines.length;

      const rowHeight =
        Math.max(
          36,
          16 +
            contentLines *
              11
        );

      if (
        y -
          rowHeight <
        78
      ) {
        addPage(true);
        drawItemsHeading();
      }

      if (
        index % 2 === 1
      ) {
        page.drawRectangle({
          x: MARGIN,
          y:
            y -
            rowHeight,
          width:
            CONTENT_WIDTH,
          height:
            rowHeight,
          color:
            rgb(
              0.992,
              0.993,
              0.992
            ),
        });
      }

      page.drawText(
        String(
          index + 1
        ),
        {
          x:
            MARGIN + 10,
          y:
            y - 19,
          size: 8.5,
          font: regular,
          color: muted,
        }
      );

      page.drawText(
        safeText(
          item.quantity
        ) || "0",
        {
          x:
            MARGIN + 48,
          y:
            y - 19,
          size: 9,
          font: bold,
          color: dark,
        }
      );

      page.drawText(
        safeText(
          item.unit
        ) ||
          "Stück",
        {
          x:
            MARGIN + 104,
          y:
            y - 19,
          size: 8.5,
          font: regular,
          color: muted,
        }
      );

      let textY =
        y - 17;

      textY =
        drawWrappedText(
          safeText(
            item.name
          ) ||
            "Position",
          {
            x:
              MARGIN +
              170,
            y: textY,
            width:
              CONTENT_WIDTH -
              182,
            size: 9,
            lineHeight: 11,
            font: bold,
            color: dark,
          }
        );

      if (noteText) {
        textY -= 1;

        drawWrappedText(
          noteText,
          {
            x:
              MARGIN +
              170,
            y: textY,
            width:
              CONTENT_WIDTH -
              182,
            size: 7.5,
            lineHeight: 10,
            color: muted,
          }
        );
      }

      page.drawLine({
        start: {
          x: MARGIN,
          y:
            y -
            rowHeight,
        },
        end: {
          x:
            A4_WIDTH -
            MARGIN,
          y:
            y -
            rowHeight,
        },
        thickness: 0.45,
        color: border,
      });

      y -=
        rowHeight;
    }
  }


  // ---------------------------------------------------------
  // Auftragshinweise
  // ---------------------------------------------------------

  const notes =
    safeText(
      input.notes
    );

  if (notes) {
    const noteLines =
      wrapText(
        regular,
        notes,
        8.5,
        CONTENT_WIDTH -
          28
      );

    const noteHeight =
      Math.max(
        64,
        38 +
          noteLines.length *
            11
      );

    ensureSpace(
      noteHeight + 30
    );

    y -= 18;

    drawSectionLabel(
      "Hinweise"
    );

    page.drawRectangle({
      x: MARGIN,
      y:
        y -
        noteHeight,
      width:
        CONTENT_WIDTH,
      height:
        noteHeight,
      color:
        greenSoft,
      borderColor:
        greenBorder,
      borderWidth: 0.7,
    });

    page.drawText(
      "Hinweise zum Auftrag",
      {
        x:
          MARGIN + 14,
        y:
          y - 21,
        size: 9,
        font: bold,
        color: green,
      }
    );

    drawWrappedText(
      notes,
      {
        x:
          MARGIN + 14,
        y:
          y - 39,
        width:
          CONTENT_WIDTH -
          28,
        size: 8.5,
        lineHeight: 11,
        color: dark,
      }
    );

    y -=
      noteHeight +
      8;
  }


  // ---------------------------------------------------------
  // Übergabebereich
  // ---------------------------------------------------------

  ensureSpace(135);

  y -= 22;

  drawSectionLabel(
    "Übergabe"
  );

  page.drawRectangle({
    x: MARGIN,
    y: y - 94,
    width:
      CONTENT_WIDTH,
    height: 94,
    color: white,
    borderColor:
      border,
    borderWidth: 0.7,
  });

  page.drawText(
    "Die oben aufgeführten Positionen wurden vollständig übergeben.",
    {
      x:
        MARGIN + 14,
      y:
        y - 22,
      size: 8.5,
      font: regular,
      color: muted,
    }
  );

  const signatureY =
    y - 67;

  const signatureWidth =
    (
      CONTENT_WIDTH -
      42
    ) / 2;

  page.drawLine({
    start: {
      x:
        MARGIN + 14,
      y:
        signatureY,
    },
    end: {
      x:
        MARGIN +
        14 +
        signatureWidth,
      y:
        signatureY,
    },
    thickness: 0.7,
    color: muted,
  });

  page.drawLine({
    start: {
      x:
        MARGIN +
        28 +
        signatureWidth,
      y:
        signatureY,
    },
    end: {
      x:
        A4_WIDTH -
        MARGIN -
        14,
      y:
        signatureY,
    },
    thickness: 0.7,
    color: muted,
  });

  page.drawText(
    "Übergeben durch · Datum / Unterschrift",
    {
      x:
        MARGIN + 14,
      y:
        signatureY - 15,
      size: 7,
      font: regular,
      color: muted,
    }
  );

  page.drawText(
    "Empfangen von · Datum / Unterschrift",
    {
      x:
        MARGIN +
        28 +
        signatureWidth,
      y:
        signatureY - 15,
      size: 7,
      font: regular,
      color: muted,
    }
  );


  // ---------------------------------------------------------
  // Footer + Seitenzahlen
  // ---------------------------------------------------------

  const pages =
    pdf.getPages();

  pages.forEach(
    (
      currentPage,
      index
    ) => {
      currentPage.drawLine({
        start: {
          x: MARGIN,
          y: 48,
        },
        end: {
          x:
            A4_WIDTH -
            MARGIN,
          y: 48,
        },
        thickness: 0.5,
        color: border,
      });

      currentPage.drawText(
        safeText(
          input.tenantName
        ) || "Gastario",
        {
          x: MARGIN,
          y: 30,
          size: 7,
          font: regular,
          color: muted,
        }
      );

      const footerText =
        `Lieferschein ${safeText(
          input.number
        )}`;

      currentPage.drawText(
        footerText,
        {
          x:
            A4_WIDTH /
              2 -
            regular.widthOfTextAtSize(
              footerText,
              7
            ) /
              2,
          y: 30,
          size: 7,
          font: regular,
          color: muted,
        }
      );

      const pageText =
        `Seite ${
          index + 1
        } / ${
          pages.length
        }`;

      currentPage.drawText(
        pageText,
        {
          x:
            A4_WIDTH -
            MARGIN -
            regular.widthOfTextAtSize(
              pageText,
              7
            ),
          y: 30,
          size: 7,
          font: regular,
          color: muted,
        }
      );
    }
  );


  // ---------------------------------------------------------
  // PDF-Metadaten
  // ---------------------------------------------------------

  pdf.setTitle(
    `Lieferschein ${safeText(
      input.number
    )}`
  );

  pdf.setSubject(
    `Lieferschein zu Auftrag ${safeText(
      input.orderNumber
    )}`
  );

  pdf.setAuthor(
    safeText(
      input.tenantName
    ) || "Gastario"
  );

  pdf.setCreator(
    "Gastario"
  );

  pdf.setProducer(
    "Gastario"
  );

  return Buffer.from(
    await pdf.save()
  );
}