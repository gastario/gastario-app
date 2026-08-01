import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  Form,
  Link,
  useActionData,
  useNavigation,
} from "react-router";

import { prisma } from "../lib/prisma.server";

import {
  isPasswordResetMailConfigured,
  sendPasswordResetEmail,
} from "../lib/password-reset-mail.server";

const RESET_TOKEN_MINUTES = 30;

const SUCCESS_MESSAGE =
  "Falls ein Gastario-Konto mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen des Passworts versendet.";

function hashResetToken(token: string) {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function action({
  request,
}: {
  request: Request;
}) {
  const formData = await request.formData();

  const email = String(
    formData.get("email") || ""
  )
    .trim()
    .toLowerCase();

  if (!email || !isValidEmail(email)) {
    return {
      error: "Bitte gib eine gültige E-Mail-Adresse ein.",
    };
  }

  if (!isPasswordResetMailConfigured()) {
    console.error(
      "Passwort-Reset nicht verfügbar: Mailjet-Variablen fehlen."
    );

    return {
      error:
        "Der E-Mail-Versand ist derzeit noch nicht eingerichtet. Bitte versuche es später erneut.",
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    return {
      success: SUCCESS_MESSAGE,
    };
  }

  const recentThreshold = new Date(
    Date.now() - 60 * 1000
  );

  const recentToken =
    await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        createdAt: {
          gt: recentThreshold,
        },
      },
      select: {
        id: true,
      },
    });

  if (recentToken) {
    return {
      success: SUCCESS_MESSAGE,
    };
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);

  const expiresAt = new Date(
    Date.now() + RESET_TOKEN_MINUTES * 60 * 1000
  );

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
  });

  const resetUrl = new URL(
    "/passwort-zuruecksetzen",
    request.url
  );

  resetUrl.searchParams.set("token", rawToken);

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: resetUrl.toString(),
      expiresInMinutes: RESET_TOKEN_MINUTES,
    });
  } catch (error) {
    console.error(
      "Passwort-Reset-E-Mail konnte nicht versendet werden:",
      error
    );

    await prisma.passwordResetToken.deleteMany({
      where: {
        tokenHash,
      },
    });
  }

  return {
    success: SUCCESS_MESSAGE,
  };
}

export default function ForgotPasswordPage() {
  const actionData = useActionData<
    typeof action
  >() as
    | {
        error?: string;
        success?: string;
      }
    | undefined;

  const navigation = useNavigation();

  const submitting =
    navigation.state === "submitting";

  return (
    <main className="passwordPage">
      <style>{`
        .passwordPage,
        .passwordPage * {
          box-sizing: border-box;
        }

        .passwordPage {
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

        .passwordCard {
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

        .passwordIcon {
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
          font-size: 27px;
        }

        .passwordEyebrow {
          margin: 0 0 9px;
          color: #0c8065;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .passwordTitle {
          margin: 0;
          color: #173c36;
          font-size: 34px;
          font-weight: 650;
          line-height: 1.12;
          letter-spacing: -0.04em;
        }

        .passwordText {
          margin: 17px 0 25px;
          color: #667b77;
          font-size: 15px;
          font-weight: 400;
          line-height: 1.65;
        }

        .passwordForm {
          display: grid;
          gap: 15px;
          text-align: left;
        }

        .passwordLabel {
          display: grid;
          gap: 8px;
          color: #31504b;
          font-size: 14px;
          font-weight: 500;
        }

        .passwordInput {
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
        }

        .passwordInput:focus {
          border-color: #168c70;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(22, 140, 112, 0.11);
        }

        .passwordButton,
        .passwordBack {
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 14px;
          color: #ffffff;
          background: linear-gradient(
            135deg,
            #109174 0%,
            #08715c 100%
          );
          box-shadow: 0 13px 30px rgba(8, 113, 92, 0.19);
          font: inherit;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
        }

        .passwordButton:disabled {
          cursor: wait;
          opacity: 0.7;
        }

        .passwordBack {
          margin-top: 14px;
          color: #08715c;
          background: #f5faf8;
          border: 1px solid #d4e5e1;
          box-shadow: none;
        }

        .passwordMessage {
          margin-bottom: 18px;
          padding: 15px;
          border-radius: 13px;
          font-size: 14px;
          font-weight: 400;
          line-height: 1.55;
          text-align: left;
        }

        .passwordMessageError {
          border: 1px solid #fecaca;
          background: #fff7f7;
          color: #a92d2d;
        }

        .passwordMessageSuccess {
          border: 1px solid #bde2d6;
          background: #f1faf6;
          color: #17634f;
        }

        @media (max-width: 600px) {
          .passwordPage {
            align-items: start;
            padding: 30px 14px;
          }

          .passwordCard {
            padding: 30px 21px;
            border-radius: 22px;
          }

          .passwordTitle {
            font-size: 30px;
          }
        }
      `}</style>

      <section className="passwordCard">
        <div
          className="passwordIcon"
          aria-hidden="true"
        >
          🔐
        </div>

        <p className="passwordEyebrow">
          Gastario Zugang
        </p>

        <h1 className="passwordTitle">
          Passwort vergessen?
        </h1>

        <p className="passwordText">
          Gib deine E-Mail-Adresse ein. Du erhältst
          einen sicheren Link, mit dem du ein neues
          Passwort festlegen kannst.
        </p>

        {actionData?.error ? (
          <div
            className="passwordMessage passwordMessageError"
            role="alert"
          >
            {actionData.error}
          </div>
        ) : null}

        {actionData?.success ? (
          <div
            className="passwordMessage passwordMessageSuccess"
            role="status"
          >
            {actionData.success}
          </div>
        ) : null}

        {!actionData?.success ? (
          <Form
            method="post"
            className="passwordForm"
          >
            <label className="passwordLabel">
              E-Mail-Adresse

              <input
                className="passwordInput"
                type="email"
                name="email"
                placeholder="name@firma.de"
                autoComplete="email"
                required
              />
            </label>

            <button
              className="passwordButton"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "E-Mail wird vorbereitet …"
                : "Reset-Link anfordern"}
            </button>
          </Form>
        ) : null}

        <Link
          className="passwordBack"
          to="/login"
        >
          Zurück zum Login
        </Link>
      </section>
    </main>
  );
}