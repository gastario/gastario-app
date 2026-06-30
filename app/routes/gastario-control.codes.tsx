import { Form, useActionData, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const part = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  return `GASTARIO-${part()}-${part()}-${part()}`;
}

function parseDate(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  const date = new Date(`${raw}T23:59:59`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

  const codes = await prisma.registrationInvite.findMany({
    select: {
      id: true,
      code: true,
      note: true,
      email: true,
      usedAt: true,
      usedBy: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });

  return {
    codes: codes.map((code) => ({
      id: code.id,
      code: code.code,
      note: code.note,
      email: code.email,
      usedAt: code.usedAt ? code.usedAt.toISOString() : null,
      usedBy: code.usedBy,
      createdAt: code.createdAt.toISOString(),
      expiresAt: code.expiresAt ? code.expiresAt.toISOString() : null,
    })),
  };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const formData = await request.formData();

  const intent = String(formData.get("intent") || "");

  if (intent === "create") {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const note = String(formData.get("note") || "").trim();
    const expiresAt = parseDate(formData.get("expiresAt"));

    if (email && !email.includes("@")) {
      return {
        error: "E-Mail ist ungueltig.",
      };
    }

    let code = generateInviteCode();

    for (let i = 0; i < 10; i++) {
      const existing = await prisma.registrationInvite.findUnique({
        where: { code },
        select: { id: true },
      });

      if (!existing) {
        break;
      }

      code = generateInviteCode();
    }

    const invite = await prisma.registrationInvite.create({
      data: {
        code,
        email: email || null,
        note: note || null,
        expiresAt,
      },
      select: {
        code: true,
      },
    });

    return {
      success: "Registrierungscode wurde erstellt.",
      createdCode: invite.code,
    };
  }

  const inviteId = String(formData.get("inviteId") || "");

  if (!inviteId) {
    return {
      error: "Code fehlt.",
    };
  }

  if (intent === "deactivate") {
    await prisma.registrationInvite.update({
      where: {
        id: inviteId,
      },
      data: {
        usedAt: new Date(),
        usedBy: "deaktiviert durch Super Admin",
      },
    });

    return {
      success: "Code wurde deaktiviert.",
    };
  }

  if (intent === "reopen") {
    await prisma.registrationInvite.update({
      where: {
        id: inviteId,
      },
      data: {
        usedAt: null,
        usedBy: null,
      },
    });

    return {
      success: "Code wurde wieder geoeffnet.",
    };
  }

  if (intent === "delete") {
    await prisma.registrationInvite.delete({
      where: {
        id: inviteId,
      },
    });

    return {
      success: "Code wurde geloescht.",
    };
  }

  return {
    error: "Unbekannte Aktion.",
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("de-DE");
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function statusLabel(item: any) {
  if (item.usedAt) return "Geschlossen";
  if (isExpired(item.expiresAt)) return "Abgelaufen";
  return "Offen";
}

function statusClass(item: any) {
  if (item.usedAt) return "codesBadge codesBadgeClosed";
  if (isExpired(item.expiresAt)) return "codesBadge codesBadgeExpired";
  return "codesBadge";
}

export default function CodesPage() {
  const { codes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const openCodes = codes.filter((code) => !code.usedAt && !isExpired(code.expiresAt));
  const expiredCodes = codes.filter((code) => !code.usedAt && isExpired(code.expiresAt));
  const closedCodes = codes.filter((code) => code.usedAt);

  return (
    <SuperAdminLayout>
      <style>{`
        .codesTopbar {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .codesKicker {
          color: #007f6d;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .14em;
          margin-bottom: 8px;
        }

        .codesTitle {
          font-size: 44px;
          line-height: 1;
          margin: 0 0 10px;
          color: #07111f;
          letter-spacing: -0.05em;
        }

        .codesSubtitle {
          margin: 0;
          color: #64748b;
          font-size: 16px;
          font-weight: 750;
          max-width: 760px;
          line-height: 1.55;
        }

        .codesButton {
          border: 0;
          border-radius: 999px;
          padding: 13px 18px;
          font-weight: 950;
          cursor: pointer;
          background: #ffffff;
          color: #0f172a;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, .12);
          transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
          white-space: nowrap;
        }

        .codesButton:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 30px rgba(15, 23, 42, .12), inset 0 0 0 1px rgba(15, 23, 42, .12);
        }

        .codesButtonPrimary {
          background: linear-gradient(135deg, #008f7a, #17b79f);
          color: white;
          box-shadow: 0 18px 40px rgba(0, 143, 122, .24);
        }

        .codesButtonDanger {
          color: #b91c1c;
        }

        .codesNotice {
          border-radius: 20px;
          padding: 16px 18px;
          font-weight: 900;
          margin-bottom: 18px;
          border: 1px solid;
        }

        .codesNoticeSuccess {
          background: #ecfdf5;
          border-color: #a7f3d0;
          color: #065f46;
        }

        .codesNoticeError {
          background: #fef2f2;
          border-color: #fecaca;
          color: #991b1b;
        }

        .codesCreatedCode {
          display: inline-flex;
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 14px;
          background: white;
          color: #07111f;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 18px;
          font-weight: 950;
          box-shadow: inset 0 0 0 1px rgba(6, 95, 70, .14);
        }

        .codesStats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .codesStatCard {
          background: rgba(255, 255, 255, .88);
          border: 1px solid rgba(148, 163, 184, .22);
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 20px 50px rgba(15, 23, 42, .08);
        }

        .codesStatLabel {
          color: #007f6d;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .1em;
        }

        .codesStatValue {
          font-size: 34px;
          font-weight: 950;
          letter-spacing: -0.05em;
          color: #07111f;
          margin-top: 8px;
        }

        .codesStatHint {
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
          margin-top: 4px;
        }

        .codesPanel {
          background: rgba(255, 255, 255, .9);
          border: 1px solid rgba(148, 163, 184, .22);
          border-radius: 28px;
          padding: 22px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, .10);
          margin-top: 18px;
        }

        .codesPanelHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          margin-bottom: 18px;
        }

        .codesPanelTitle {
          margin: 4px 0 0;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -0.04em;
          color: #07111f;
        }

        .codesCreateForm {
          display: grid;
          grid-template-columns: 1fr 1fr 180px auto;
          gap: 12px;
          align-items: end;
        }

        .codesField {
          display: grid;
          gap: 6px;
          font-weight: 900;
          color: #0f172a;
        }

        .codesInput {
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          padding: 12px 13px;
          font-weight: 750;
          width: 100%;
        }

        .codesTableWrap {
          overflow-x: auto;
          border-radius: 20px;
          border: 1px solid rgba(148, 163, 184, .24);
        }

        .codesTable {
          width: 100%;
          border-collapse: collapse;
          background: white;
        }

        .codesTable th {
          text-align: left;
          padding: 15px 16px;
          background: #f8fafc;
          color: #475569;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .08em;
          border-bottom: 1px solid rgba(148, 163, 184, .22);
        }

        .codesTable td {
          padding: 16px;
          color: #0f172a;
          font-size: 14px;
          font-weight: 750;
          border-bottom: 1px solid rgba(148, 163, 184, .16);
          vertical-align: middle;
        }

        .codesTable tr:last-child td {
          border-bottom: 0;
        }

        .codesMono {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 14px;
          font-weight: 950;
          color: #07111f;
        }

        .codesBadge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 7px 10px;
          background: #dcfce7;
          color: #047857;
          font-size: 12px;
          font-weight: 950;
          white-space: nowrap;
        }

        .codesBadgeClosed {
          background: #fee2e2;
          color: #b91c1c;
        }

        .codesBadgeExpired {
          background: #fef3c7;
          color: #92400e;
        }

        .codesActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .codesEmpty {
          padding: 34px;
          text-align: center;
          color: #64748b;
          font-weight: 850;
        }

        @media (max-width: 1100px) {
          .codesStats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .codesTopbar {
            flex-direction: column;
          }

          .codesCreateForm {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .codesStats {
            grid-template-columns: 1fr;
          }

          .codesTitle {
            font-size: 34px;
          }
        }
      `}</style>

      <header className="codesTopbar">
        <div>
          <div className="codesKicker">Super Admin</div>
          <h1 className="codesTitle">Registrierungscodes</h1>
          <p className="codesSubtitle">
            Erstelle Einladungscodes fuer neue Caterer. Optional kannst du E-Mail, Notiz und Ablaufdatum hinterlegen.
          </p>
        </div>
      </header>

      {actionData?.success ? (
        <div className="codesNotice codesNoticeSuccess">
          {actionData.success}
          {actionData.createdCode ? (
            <div className="codesCreatedCode">{actionData.createdCode}</div>
          ) : null}
        </div>
      ) : null}

      {actionData?.error ? (
        <div className="codesNotice codesNoticeError">{actionData.error}</div>
      ) : null}

      <section className="codesStats">
        <article className="codesStatCard">
          <div className="codesStatLabel">Gesamt</div>
          <div className="codesStatValue">{codes.length}</div>
          <div className="codesStatHint">erstellte Codes</div>
        </article>

        <article className="codesStatCard">
          <div className="codesStatLabel">Offen</div>
          <div className="codesStatValue">{openCodes.length}</div>
          <div className="codesStatHint">noch nutzbar</div>
        </article>

        <article className="codesStatCard">
          <div className="codesStatLabel">Abgelaufen</div>
          <div className="codesStatValue">{expiredCodes.length}</div>
          <div className="codesStatHint">Datum ueberschritten</div>
        </article>

        <article className="codesStatCard">
          <div className="codesStatLabel">Geschlossen</div>
          <div className="codesStatValue">{closedCodes.length}</div>
          <div className="codesStatHint">benutzt oder deaktiviert</div>
        </article>
      </section>

      <section className="codesPanel">
        <div className="codesPanelHeader">
          <div>
            <div className="codesKicker">Neuer Code</div>
            <h2 className="codesPanelTitle">Einladungscode erstellen</h2>
          </div>
        </div>

        <Form method="post" className="codesCreateForm">
          <input type="hidden" name="intent" value="create" />

          <label className="codesField">
            E-Mail optional
            <input className="codesInput" name="email" type="email" placeholder="kunde@catering.de" />
          </label>

          <label className="codesField">
            Notiz optional
            <input className="codesInput" name="note" placeholder="z.B. Messekontakt / Testkunde" />
          </label>

          <label className="codesField">
            Ablaufdatum
            <input className="codesInput" name="expiresAt" type="date" />
          </label>

          <button className="codesButton codesButtonPrimary" type="submit">
            Code erstellen
          </button>
        </Form>
      </section>

      <section className="codesPanel">
        <div className="codesPanelHeader">
          <div>
            <div className="codesKicker">Einladungen</div>
            <h2 className="codesPanelTitle">Alle Registrierungscodes</h2>
          </div>
        </div>

        <div className="codesTableWrap">
          {codes.length === 0 ? (
            <div className="codesEmpty">
              Noch keine Codes erstellt. Erstelle den ersten Einladungscode.
            </div>
          ) : (
            <table className="codesTable">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Status</th>
                  <th>E-Mail</th>
                  <th>Notiz</th>
                  <th>Ablauf</th>
                  <th>Benutzt / geschlossen</th>
                  <th>Erstellt</th>
                  <th>Aktionen</th>
                </tr>
              </thead>

              <tbody>
                {codes.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="codesMono">{item.code}</span>
                    </td>

                    <td>
                      <span className={statusClass(item)}>
                        {statusLabel(item)}
                      </span>
                    </td>

                    <td>{item.email || "-"}</td>
                    <td>{item.note || "-"}</td>
                    <td>{formatDate(item.expiresAt)}</td>
                    <td>
                      {item.usedAt ? (
                        <>
                          {formatDateTime(item.usedAt)}
                          <br />
                          <span style={{ color: "#64748b", fontSize: 12 }}>{item.usedBy || "-"}</span>
                        </>
                      ) : "-"}
                    </td>
                    <td>{formatDateTime(item.createdAt)}</td>

                    <td>
                      <div className="codesActions">
                        {item.usedAt ? (
                          <Form method="post">
                            <input type="hidden" name="intent" value="reopen" />
                            <input type="hidden" name="inviteId" value={item.id} />
                            <button className="codesButton" type="submit">
                              Wieder oeffnen
                            </button>
                          </Form>
                        ) : (
                          <Form method="post">
                            <input type="hidden" name="intent" value="deactivate" />
                            <input type="hidden" name="inviteId" value={item.id} />
                            <button className="codesButton" type="submit">
                              Deaktivieren
                            </button>
                          </Form>
                        )}

                        <Form method="post">
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="inviteId" value={item.id} />
                          <button className="codesButton codesButtonDanger" type="submit">
                            Loeschen
                          </button>
                        </Form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </SuperAdminLayout>
  );
}
