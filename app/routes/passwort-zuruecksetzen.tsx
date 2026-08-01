import { createHash } from "node:crypto";
import { useMemo, useState, type ReactNode } from "react";
import bcrypt from "bcryptjs";

import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import { prisma } from "../lib/prisma.server";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  getPasswordRequirements,
  getPasswordValidationMessage,
  isPasswordValid,
} from "../lib/password-policy";

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

  if (
    !password ||
    !passwordConfirmation
  ) {
    return {
      error:
        "Bitte fülle beide Passwortfelder aus.",
    };
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      error:
        `Das Passwort darf höchstens ${PASSWORD_MAX_LENGTH} Zeichen lang sein.`,
    };
  }

  if (!isPasswordValid(password)) {
    return {
      error:
        getPasswordValidationMessage(password) ||
        "Das Passwort erfüllt nicht alle Anforderungen.",
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
  const data = useLoaderData<typeof loader>();

  const actionData = useActionData<
    typeof action
  >() as
    | {
        error?: string;
        success?: boolean;
      }
    | undefined;

  const navigation = useNavigation();

  const [password, setPassword] =
    useState("");

  const [
    passwordConfirmation,
    setPasswordConfirmation,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showPasswordConfirmation,
    setShowPasswordConfirmation,
  ] = useState(false);

  const passwordRequirements = useMemo(
    () => getPasswordRequirements(password),
    [password]
  );

  const passwordIsValid =
    isPasswordValid(password);

  const confirmationWasEntered =
    passwordConfirmation.length > 0;

  const passwordsMatch =
    confirmationWasEntered &&
    password === passwordConfirmation;

  const submitting =
    navigation.state === "submitting";

  const canSubmit =
    passwordIsValid &&
    passwordsMatch &&
    !submitting;

  if (actionData?.success) {
    return (
      <PasswordPageShell>
        <div
          className="resetSuccessIcon"
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
          className="resetWarningIcon"
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
      <div className="resetBrand">
        <img
          src="/brand/gastario-logo-full.png"
          alt="Gastario"
        />
      </div>

      <p className="resetEyebrow">
        Gastario Zugang
      </p>

      <h1 className="resetTitle">
        Neues Passwort festlegen
      </h1>

      <p className="resetText">
        Erstelle ein sicheres Passwort. Alle
        Anforderungen müssen erfüllt sein.
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

          <div className="resetPasswordField">
            <input
              className="resetInput"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              name="password"
              value={password}
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              autoComplete="new-password"
              onChange={(event) => {
                setPassword(
                  event.currentTarget.value
                );
              }}
              required
            />

            <button
              className="resetPasswordToggle"
              type="button"
              onClick={() => {
                setShowPassword(
                  (currentValue) =>
                    !currentValue
                );
              }}
              aria-label={
                showPassword
                  ? "Passwort verbergen"
                  : "Passwort anzeigen"
              }
              aria-pressed={showPassword}
            >
              <EyeIcon
                crossed={showPassword}
              />
            </button>
          </div>
        </label>

        <div
          className="resetRequirements"
          aria-live="polite"
        >
          <div className="resetRequirementsTitle">
            Passwort-Anforderungen
          </div>

          <ul>
            {passwordRequirements.map(
              (requirement) => (
                <li
                  key={requirement.key}
                  className={
                    requirement.valid
                      ? "isValid"
                      : password.length > 0
                        ? "isInvalid"
                        : ""
                  }
                >
                  <span
                    className="resetRequirementIcon"
                    aria-hidden="true"
                  >
                    {requirement.valid
                      ? "✓"
                      : "•"}
                  </span>

                  <span>
                    {requirement.label}
                  </span>
                </li>
              )
            )}
          </ul>
        </div>

        <label className="resetLabel">
          Passwort wiederholen

          <div className="resetPasswordField">
            <input
              className="resetInput"
              type={
                showPasswordConfirmation
                  ? "text"
                  : "password"
              }
              name="passwordConfirmation"
              value={passwordConfirmation}
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              autoComplete="new-password"
              onChange={(event) => {
                setPasswordConfirmation(
                  event.currentTarget.value
                );
              }}
              required
            />

            <button
              className="resetPasswordToggle"
              type="button"
              onClick={() => {
                setShowPasswordConfirmation(
                  (currentValue) =>
                    !currentValue
                );
              }}
              aria-label={
                showPasswordConfirmation
                  ? "Passwortbestätigung verbergen"
                  : "Passwortbestätigung anzeigen"
              }
              aria-pressed={
                showPasswordConfirmation
              }
            >
              <EyeIcon
                crossed={
                  showPasswordConfirmation
                }
              />
            </button>
          </div>
        </label>

        {confirmationWasEntered ? (
          <div
            className={
              passwordsMatch
                ? "resetMatch resetMatchValid"
                : "resetMatch resetMatchInvalid"
            }
            aria-live="polite"
          >
            <span aria-hidden="true">
              {passwordsMatch ? "✓" : "!"}
            </span>

            <span>
              {passwordsMatch
                ? "Die Passwörter stimmen überein."
                : "Die Passwörter stimmen nicht überein."}
            </span>
          </div>
        ) : null}

        <button
          className="resetButton"
          type="submit"
          disabled={!canSubmit}
        >
          {submitting
            ? "Passwort wird gespeichert …"
            : "Neues Passwort speichern"}
        </button>
      </Form>
    </PasswordPageShell>
  );
}

function EyeIcon({
  crossed,
}: {
  crossed: boolean;
}) {
  if (crossed) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M3 3l18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        <path
          d="M10.7 10.8a2 2 0 002.5 2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        <path
          d="M9.9 5.2A10.4 10.4 0 0112 5c5.2 0 9 7 9 7a16 16 0 01-3.1 4.1M6.5 6.6C3.5 8.6 2 12 2 12s3.8 7 10 7c1.6 0 3-.3 4.2-.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PasswordPageShell({
  children,
}: {
  children: ReactNode;
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
          max-width: 500px;
          padding: 38px;
          border: 1px solid rgba(183, 208, 202, 0.72);
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.97);
          box-shadow:
            0 30px 80px rgba(31, 68, 62, 0.11),
            0 8px 24px rgba(31, 68, 62, 0.055);
          text-align: center;
        }

        .resetBrand {
          display: flex;
          justify-content: center;
          margin-bottom: 25px;
        }

        .resetBrand img {
          display: block;
          width: 178px;
          max-width: 70%;
          height: auto;
        }

        .resetSuccessIcon,
        .resetWarningIcon {
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

        .resetWarningIcon {
          border-color: #f0d6ab;
          background: #fff9ed;
          color: #9a6414;
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
          gap: 17px;
          text-align: left;
        }

        .resetLabel {
          display: grid;
          gap: 8px;
          color: #31504b;
          font-size: 14px;
          font-weight: 500;
        }

        .resetPasswordField {
          position: relative;
        }

        .resetInput {
          width: 100%;
          min-height: 52px;
          padding: 0 50px 0 16px;
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
          box-shadow:
            0 0 0 4px
            rgba(22, 140, 112, 0.11);
        }

        .resetPasswordToggle {
          position: absolute;
          top: 50%;
          right: 14px;
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          padding: 0;
          border: 0;
          border-radius: 8px;
          transform: translateY(-50%);
          background: transparent;
          color: #607571;
          cursor: pointer;
        }

        .resetPasswordToggle:hover {
          background: #edf6f3;
          color: #08715c;
        }

        .resetPasswordToggle:focus-visible {
          outline: 3px solid rgba(22, 140, 112, 0.2);
          outline-offset: 2px;
        }

        .resetPasswordToggle svg {
          width: 20px;
          height: 20px;
        }

        .resetRequirements {
          padding: 15px 16px;
          border: 1px solid #d9e7e2;
          border-radius: 15px;
          background: #f7fbfa;
        }

        .resetRequirementsTitle {
          margin-bottom: 10px;
          color: #31504b;
          font-size: 12px;
          font-weight: 650;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .resetRequirements ul {
          display: grid;
          gap: 8px;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .resetRequirements li {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #748783;
          font-size: 13px;
          font-weight: 400;
          line-height: 1.4;
          transition: color 150ms ease;
        }

        .resetRequirements li.isValid {
          color: #08715c;
        }

        .resetRequirements li.isInvalid {
          color: #8a5b56;
        }

        .resetRequirementIcon {
          width: 18px;
          height: 18px;
          display: grid;
          place-items: center;
          flex: 0 0 18px;
          border-radius: 50%;
          background: #e5eeeb;
          color: #748783;
          font-size: 11px;
          font-weight: 700;
        }

        .resetRequirements li.isValid
        .resetRequirementIcon {
          background: #dff3eb;
          color: #08715c;
        }

        .resetRequirements li.isInvalid
        .resetRequirementIcon {
          background: #f7e9e7;
          color: #a24d43;
        }

        .resetMatch {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: -3px;
          font-size: 13px;
          font-weight: 500;
        }

        .resetMatchValid {
          color: #08715c;
        }

        .resetMatchInvalid {
          color: #a92d2d;
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
          box-shadow:
            0 13px 30px
            rgba(8, 113, 92, 0.19);
          font: inherit;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
        }

        .resetButton:disabled {
          cursor: not-allowed;
          opacity: 0.48;
          box-shadow: none;
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

          .resetBrand img {
            width: 160px;
          }
        }
      `}</style>

      <section>{children}</section>
    </main>
  );
}