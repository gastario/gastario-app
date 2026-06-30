import bcrypt from "bcryptjs";
import { Form, Link, redirect, useActionData } from "react-router";
import { prisma } from "../lib/prisma.server";
import { createUserSession } from "../lib/session.server";

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.passwordHash) {
    return { error: "E-Mail oder Passwort ist falsch." };
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);

  if (!passwordOk) {
    return { error: "E-Mail oder Passwort ist falsch." };
  }

  if (user.email === "mutluer.edis@gmail.com" || user.platformRole === "SUPER_ADMIN") {
    await prisma.user.update({
      where: { id: user.id },
      data: { platformRole: "SUPER_ADMIN" },
    });

    return createUserSession(user.id, "/gastario-control");
  }

  return createUserSession(user.id, "/auftragseingang");
}

export default function Login() {
  const actionData = useActionData<typeof action>();

  return (
    <main className="loginPage">
      <style>{`
        .loginPage {
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
          max-width: 460px;
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

        .error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          border-radius: 14px;
          padding: 13px 15px;
          font-weight: 800;
        }

        button {
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

        .register {
          margin-top: 4px;
          font-size: 14px;
          color: #334155;
          font-weight: 650;
        }

        .register a {
          color: #0f766e;
          font-weight: 900;
        }
      `}</style>

      <section className="card">
        <div className="brand">Gastario</div>
        <h1>Einloggen</h1>
        <p className="subtitle">
          Melde dich an, um AuftrÃ¤ge, Marken, E-Mails und Module zu verwalten.
        </p>

        <Form method="post">
          {actionData?.error ? <div className="error">{actionData.error}</div> : null}

          <label>
            E-Mail
            <input name="email" type="email" placeholder="name@firma.de" required />
          </label>

          <label>
            Passwort
            <input name="password" type="password" required />
          </label>

          <button type="submit">Einloggen</button>

          <div className="register">
            Noch kein Account? <Link to="/registrieren">Account erstellen</Link>
          </div>
        </Form>
      </section>
    </main>
  );
}

