import { Form, Link, redirect, useActionData } from "react-router";
import { prisma } from "../lib/db.server";
import { createUserSession, hashPassword } from "../lib/auth.server";

const planConfig = {
  STARTER: {
    maxBrands: 1,
    maxEmailAccounts: 1,
    maxUsers: 1,
    features: [
      "DASHBOARD",
      "ORDERS",
      "CUSTOMERS",
      "PRODUCTS",
      "PACKING_LISTS",
      "DELIVERY_NOTES",
    ],
  },
  PROFESSIONAL: {
    maxBrands: 3,
    maxEmailAccounts: 3,
    maxUsers: 5,
    features: [
      "DASHBOARD",
      "ORDERS",
      "CUSTOMERS",
      "PRODUCTS",
      "QUOTES",
      "PRODUCTION",
      "PACKING_LISTS",
      "DELIVERY_NOTES",
      "DELIVERIES",
      "INCOMING_ORDERS",
      "PDF_EXTRACTION",
      "EMAIL_AUTOMATION",
      "PURCHASING",
      "INVENTORY",
      "SUPPLIERS",
      "RECIPES",
      "REPORTS",
      "PRODUCT_MAPPING",
    ],
  },
  PREMIUM: {
    maxBrands: 99,
    maxEmailAccounts: 99,
    maxUsers: 99,
    features: [
      "DASHBOARD",
      "ORDERS",
      "CUSTOMERS",
      "PRODUCTS",
      "QUOTES",
      "PRODUCTION",
      "PACKING_LISTS",
      "DELIVERY_NOTES",
      "DELIVERIES",
      "INCOMING_ORDERS",
      "PDF_EXTRACTION",
      "EMAIL_AUTOMATION",
      "PURCHASING",
      "INVENTORY",
      "SUPPLIERS",
      "RECIPES",
      "REPORTS",
      "MULTI_USER",
      "DRIVER_VIEW",
      "PRODUCT_MAPPING",
      "INTEGRATIONS",
    ],
  },
} as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/ÃƒÂ¤/g, "ae")
    .replace(/ÃƒÂ¶/g, "oe")
    .replace(/ÃƒÂ¼/g, "ue")
    .replace(/ÃƒÅ¸/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();

  const registrationCode = String(formData.get("registrationCode") || "").trim();

  const invite = await prisma.registrationInvite.findUnique({
    where: { code: registrationCode },
  });

  if (!invite || invite.usedAt) {
    return {
      error: "Der Zugangscode ist ungültig oder wurde bereits benutzt.",
    };
  }

  const planCode = "STARTER";
;
  }

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const companyName = String(formData.get("companyName") || "").trim();
  const brandName = String(formData.get("brandName") || "").trim();
  const importEmail = String(formData.get("importEmail") || "").trim().toLowerCase();
  const planCode = String(formData.get("planCode") || "STARTER") as keyof typeof planConfig;

  if (!name || !email || !password || !companyName || !brandName || !importEmail) {
    return { error: "Bitte alle Pflichtfelder ausfÃƒÂ¼llen." };
  }

  if (password.length < 8) {
    return { error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return { error: "Diese E-Mail-Adresse ist bereits registriert." };
  }

  const selectedPlan = planConfig[planCode] || planConfig.STARTER;
  const passwordHash = await hashPassword(password);
  const baseSlug = slugify(companyName);
  const tenantSlug = `${baseSlug}-${Date.now().toString().slice(-5)}`;

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
        slug: tenantSlug,
        planCode,
        subscriptionStatus: "TRIAL",
        maxBrands: selectedPlan.maxBrands,
        maxEmailAccounts: selectedPlan.maxEmailAccounts,
        maxUsers: selectedPlan.maxUsers,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    await tx.tenantUser.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: "OWNER",
      },
    });

    const brand = await tx.brand.create({
      data: {
        tenantId: tenant.id,
        name: brandName,
        email: importEmail,
      },
    });

    const emailAccount = await tx.emailAccount.create({
      data: {
        tenantId: tenant.id,
        brandId: brand.id,
        email: importEmail,
        label: `${brandName} Auftragseingang`,
        mode: "FORWARDING",
        active: true,
      },
    });

    await tx.emailRule.createMany({
      data: [
        {
          tenantId: tenant.id,
          emailAccountId: emailAccount.id,
          name: "Heycater Fast Track",
          source: "HEYCATER",
          subjectContains: "Fast Track Order bestÃƒÂ¤tigt",
          autoCreateOrder: true,
        },
        {
          tenantId: tenant.id,
          emailAccountId: emailAccount.id,
          name: "Heycater Auftrag bestÃƒÂ¤tigen",
          source: "HEYCATER",
          subjectContains: "Bitte bestÃƒÂ¤tige den Auftrag",
          autoCreateOrder: true,
        },
        {
          tenantId: tenant.id,
          emailAccountId: emailAccount.id,
          name: "Egora AuftragsbestÃƒÂ¤tigung",
          source: "EGORA",
          subjectContains: "AuftragsbestÃƒÂ¤tigung",
          autoCreateOrder: true,
        },
      ],
    });

    await tx.tenantFeature.createMany({
      data: selectedPlan.features.map((feature) => ({
        tenantId: tenant.id,
        feature,
        enabled: true,
      })),
    });

    return { user };
  });

  return createUserSession(result.user.id, "/auftragseingang");
}

export function meta() {
  return [{ title: "Registrieren Ã‚Â· Gastario" }];
}

export default function RegisterPage() {
  const actionData = useActionData<typeof action>();

  return (
    <main className="authShell">
      <section className="authCard">
        <div className="authIntro">
          <strong>Gastario</strong>
          <h1>Account erstellen</h1>
          <p>
            Lege deinen Caterer-Account an, wÃƒÂ¤hle ein Paket und verbinde die erste Marke mit einer E-Mail-Adresse.
          </p>
        </div>

        {actionData?.error ? <div className="authError">{actionData.error}</div> : null}

        <Form method="post" className="authForm">
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
            E-Mail fÃƒÂ¼r Auftragseingang
            <input name="importEmail" type="email" placeholder="bestellung@firma.de" required />
          </label>

          

          
            <label>
              Zugangscode
              <input
                name="registrationCode"
                type="text"
                placeholder="Einladungscode"
                required
              />
            </label>

            <div className="infoBox">
              Registrierung nur mit Einladungscode. Das Paket wird spÃ¤ter im Gastario-Control-Bereich freigeschaltet.
            </div>
<button className="primaryButton" type="submit">Account erstellen</button>
        </Form>

        <p className="authSwitch">
          Schon einen Account? <Link to="/login">Einloggen</Link>
        </p>
      </section>
    </main>
  );
}
