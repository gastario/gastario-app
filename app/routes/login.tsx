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

  if (user.platformRole === "SUPER_ADMIN") {
    return createUserSession(user.id, "/gastario-control");
  }

  return createUserSession(user.id, "/");
}

export default function Login() {
  const actionData = useActionData<typeof action>();

  return (
    <main className="loginPage">
      <style>{`
        .loginPage,
        .loginPage * {
          box-sizing: border-box;
        }

        .loginPage {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 32px 20px;
          color: #173532;
          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          background:
            radial-gradient(circle at 12% 10%, rgba(205, 236, 229, 0.62), transparent 34%),
            radial-gradient(circle at 88% 86%, rgba(231, 242, 239, 0.78), transparent 32%),
            linear-gradient(145deg, #f5fbf9 0%, #f8fafb 48%, #ffffff 100%);
        }

        .loginCard {
          width: 100%;
          max-width: 480px;
          padding: 40px 38px 36px;
          border: 1px solid rgba(183, 208, 202, 0.72);
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.97);
          box-shadow:
            0 30px 80px rgba(31, 68, 62, 0.11),
            0 8px 24px rgba(31, 68, 62, 0.055);
          backdrop-filter: blur(18px);
        }

        .loginBrand {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 13px;
          margin: 0 0 34px;
          color: #075f4c;
          text-decoration: none;
          text-align: center;
        }

        .loginBrandIcon {
          width: 54px;
          height: 54px;
          flex: 0 0 54px;
          display: grid;
          place-items: center;
          border: 1px solid #c8e1da;
          border-radius: 18px;
          background: linear-gradient(145deg, #f5fcf9 0%, #e5f4ee 100%);
          box-shadow: 0 10px 26px rgba(13, 111, 87, 0.11);
        }

        .loginBrandIcon svg {
          display: block;
          width: 39px;
          height: 39px;
        }

        .loginBrandName {
          font-size: 27px;
          font-weight: 650;
          letter-spacing: -0.035em;
        }

        .loginEyebrow {
          margin: 0 0 9px;
          color: #0c8065;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .loginTitle {
          margin: 0;
          color: #173c36;
          font-size: clamp(32px, 6vw, 39px);
          font-weight: 650;
          line-height: 1.08;
          letter-spacing: -0.042em;
        }

        .loginSubtitle {
          max-width: 390px;
          margin: 13px 0 29px;
          color: #667b77;
          font-size: 15px;
          font-weight: 400;
          line-height: 1.6;
        }

        .loginForm {
          display: grid;
          gap: 18px;
        }

        .loginField {
          display: grid;
          gap: 8px;
        }

        .loginFieldHeader {
          display: block;
        }

        .loginFieldLabel {
          color: #31504b;
          font-size: 14px;
          font-weight: 500;
        }

        .loginForgotLink {
          color: #0b7b63;
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
        }

        .loginForgotLink:hover {
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .loginForgotRow {
          margin-top: -8px;
          text-align: right;
        }

        .loginInput {
          width: 100%;
          min-height: 52px;
          padding: 0 16px;
          border: 1px solid #cbdad7;
          border-radius: 13px;
          outline: none;
          background: #fbfdfc;
          color: #173532;
          font: inherit;
          font-size: 15px;
          font-weight: 400;
          transition:
            border-color 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }

        .loginInput::placeholder {
          color: #94a7a3;
          font-weight: 400;
        }

        .loginInput:hover {
          border-color: #aac6bf;
          background: #ffffff;
        }

        .loginInput:focus {
          border-color: #168c70;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(22, 140, 112, 0.11);
        }

        .loginError {
          padding: 12px 14px;
          border: 1px solid #fecaca;
          border-radius: 12px;
          background: #fff7f7;
          color: #a92d2d;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.45;
        }

        .loginButton {
          min-height: 54px;
          margin-top: 2px;
          border: 0;
          border-radius: 14px;
          cursor: pointer;
          color: #ffffff;
          background: linear-gradient(135deg, #109174 0%, #08715c 100%);
          box-shadow: 0 13px 30px rgba(8, 113, 92, 0.19);
          font: inherit;
          font-size: 15px;
          font-weight: 600;
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            filter 160ms ease;
        }

        .loginButton:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 32px rgba(8, 113, 92, 0.24);
          filter: brightness(1.02);
        }

        .loginButton:active {
          transform: translateY(0);
        }

        .loginDivider {
          height: 1px;
          margin: 7px 0 0;
          background: #e6eeec;
        }

        .loginRegister {
          margin: 0;
          color: #71827f;
          font-size: 14px;
          font-weight: 400;
          text-align: center;
        }

        .loginRegister a {
          color: #08715c;
          font-weight: 600;
          text-decoration: none;
        }

        .loginRegister a:hover {
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        @media (max-width: 600px) {
          .loginPage {
            align-items: start;
            padding: 18px 14px;
          }

          .loginCard {
            margin-top: 20px;
            padding: 26px 20px;
            border-radius: 21px;
          }

          .loginBrand {
            margin-bottom: 25px;
          }

          .loginBrandIcon {
            width: 42px;
            height: 42px;
            flex-basis: 42px;
          }

          .loginBrandName {
            font-size: 22px;
          }

          .loginSubtitle {
            margin-bottom: 24px;
          }
        }
      `}</style>

      <section className="loginCard">
        <div className="loginBrand" aria-label="Gastario">
          <span className="loginBrandIcon" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none">
              <path
                d="M39 10c2.5-5.5 7.2-7.9 13-8-1.1 6.4-5.1 10.2-12.2 11.2"
                stroke="#579B39"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13 26.5h38"
                stroke="#08715C"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M17 27v5c0 13 6.5 21 15 21s15-8 15-21v-5"
                stroke="#08715C"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M24 35h16M23 42h18"
                stroke="#E6A936"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M10 55h44"
                stroke="#08715C"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M32 18v8"
                stroke="#579B39"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </span>

          <span className="loginBrandName">Gastario</span>
        </div>

        <p className="loginEyebrow">Willkommen zurück</p>
        <h1 className="loginTitle">Einloggen</h1>

        <p className="loginSubtitle">
          Melde dich an, um Aufträge, Marken, E-Mails und Module zu verwalten.
        </p>

        <Form method="post" className="loginForm">
          {actionData?.error ? (
            <div className="loginError" role="alert">
              {actionData.error}
            </div>
          ) : null}

          <label className="loginField">
            <span className="loginFieldLabel">E-Mail</span>
            <input
              className="loginInput"
              name="email"
              type="email"
              placeholder="name@firma.de"
              autoComplete="email"
              required
            />
          </label>

          <label className="loginField">
            <span className="loginFieldHeader">
              <span className="loginFieldLabel">Passwort</span>
            </span>

            <input
              className="loginInput"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          <div className="loginForgotRow">
            <a
              className="loginForgotLink"
              href="mailto:info@gastario.de?subject=Gastario%20Passwort%20zur%C3%BCcksetzen"
            >
              Passwort vergessen?
            </a>
          </div>

          <button className="loginButton" type="submit">
            Einloggen
          </button>

          <div className="loginDivider" />

          <p className="loginRegister">
            Noch kein Account?{" "}
            <Link to="/registrieren">Account erstellen</Link>
          </p>
        </Form>
      </section>
    </main>
  );
}