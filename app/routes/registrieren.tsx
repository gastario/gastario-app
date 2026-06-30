import bcrypt from "bcryptjs";
import { Form, Link, useActionData } from "react-router";
import { createUserSession } from "../lib/session.server";

const STARTER_FEATURES = [
  "DASHBOARD",
  "ORDERS",
  "CUSTOMERS",
  "PRODUCTS",
  "PACKING_LISTS",
  "DELIVERY_NOTES",
];

function makeSlug(name: string) {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "mandant";

  return `${base}-${Date.now().toString(36)}`;
}

function isInviteExpired(expiresAt: Date | null) {
  if (!expiresAt) return false;
  return expiresAt.getTime() < Date.now();
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");

  const formData = await request.formData();

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const companyName = String(formData.get("companyName") || "").trim();
  const brandName = String(formData.get("brandName") || "").trim();
  const importEmail = String(formData.get("importEmail") || "").trim().toLowerCase();
  const registrationCode = String(formData.get("registrationCode") || "").trim().toUpperCase();

  if (!name || !email || !password || !companyName || !brandName || !importEmail || !registrationCode) {
    return { error: "Bitte alle Pflichtfelder ausfuellen." };
  }

  if (!email.includes("@")) {
    return { error: "Bitte eine gueltige Login-E-Mail eingeben." };
  }

  if (!importEmail.includes("@")) {
    return { error: "Bitte eine gueltige Auftragseingang-E-Mail eingeben." };
  }

  if (password.length < 8) {
    return { error: "Das Passwort muss mindestens 8 Zeichen haben." };
  }

  const invite = await prisma.registrationInvite.findUnique({
    where: { code: registrationCode },
  });

  if (!invite) {
    return { error: "Der Zugangscode ist ungueltig." };
  }

  if (invite.usedAt) {
    return { error: "Der Zugangscode wurde bereits benutzt oder deaktiviert." };
  }

  if (isInviteExpired(invite.expiresAt)) {
    return { error: "Der Zugangscode ist abgelaufen." };
  }

  if (invite.email && invite.email.toLowerCase() !== email) {
    return { error: "Dieser Zugangscode ist fuer eine andere E-Mail-Adresse vorgesehen." };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: "Diese E-Mail-Adresse ist bereits registriert." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const slug = makeSlug(companyName);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        platformRole: "USER",
      },
    });

    const tenant = await tx.tenant.create({
      data: {
        name: companyName,
        slug,
        planCode: "STARTER",
        subscriptionStatus: "TRIAL",
        maxBrands: 1,
        maxEmailAccounts: 1,
        maxUsers: 1,
      },
    });

    await tx.tenantUser.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: "OWNER",
      },
    });

    const brand = await tx.brand.create({
      data: {
        tenantId: tenant.id,
        name: brandName,
        email: importEmail,
        active: true,
      },
    });

    await tx.emailAccount.create({
      data: {
        tenantId: tenant.id,
        brandId: brand.id,
        email: importEmail,
        label: brandName,
        active: true,
        provider: "IMAP",
        mode: "FORWARDING",
      },
    });

    await Promise.all(
      STARTER_FEATURES.map((feature) =>
        tx.tenantFeature.create({
          data: {
            tenantId: tenant.id,
            feature: feature as any,
            enabled: true,
          },
        })
      )
    );

    await tx.registrationInvite.update({
      where: { code: registrationCode },
      data: {
        usedAt: new Date(),
        usedBy: email,
      },
    });

    return { user, tenant };
  });

  return createUserSession(result.user.id, "/auftragseingang");
}

export default function Registrieren() {
  const actionData = useActionData<typeof action>();

  return (
    <main className="registerPage">
      <style>{`
        .registerPage {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at top right, rgba(23, 195, 166, .20), transparent 34%),
            linear-gradient(135deg, #eef8f7 0%, #f8fafc 45%, #ffffff 100%);
          padding: 32px;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #0f172a;
        }

        .card {
          width: 100%;
          max-width: 820px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 28px;
          padding: 32px;
          box-shadow: 0 28px 80px rgba(15, 23, 42, 0.12);
        }

        .brand {
          color: #0f766e;
          font-size: 23px;
          font-weight: 950;
          margin-bottom: 10px;
          letter-spacing: -0.04em;
        }

        h1 {
          margin: 0 0 8px;
          font-size: 42px;
          letter-spacing: -0.055em;
          line-height: 1;
        }

        .subtitle {
          margin: 0 0 24px;
          color: #334155;
          font-weight: 700;
          line-height: 1.5;
        }

        form {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        label {
          display: grid;
          gap: 7px;
          font-size: 13px;
          font-weight: 900;
          color: #0f172a;
        }

        input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          border-radius: 14px;
          padding: 13px 14px;
          font-size: 15px;
          outline: none;
          font-weight: 750;
        }

        input:focus {
          border-color: #0f766e;
          box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.12);
          background: white;
        }

        .full {
          grid-column: 1 / -1;
        }

        .infoBox {
          grid-column: 1 / -1;
          background: #f0fdfa;
          border: 1px solid #99f6e4;
          color: #115e59;
          border-radius: 16px;
          padding: 14px 16px;
          font-weight: 800;
          line-height: 1.4;
        }

        .error {
          grid-column: 1 / -1;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          border-radius: 16px;
          padding: 14px 16px;
          font-weight: 900;
        }

        button {
          grid-column: 1 / -1;
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, #008f7a, #17b79f);
          color: white;
          padding: 15px 18px;
          font-size: 15px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 16px 36px rgba(15, 118, 110, 0.25);
        }

        .login {
          grid-column: 1 / -1;
          margin-top: 4px;
          font-size: 14px;
          color: #334155;
          font-weight: 700;
        }

        .login a {
          color: #0f766e;
          font-weight: 950;
        }

        @media (max-width: 720px) {
          form {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 32px;
          }
        }
      `}</style>

      <section className="card">
        <div className="brand">Gastario</div>
        <h1>Account erstellen</h1>
        <p className="subtitle">
          Lege deinen Caterer-Account an. Die Registrierung ist nur mit gueltigem Einladungscode moeglich.
          Das Paket wird im Gastario-Control-Bereich freigeschaltet.
        </p>

        <Form method="post">
          {actionData?.error ? <div className="error">{actionData.error}</div> : null}

          <label>
            Dein Name
            <input name="name" placeholder="Max Mustermann" required />
          </label>

          <label>
            Login E-Mail
            <input name="email" type="email" placeholder="name@firma.de" required />
          </label>

          <label>
            Passwort
            <input name="password" type="password" placeholder="mindestens 8 Zeichen" required />
          </label>

          <label>
            Firmenname
            <input name="companyName" placeholder="Muster Catering GmbH" required />
          </label>

          <label>
            Erste Marke
            <input name="brandName" placeholder="Muster Catering" required />
          </label>

          <label>
            E-Mail fuer Auftragseingang
            <input name="importEmail" type="email" placeholder="bestellung@firma.de" required />
          </label>

          <label className="full">
            Zugangscode
            <input name="registrationCode" type="text" placeholder="GASTARIO-XXXX-XXXX-XXXX" required />
          </label>

          <div className="infoBox">
            Jeder Einladungscode kann nur einmal benutzt werden. Codes koennen optional auf eine E-Mail beschraenkt sein und ein Ablaufdatum haben.
          </div>

          <button type="submit">Account erstellen</button>

          <div className="login">
            Schon einen Account? <Link to="/login">Einloggen</Link>
          </div>
        </Form>
      </section>
    </main>
  );
}
