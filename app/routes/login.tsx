import { Form, Link, useActionData } from "react-router";
import { prisma } from "../lib/db.server";
import { createUserSession, verifyPassword } from "../lib/auth.server";

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

  if (!user?.passwordHash) {
    return { error: "Login-Daten sind falsch." };
  }

  const validPassword = await verifyPassword(password, user.passwordHash);

  if (!validPassword) {
    return { error: "Login-Daten sind falsch." };
  }

  return createUserSession(user.id, "/auftragseingang");
}

export function meta() {
  return [{ title: "Login · Gastario" }];
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();

  return (
    <main className="authShell">
      <section className="authCard small">
        <div className="authIntro">
          <strong>Gastario</strong>
          <h1>Einloggen</h1>
          <p>Melde dich an, um Aufträge, Marken, E-Mails und Module zu verwalten.</p>
        </div>

        {actionData?.error ? <div className="authError">{actionData.error}</div> : null}

        <Form method="post" className="authForm">
          <label>
            E-Mail
            <input name="email" type="email" placeholder="name@firma.de" required />
          </label>

          <label>
            Passwort
            <input name="password" type="password" required />
          </label>

          <button className="primaryButton" type="submit">Einloggen</button>
        </Form>

        <p className="authSwitch">
          Noch kein Account? <Link to="/registrieren">Account erstellen</Link>
        </p>
      </section>
    </main>
  );
}
