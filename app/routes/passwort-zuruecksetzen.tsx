import { createHash } from "node:crypto";

import bcrypt from "bcryptjs";

import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import { prisma } from "../lib/prisma.server";

function hashResetToken(token: string) {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

function isValidRawToken(token: string) {
  return /^[a-f0-9]{64}$/i.test(token);
}

export async function loader({
  request,
}: {
  request: Request;
}) {
  const url = new URL(request.url);

  const token = String(
    url.searchParams.get("token") || ""
  ).trim();

  if (!isValidRawToken(token)) {
    return {
      valid: false,
      token: "",
    };
  }

  const tokenHash = hashResetToken(token);

  const resetToken =
    await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
      select: {
        expiresAt: true,
        usedAt: true,
      },
    });

  const valid = Boolean(
    resetToken &&
      !resetToken.usedAt &&
      resetToken.expiresAt.getTime() > Date.now()
  );

  return {
    valid,
    token: valid ? token : "",
  };
}

export async function action({
  request,
}: {
  request: Request;
}) {
  const formData = await request.formData();

  const token = String(
    formData.get("token") || ""
  ).trim();

  const password = String(
    formData.get("password") || ""
  );

  const passwordConfirmation = String(
    formData.get("passwordConfirmation") || ""
  );

  if (!isValidRawToken(token)) {
    return {
      error:
        "Dieser Link ist ungültig oder nicht mehr verfügbar.",
    };
  }

  if (password.length < 8) {
    return {
      error:
        "Das Passwort muss mindestens 8 Zeichen lang sein.",
    };
  }

  if (password !== passwordConfirmation) {
    return {
      error:
        "Die beiden Passwörter stimmen nicht überein.",
    };
  }

  const tokenHash = hashResetToken(token);
  const now = new Date();

  const resetToken =
    await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt.getTime() <= now.getTime()
  ) {
    return {
      error:
        "Dieser Link ist abgelaufen oder wurde bereits verwendet.",
    };
  }

  const passwordHash = await bcrypt.hash(
    password,
    12
  );

  try {
    await prisma.$transaction(async (tx) => {
      const claimed =
        await tx.passwordResetToken.updateMany({
          where: {
            id: resetToken.id,
            usedAt: null,
            expiresAt: {
              gt: now,
            },
          },
          data: {
            usedAt: now,
          },
        });

      if (claimed.count !== 1) {
        throw new Error("RESET_TOKEN_NOT_AVAILABLE");
      }

      await tx.user.update({
        where: {
          id: resetToken.userId,
        },
        data: {
          passwordHash,
          sessionVersion: {
            increment: 1,
          },
        },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });
    });
  } catch (error) {
    console.error(
      "Passwort konnte nicht zurückgesetzt werden:",
      error
    );

    return {
      error:
        "Dieser Link ist abgelaufen oder wurde bereits verwendet.",
    };
  }

  return {
    success: true,
  };
}

export default function ResetPasswordPage() {
  const data = useLoaderData<
    typeof loader
  >();

  const actionData = useActionData<
    typeof action
  >() as
    | {
        error?: string;
        success?: boolean;
      }
    | undefined;

  const navigation = useNavigation();

  const submitting =
    navigation.state === "submitting";

  if (actionData?.success) {
    return (
      <PasswordPageShell>
        <div
          className="resetIcon"
          aria-hidden="true"
        >
          ✓
        </div>

        <p className="resetEyebrow">
          Passwort geändert
        </p>

        <h1 className="resetTitle">
          Dein neues Passwort ist aktiv
        </h1>

        <p className="resetText">
          Alle bisherigen Gastario-Sitzungen wurden
          abgemeldet. Du kannst dich jetzt mit deinem
          neuen Passwort anmelden.
        </p>

        <Link
          className="resetButton"
          to="/login"
        >
          Zum Login
        </Link>
      </PasswordPageShell>
    );
  }

  if (!data.valid) {
    return (
      <PasswordPageShell>
        <div
          className="resetIcon"
          aria-hidden="true"
        >
          !
        </div>

        <p className="resetEyebrow">
          Link nicht verfügbar
        </p>

        <h1 className="resetTitle">
          Dieser Link ist ungültig
        </h1>

        <p className="resetText">
          Der Link ist abgelaufen, wurde bereits
          verwendet oder ist unvollständig.
        </p>

        <Link
          className="resetButton"
          to="/passwort-vergessen"
        >
          Neuen Reset-Link anfordern
        </Link>
      </PasswordPageShell>
    );
  }

  return (
    <PasswordPageShell>
      <div
        className="resetIcon"
        aria-hidden="true"
      >
        🔑
      </div>

      <p className="resetEyebrow">
        Gastario Zugang
      </p>

      <h1 className="resetTitle">
        Neues Passwort festlegen
      </h1>

      <p className="resetText">
        Wähle ein neues Passwort mit mindestens
        acht Zeichen.
      </p>

      {actionData?.error ? (
        <div
          className="resetError"
          role="alert"
        >
          {actionData.error}
        </div>
      ) : null}

      <Form
        method="post"
        className="resetForm"
      >
        <input
          type="hidden"
          name="token"
          value={data.token}
        />

        <label className="resetLabel">
          Neues Passwort

          <input
            className="resetInput"
            type="password"
            name="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>

        <label className="resetLabel">
          Passwort wiederholen

          <input
            className="resetInput"
            type="password"
            name="passwordConfirmation"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>

        <button
          className="resetButton"
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Passwort wird gespeichert …"
            : "Neues Passwort speichern"}
        </button>
      </Form>
    </PasswordPageShell>
  );
}

function PasswordPageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="resetPage">
      <style>{`
        .resetPage,
        .resetPage * {
          box-sizing: border-box;
        }

        .resetPage {
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

        .resetPage > section {
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

        .resetIcon {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          margin: 0 auto 24px;
          border: 1px solid #c8e1da;
          border-radius: 19px;
          background: #edf8f4;
          color: #08715c;
          font-size: 27px;
          font-weight: 700;
        }

        .resetEyebrow {
          margin: 0 0 9px;
          color: #0c8065;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .resetTitle {
          margin: 0;
          color: #173c36;
          font-size: 33px;
          font-weight: 650;
          line-height: 1.12;
          letter-spacing: -0.04em;
        }

        .resetText {
          margin: 17px 0 25px;
          color: #667b77;
          font-size: 15px;
          font-weight: 400;
          line-height: 1.65;
        }

        .resetForm {
          display: grid;
          gap: 15px;
          text-align: left;
        }

        .resetLabel {
          display: grid;
          gap: 8px;
          color: #31504b;
          font-size: 14px;
          font-weight: 500;
        }

        .resetInput {
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
        }

        .resetInput:focus {
          border-color: #168c70;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(22, 140, 112, 0.11);
        }

        .resetButton {
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 3px;
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

        .resetButton:disabled {
          cursor: wait;
          opacity: 0.7;
        }

        .resetError {
          margin-bottom: 18px;
          padding: 14px;
          border: 1px solid #fecaca;
          border-radius: 13px;
          background: #fff7f7;
          color: #a92d2d;
          font-size: 14px;
          line-height: 1.55;
          text-align: left;
        }

        @media (max-width: 600px) {
          .resetPage {
            align-items: start;
            padding: 30px 14px;
          }

          .resetPage > section {
            padding: 30px 21px;
            border-radius: 22px;
          }

          .resetTitle {
            font-size: 29px;
          }
        }
      `}</style>

      <section>{children}</section>
    </main>
  );
}