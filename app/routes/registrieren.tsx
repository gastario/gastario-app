import bcrypt from "bcryptjs";
import { Form, Link, redirect, useActionData } from "react-router";
import { prisma } from "../lib/prisma.server";
import { createUserSession } from "../lib/session.server";

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const companyName = String(formData.get("companyName") || "").trim();
  const brandName = String(formData.get("brandName") || "").trim();
  const importEmail = String(formData.get("importEmail") || "").trim().toLowerCase();
  const registrationCode = String(formData.get("registrationCode") || "").trim();

  if (!name || !email || !password || !companyName || !brandName || !importEmail || !registrationCode) {
    return { error: "Bitte alle Pflichtfelder ausfüllen." };
  }

  if (password.length < 8) {
    return { error: "Das Passwort muss mindestens 8 Zeichen haben." };
  }

  const invite = await prisma.registrationInvite.findUnique({
    where: { code: registrationCode },
  });

  if (!invite || invite.usedAt) {
    return { error: "Der Zugangscode ist ungültig oder wurde bereits benutzt." };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: "Diese E-Mail-Adresse ist bereits registriert." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

    const tenant = await tx.tenant.create({
      data: {
        name: companyName,
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
      },
    });

    await tx.emailAccount.create({
      data: {
        tenantId: tenant.id,
        brandId: brand.id,
        email: importEmail,
      },
    });

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
          background: linear-gradient(135deg, #eef8f7 0%, #f8fafc 45%, #ffffff 100%);
          padding: 32px;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #0f172a;
        }

        .card {
          width: 100%;
          max-width: 760px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          padding: 28px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.11);
        }

        .brand {
          color: #0f766e;
          font-size: 22px;
          font-weight: 900;
          margin-bottom: 10px;
        }

        h1 {
          margin: 0 0 8px;
          font-size: 38px;
          letter-spacing: -0.04em;
        }

        .subtitle {
          margin: 0 0 24px;
          color: #334155;
          font-weight: 650;
          line-height: 1.45;
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
          font-weight: 850;
          color: #0f172a;
        }

        input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          border-radius: 12px;
          padding: 13px 14px;
          font-size: 15px;
          outline: none;
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
          border-radius: 14px;
          padding: 13px 15px;
          font-weight: 700;
          line-height: 1.35;
        }

        .error {
          grid-column: 1 / -1;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          border-radius: 14px;
          padding: 13px 15px;
          font-weight: 800;
        }

        button {
          grid-column: 1 / -1;
          border: none;
          border-radius: 999px;
          background: #0f766e;
          color: white;
          padding: 15px 18px;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(15, 118, 110, 0.25);
        }

        .login {
          grid-column: 1 / -1;
          margin-top: 4px;
          font-size: 14px;
          color: #334155;
          font-weight: 650;
        }

        .login a {
          color: #0f766e;
          font-weight: 900;
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
          Lege deinen Caterer-Account an. Die Registrierung ist nur mit Einladungscode möglich.
          Das Paket wird später im Gastario-Control-Bereich freigeschaltet.
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
            E-Mail für Auftragseingang
            <input name="importEmail" type="email" placeholder="bestellung@firma.de" required />
          </label>

          <label className="full">
            Zugangscode
            <input name="registrationCode" type="text" placeholder="GASTARIO-XXXX-XXXX-XXXX" required />
          </label>

          <div className="infoBox">
            Jeder Einladungscode kann nur einmal benutzt werden. Neue Codes erstellst du im Super Admin.
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
