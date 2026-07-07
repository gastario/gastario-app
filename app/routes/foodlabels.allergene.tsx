import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";

function safeText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

async function getAccess(request: Request) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const access = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
  });

  if (!access?.tenant) {
    throw redirect("/");
  }

  return { prisma, access };
}

export async function loader({ request }: { request: Request }) {
  const { prisma, access } = await getAccess(request);
  const { getFoodLabelDishAllergenRules } = await import("../lib/foodlabel-dish-allergens.server");

  const rules = await getFoodLabelDishAllergenRules(prisma, access.tenantId);

  return { rules };
}

export async function action({ request }: { request: Request }) {
  const { prisma, access } = await getAccess(request);
  const { ensureFoodLabelDishAllergenTable } = await import("../lib/foodlabel-dish-allergens.server");

  await ensureFoodLabelDishAllergenTable(prisma);

  const formData = await request.formData();
  const actionType = safeText(formData.get("_action"));
  const id = safeText(formData.get("id"));
  const dishName = safeText(formData.get("dishName"));
  const allergens = safeText(formData.get("allergens"));
  const note = safeText(formData.get("note"));

  if (actionType === "delete") {
    if (!id) return { error: "Regel fehlt." };

    await prisma.$executeRawUnsafe(
      `DELETE FROM "FoodLabelDishAllergen" WHERE "id" = $1 AND "tenantId" = $2`,
      id,
      access.tenantId
    );

    return { success: "Allergen-Regel wurde gelöscht." };
  }

  if (!dishName) {
    return { error: "Suchwort / Zutat fehlt." };
  }

  if (!allergens && !note) {
    return { error: "Bitte Allergene oder Hinweis eintragen." };
  }

  if (id) {
    await prisma.$executeRawUnsafe(
      `UPDATE "FoodLabelDishAllergen"
       SET "dishName" = $1, "allergens" = $2, "note" = $3, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $4 AND "tenantId" = $5`,
      dishName,
      allergens,
      note,
      id,
      access.tenantId
    );

    return { success: "Allergen-Regel wurde gespeichert." };
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "FoodLabelDishAllergen"
      ("id", "tenantId", "dishName", "allergens", "note", "updatedAt")
     VALUES
      ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT ("tenantId", "dishName")
     DO UPDATE SET
      "allergens" = EXCLUDED."allergens",
      "note" = EXCLUDED."note",
      "updatedAt" = CURRENT_TIMESTAMP`,
    crypto.randomUUID(),
    access.tenantId,
    dishName,
    allergens,
    note
  );

  return { success: "Allergen-Regel wurde angelegt." };
}

export default function FoodlabelAllergenePage() {
  const data = useLoaderData() as any;
  const actionData = useActionData() as any;

  return (
    <main className="page">
      <div className="header">
        <div>
          <p className="eyebrow">Foodlabels</p>
          <h1>Allergen-Erkennung</h1>
          <p className="subline">
            Diese Tabelle nutzt Gastario automatisch für Delivery-Overview-PDFs.
            Suchwort im Gericht erkannt → Allergene/Hinweise werden automatisch auf das Zebra-Label gesetzt.
          </p>
        </div>
        <Link to="/foodlabels" className="backLink">Zurück zu Foodlabels</Link>
      </div>

      {actionData?.success ? <div className="notice success">{actionData.success}</div> : null}
      {actionData?.error ? <div className="notice error">{actionData.error}</div> : null}

      <section className="card">
        <h2>Neues Suchwort / Zutat anlegen</h2>
        <Form method="post" className="gridForm">
          <input name="dishName" placeholder="z. B. Chicken, Salmon, Halloumi, Tempura" />
          <input name="allergens" placeholder="z. B. Egg, Soy, Gluten" />
          <input name="note" placeholder="z. B. Chicken, spices" />
          <button type="submit">Speichern</button>
        </Form>
      </section>

      <section className="card">
        <h2>Gespeicherte Suchwörter & Zutaten</h2>

        <div className="table">
          {data.rules.map((rule: any) => (
            <Form method="post" className="row" key={rule.id}>
              <input type="hidden" name="id" value={rule.id} />
              <input name="dishName" defaultValue={rule.dishName} />
              <input name="allergens" defaultValue={rule.allergens} />
              <input name="note" defaultValue={rule.note} />
              <button type="submit">Speichern</button>
              <button type="submit" name="_action" value="delete" className="danger">
                Löschen
              </button>
            </Form>
          ))}
        </div>
      </section>

      <style>{`
        .page {
          min-height: 100vh;
          padding: 42px;
          background: #eef7f5;
          color: #0f172a;
        }

        .header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 6px;
          color: #047857;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          font-size: 34px;
          letter-spacing: -0.04em;
        }

        h2 {
          margin: 0 0 16px;
          font-size: 22px;
        }

        .subline {
          margin: 8px 0 0;
          color: #64748b;
          max-width: 760px;
          line-height: 1.5;
        }

        .backLink {
          text-decoration: none;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          padding: 10px 16px;
          color: #0f172a;
          font-weight: 800;
        }

        .card {
          background: #ffffff;
          border: 1px solid #dbe7ec;
          border-radius: 22px;
          padding: 22px;
          margin-bottom: 20px;
          box-shadow: 0 14px 32px rgba(15, 23, 42, 0.06);
        }

        .gridForm,
        .row {
          display: grid;
          grid-template-columns: 1.3fr 1.4fr 1.2fr 120px;
          gap: 10px;
          align-items: center;
        }

        .row {
          grid-template-columns: 1.3fr 1.4fr 1.2fr 110px 100px;
          padding: 10px 0;
          border-top: 1px solid #e2e8f0;
        }

        input {
          width: 100%;
          min-height: 42px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 0 12px;
          font-weight: 650;
        }

        button {
          min-height: 42px;
          border: 1px solid #047857;
          border-radius: 12px;
          background: #059669;
          color: #ffffff;
          font-weight: 850;
          cursor: pointer;
        }

        button.danger {
          background: #fff7f4;
          border-color: #ffb7a8;
          color: #b42318;
        }

        .notice {
          border-radius: 14px;
          padding: 12px 14px;
          margin-bottom: 16px;
          font-weight: 800;
        }

        .notice.success {
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #047857;
        }

        .notice.error {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #c2410c;
        }

        @media (max-width: 1100px) {
          .gridForm,
          .row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

