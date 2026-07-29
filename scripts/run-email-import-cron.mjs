const appUrl = String(
  process.env.GASTARIO_APP_URL || ""
)
  .trim()
  .replace(/\/+$/, "");

const secret = String(
  process.env.EMAIL_IMPORT_RUN_SECRET || ""
).trim();

if (!appUrl) {
  console.error(
    "GASTARIO_APP_URL fehlt."
  );
  process.exit(1);
}

if (!secret) {
  console.error(
    "EMAIL_IMPORT_RUN_SECRET fehlt."
  );
  process.exit(1);
}

const controller = new AbortController();

const timeout = setTimeout(
  () => controller.abort(),
  4 * 60 * 1000
);

try {
  const url =
    appUrl +
    "/api/email-import/run?secret=" +
    encodeURIComponent(secret);

  console.log(
    "Automatischer E-Mail-Import gestartet:",
    new Date().toISOString()
  );

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "user-agent":
        "gastario-email-import-cron/1.0",
    },
    signal: controller.signal,
  });

  const bodyText = await response.text();

  let result = null;

  try {
    result = JSON.parse(bodyText);
  } catch {
    result = {
      rawResponse:
        bodyText.slice(0, 1000),
    };
  }

  if (!response.ok || !result?.ok) {
    console.error(
      "Automatischer E-Mail-Import fehlgeschlagen:",
      JSON.stringify(result, null, 2)
    );

    process.exitCode = 1;
  } else {
    console.log(
      "Automatischer E-Mail-Import erfolgreich:",
      JSON.stringify(result, null, 2)
    );
  }
} catch (error) {
  console.error(
    "Automatischer E-Mail-Import fehlgeschlagen:",
    error instanceof Error
      ? error.message
      : String(error)
  );

  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}