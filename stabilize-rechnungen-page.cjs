const fs = require("fs");

const file = "app/routes/rechnungen.tsx";
let text = fs.readFileSync(file, "utf8");

// 1) Loader stabil machen: Prisma-Fehler abfangen
const loaderStart = text.indexOf("export async function loader");
const actionStart = text.indexOf("export async function action", loaderStart);

if (loaderStart === -1 || actionStart === -1) {
  throw new Error("Loader/Action Grenze nicht gefunden.");
}

const stableLoader = `export async function loader({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const access = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
  });

  if (!access) {
    return {
      tenantName: "Gastario",
      invoices: [],
      today: todayInput(),
      dueDate: addDaysInput(14),
      dbError: "Kein Mandant gefunden.",
      stats: { drafts: 0, issued: 0, paid: 0, cancelled: 0 },
    };
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: access.tenantId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      tenantName: access.tenant?.name || "Gastario",
      invoices,
      today: todayInput(),
      dueDate: addDaysInput(14),
      dbError: null,
      stats: {
        drafts: invoices.filter((invoice) => invoice.status === "DRAFT").length,
        issued: invoices.filter((invoice) => invoice.status === "ISSUED").length,
        paid: invoices.filter((invoice) => invoice.status === "PAID").length,
        cancelled: invoices.filter((invoice) => invoice.status === "CANCELLED").length,
      },
    };
  } catch (error: any) {
    return {
      tenantName: access.tenant?.name || "Gastario",
      invoices: [],
      today: todayInput(),
      dueDate: addDaysInput(14),
      dbError: error?.message || "Rechnungstabellen konnten nicht geladen werden.",
      stats: { drafts: 0, issued: 0, paid: 0, cancelled: 0 },
    };
  }
}

`;

text = text.slice(0, loaderStart) + stableLoader + text.slice(actionStart);

// 2) DB-Warnung im UI anzeigen
const uiNeedle = `{actionData && "success" in actionData ? <div style={successStyle}>{actionData.success}</div> : null}

      <section style={pageGridStyle}>`;

const uiReplacement = `{actionData && "success" in actionData ? <div style={successStyle}>{actionData.success}</div> : null}

      {data.dbError ? (
        <div style={errorStyle}>
          <strong>Rechnungsdatenbank ist noch nicht sauber bereit.</strong>
          <div style={{ marginTop: 8 }}>{data.dbError}</div>
        </div>
      ) : null}

      <section style={pageGridStyle}>`;

if (!text.includes("Rechnungsdatenbank ist noch nicht sauber bereit")) {
  if (!text.includes(uiNeedle)) {
    throw new Error("UI-Warnstelle nicht gefunden.");
  }

  text = text.replace(uiNeedle, uiReplacement);
}

// 3) ErrorBoundary informativer machen
text = text.replace(
`        <strong>Rechnungen konnten nicht geladen werden.</strong>
        <div style={{ marginTop: 8 }}>{error?.message || "Unbekannter Fehler"}</div>`,
`        <strong>Rechnungen konnten nicht geladen werden.</strong>
        <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
          {error?.message || String(error) || "Unbekannter Fehler"}
        </div>`
);

fs.writeFileSync(file, text, "utf8");
