const fs = require("fs");
const path = require("path");

const routesDir = path.join(process.cwd(), "app", "routes");

function write(name, content) {
  fs.writeFileSync(path.join(routesDir, name), content, "utf8");
  console.log("geschrieben:", name);
}

write("gastario-control.tsx", String.raw`
import { Link, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

  const tenantCount = await prisma.tenant.count().catch(() => 0);
  const orderCount = await prisma.order.count().catch(() => 0);
  const userCount = await prisma.user.count().catch(() => 0);
  const inviteCount = await prisma.registrationInvite.count().catch(() => 0);

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
  }).catch(() => []);

  return { tenantCount, orderCount, userCount, inviteCount, tenants };
}

export default function GastarioControl() {
  const data = useLoaderData<typeof loader>();

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Control Center</h1>
          <p className="pageSubtitle">
            Zentrale Übersicht für Mandanten, Pakete, Module und Registrierungscodes.
          </p>
        </div>

        <div className="topActions">
          <Link className="btn" to="/gastario-control/codes">Codes öffnen</Link>
          <Link className="btn btnPrimary" to="/gastario-control/mandanten">Mandanten verwalten</Link>
        </div>
      </header>

      <section className="statGrid">
        <article className="statCard">
          <div className="statLabel">Mandanten</div>
          <div className="statValue">{data.tenantCount}</div>
          <div className="statHint">gesamt</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Aufträge</div>
          <div className="statValue">{data.orderCount}</div>
          <div className="statHint">im System</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Benutzer</div>
          <div className="statValue">{data.userCount}</div>
          <div className="statHint">registriert</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Codes</div>
          <div className="statValue">{data.inviteCount}</div>
          <div className="statHint">Einladungen</div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Mandanten</div>
            <h2 className="panelTitle">Neueste Mandanten</h2>
          </div>
          <Link className="btn" to="/gastario-control/mandanten">Alle anzeigen</Link>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Firma</th>
                <th>Paket</th>
                <th>Status</th>
                <th>Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {data.tenants.length === 0 ? (
                <tr>
                  <td colSpan={4}>Noch keine Mandanten vorhanden.</td>
                </tr>
              ) : (
                data.tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="tenantName">
                      <Link to={"/gastario-control/mandanten/" + tenant.id} style={{ color: "inherit", textDecoration: "none" }}>
                        {tenant.name}
                      </Link>
                    </td>
                    <td>{tenant.planCode}</td>
                    <td>{tenant.lockedAt ? "Gesperrt" : tenant.subscriptionStatus}</td>
                    <td>{new Date(tenant.createdAt).toLocaleDateString("de-DE")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </SuperAdminLayout>
  );
}
`);

write("gastario-control.features.tsx", String.raw`
import SuperAdminLayout from "../components/SuperAdminLayout";

const features = [
  ["DASHBOARD", "Dashboard", "Basis"],
  ["ORDERS", "Aufträge", "Basis"],
  ["CUSTOMERS", "Kunden", "Basis"],
  ["PRODUCTS", "Produkte", "Basis"],
  ["QUOTES", "Angebote", "Basis"],
  ["PRODUCTION", "Produktion", "Betrieb"],
  ["PACKING_LISTS", "Packlisten", "Betrieb"],
  ["DELIVERY_NOTES", "Lieferscheine", "Betrieb"],
  ["DELIVERIES", "Lieferungen", "Betrieb"],
  ["INCOMING_ORDERS", "Auftragseingang", "Automatisierung"],
  ["PDF_EXTRACTION", "PDF-Erkennung", "Automatisierung"],
  ["EMAIL_AUTOMATION", "E-Mail-Automatik", "Automatisierung"],
  ["PURCHASING", "Einkauf", "Warenwirtschaft"],
  ["INVENTORY", "Lager", "Warenwirtschaft"],
  ["SUPPLIERS", "Lieferanten", "Warenwirtschaft"],
  ["RECIPES", "Rezepte", "Warenwirtschaft"],
  ["REPORTS", "Auswertungen", "Auswertung"],
  ["MULTI_USER", "Mehrere Benutzer", "Premium"],
  ["DRIVER_VIEW", "Fahreransicht", "Premium"],
  ["PRODUCT_MAPPING", "Produkt-Mapping", "Premium"],
  ["INTEGRATIONS", "Integrationen", "Premium"],
];

export default function FeaturesPage() {
  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Features</h1>
          <p className="pageSubtitle">
            Übersicht aller Module, die pro Mandant freigeschaltet werden können.
          </p>
        </div>
      </header>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Module</div>
            <h2 className="panelTitle">Feature-Codes</h2>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Modul</th>
                <th>Gruppe</th>
              </tr>
            </thead>
            <tbody>
              {features.map(([code, label, group]) => (
                <tr key={code}>
                  <td style={{ fontFamily: "monospace", fontWeight: 950, color: "#0f766e" }}>{code}</td>
                  <td className="tenantName">{label}</td>
                  <td>{group}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </SuperAdminLayout>
  );
}
`);

write("gastario-control.pakete.tsx", String.raw`
import { Link } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

const packages = [
  {
    name: "Starter",
    price: "59 €",
    text: "Für kleine Caterer, die Aufträge und Kunden sauber verwalten wollen.",
    limits: ["1 Marke", "1 Import-E-Mail", "1 Benutzer"],
    modules: ["Aufträge", "Kunden", "Produkte", "Packlisten", "Lieferscheine"],
  },
  {
    name: "Professional",
    price: "179 €",
    text: "Für wachsende Caterer mit mehreren Marken, E-Mail-Eingang und operativer Planung.",
    limits: ["bis 3 Marken", "bis 3 Import-E-Mails", "bis 5 Benutzer"],
    modules: ["Auftragseingang", "PDF-Erkennung", "E-Mail-Automatik", "Einkauf", "Lager", "Lieferanten", "Rezepte", "Auswertungen"],
  },
  {
    name: "Premium",
    price: "299 €",
    text: "Für größere Caterer mit mehreren Marken, Integrationen und erweiterten Workflows.",
    limits: ["unbegrenzt", "unbegrenzt", "unbegrenzt"],
    modules: ["alle Module", "Fahreransicht", "Integrationen", "Lexware / DATEV / API später", "priorisierter Support"],
  },
];

export default function PaketePage() {
  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Pakete</h1>
          <p className="pageSubtitle">
            Verwalte die Paketlogik für Gastario. Die Paketzuweisung erfolgt pro Mandant in der Mandantenverwaltung.
          </p>
        </div>

        <div className="topActions">
          <Link className="btn btnPrimary" to="/gastario-control/mandanten">
            Mandanten verwalten
          </Link>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
        {packages.map((pkg) => (
          <article className="panel" key={pkg.name}>
            <div className="panelKicker">{pkg.name}</div>
            <h2 className="panelTitle">{pkg.name}</h2>
            <div style={{ fontSize: 34, fontWeight: 950, marginTop: 16 }}>
              {pkg.price} <span style={{ fontSize: 14, color: "#64748b" }}>/ Monat</span>
            </div>
            <p style={{ color: "#64748b", fontWeight: 750, lineHeight: 1.5 }}>{pkg.text}</p>

            <div style={{ border: "1px solid #dbe5ee", borderRadius: 18, padding: 16, marginTop: 20 }}>
              <strong>Limits</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {pkg.limits.map((item) => <div key={item}>{item}</div>)}
              </div>
            </div>

            <h3 style={{ marginTop: 20 }}>Enthaltene Module</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {pkg.modules.map((item) => (
                <span className="badge" key={item}>{item}</span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panelKicker">Hinweis</div>
        <h2 className="panelTitle">Pakete werden nicht öffentlich ausgewählt</h2>
        <p style={{ color: "#334155", fontWeight: 750, lineHeight: 1.6 }}>
          Neue Caterer registrieren sich nur mit Einladungscode. Das Paket wird danach durch den Super Admin beim Mandanten gesetzt.
        </p>
      </section>
    </SuperAdminLayout>
  );
}
`);

write("gastario-control.codes.tsx", String.raw`
import { Form, useActionData, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return "GASTARIO-" + part() + "-" + part() + "-" + part();
}

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

  const codes = await prisma.registrationInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  }).catch(() => []);

  return { codes };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "create") {
    const code = generateInviteCode();

    await prisma.registrationInvite.create({
      data: {
        code,
      },
    });

    return { success: "Code wurde erstellt.", code };
  }

  const inviteId = String(formData.get("inviteId") || "");

  if (intent === "delete" && inviteId) {
    await prisma.registrationInvite.delete({ where: { id: inviteId } });
    return { success: "Code wurde gelöscht." };
  }

  return { error: "Unbekannte Aktion." };
}

export default function CodesPage() {
  const { codes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Registrierungscodes</h1>
          <p className="pageSubtitle">
            Erstelle Einladungscodes für neue Caterer. Ohne Code gibt es keine Registrierung.
          </p>
        </div>
      </header>

      {actionData?.success ? (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: 16, borderRadius: 16, fontWeight: 900, marginBottom: 16 }}>
          {actionData.success}
          {actionData.code ? <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 18 }}>{actionData.code}</div> : null}
        </div>
      ) : null}

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Neuer Zugang</div>
            <h2 className="panelTitle">Code erstellen</h2>
          </div>
        </div>

        <Form method="post">
          <input type="hidden" name="intent" value="create" />
          <button className="btn btnPrimary" type="submit">Neuen Code erstellen</button>
        </Form>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Codes</div>
            <h2 className="panelTitle">Alle Codes</h2>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Status</th>
                <th>Erstellt</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={4}>Noch keine Codes erstellt.</td>
                </tr>
              ) : (
                codes.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontFamily: "monospace", fontWeight: 950 }}>{item.code}</td>
                    <td>
                      <span className={item.usedAt ? "badge badgeLocked" : "badge"}>
                        {item.usedAt ? "Benutzt" : "Offen"}
                      </span>
                    </td>
                    <td>{new Date(item.createdAt).toLocaleString("de-DE")}</td>
                    <td>
                      <Form method="post">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="inviteId" value={item.id} />
                        <button className="btn" type="submit" style={{ color: "#b91c1c" }}>Löschen</button>
                      </Form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </SuperAdminLayout>
  );
}
`);

console.log("Super Admin Routen repariert.");
