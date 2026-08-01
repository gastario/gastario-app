import { Link } from "@remix-run/react";

export default function ForgotPasswordPage() {
  return (
    <main className="forgotPasswordPage">
      <style>{`
        .forgotPasswordPage,
        .forgotPasswordPage * {
          box-sizing: border-box;
        }

        .forgotPasswordPage {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 28px 18px;
          color: #173c36;
          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          background:
            radial-gradient(
              circle at 12% 10%,
              rgba(205, 236, 229, 0.62),
              transparent 34%
            ),
            linear-gradient(
              145deg,
              #f5fbf9 0%,
              #f8fafb 48%,
              #ffffff 100%
            );
        }

        .forgotPasswordCard {
          width: 100%;
          max-width: 480px;
          padding: 38px;
          border: 1px solid rgba(183, 208, 202, 0.72);
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.97);
          box-shadow:
            0 30px 80px rgba(31, 68, 62, 0.11),
            0 8px 24px rgba(31, 68, 62, 0.055);
          text-align: center;
        }

        .forgotPasswordLogo {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          margin: 0 auto 24px;
          border: 1px solid #c8e1da;
          border-radius: 19px;
          background: linear-gradient(
            145deg,
            #f5fcf9 0%,
            #e5f4ee 100%
          );
          color: #08715c;
          font-size: 28px;
        }

        .forgotPasswordEyebrow {
          margin: 0 0 9px;
          color: #0c8065;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .forgotPasswordCard h1 {
          margin: 0;
          color: #173c36;
          font-size: 34px;
          font-weight: 650;
          line-height: 1.12;
          letter-spacing: -0.04em;
        }

        .forgotPasswordText {
          margin: 17px 0 0;
          color: #667b77;
          font-size: 15px;
          font-weight: 400;
          line-height: 1.65;
        }

        .forgotPasswordContact {
          margin: 24px 0;
          padding: 16px;
          border: 1px solid #d9e8e4;
          border-radius: 14px;
          background: #f7fbf9;
          color: #31504b;
          font-size: 14px;
          line-height: 1.55;
        }

        .forgotPasswordContact strong {
          display: block;
          margin-top: 4px;
          color: #08715c;
          font-size: 15px;
          font-weight: 600;
        }

        .forgotPasswordBack {
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          color: #ffffff;
          background: linear-gradient(
            135deg,
            #109174 0%,
            #08715c 100%
          );
          box-shadow: 0 13px 30px rgba(8, 113, 92, 0.19);
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
        }

        @media (max-width: 600px) {
          .forgotPasswordPage {
            align-items: start;
            padding: 30px 14px;
          }

          .forgotPasswordCard {
            padding: 30px 21px;
            border-radius: 22px;
          }

          .forgotPasswordCard h1 {
            font-size: 30px;
          }
        }
      `}</style>

      <section className="forgotPasswordCard">
        <div className="forgotPasswordLogo" aria-hidden="true">
          🔒
        </div>

        <p className="forgotPasswordEyebrow">Gastario Zugang</p>

        <h1>Passwort vergessen?</h1>

        <p className="forgotPasswordText">
          Das automatische Zurücksetzen per E-Mail ist derzeit noch nicht
          eingerichtet. Bitte wende dich an deinen Gastario-Administrator.
        </p>

        <div className="forgotPasswordContact">
          Kontakt für die Zurücksetzung
          <strong>info@gastario.de</strong>
        </div>

        <Link className="forgotPasswordBack" to="/login">
          Zurück zum Login
        </Link>
      </section>
    </main>
  );
}