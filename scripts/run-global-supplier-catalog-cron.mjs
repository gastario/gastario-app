const baseUrl =
  String(
    process.env.GASTARIO_APP_URL ||
      process.env.APP_URL ||
      ""
  )
    .trim()
    .replace(/\/+$/, "");

const secret =
  String(
    process.env
      .GLOBAL_SUPPLIER_CATALOG_CRON_SECRET ||
      ""
  ).trim();

const limit =
  Math.max(
    1,
    Math.min(
      Number(
        process.env
          .GLOBAL_SUPPLIER_CATALOG_CRON_LIMIT ||
          10
      ) || 10,
      50
    )
  );

if (!baseUrl) {
  console.error(
    "GASTARIO_APP_URL oder APP_URL fehlt."
  );
  process.exit(1);
}

if (!secret) {
  console.error(
    "GLOBAL_SUPPLIER_CATALOG_CRON_SECRET fehlt."
  );
  process.exit(1);
}

const endpoint =
  baseUrl +
  "/api/global-supplier-catalog-feeds/run-due";

console.log(
  "[global-catalog-cron] Starte:",
  endpoint
);

try {
  const response =
    await fetch(
      endpoint,
      {
        method: "POST",
        headers: {
          Authorization:
            "Bearer " + secret,
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify({
            limit,
          }),
      }
    );

  const text =
    await response.text();

  let data = null;

  try {
    data =
      text
        ? JSON.parse(text)
        : null;
  } catch {
    data = {
      raw:
        text,
    };
  }

  if (!response.ok) {
    console.error(
      "[global-catalog-cron] HTTP",
      response.status,
      data
    );
    process.exit(1);
  }

  console.log(
    "[global-catalog-cron] Erfolgreich:",
    JSON.stringify(
      data,
      null,
      2
    )
  );

  process.exit(0);
} catch (error) {
  console.error(
    "[global-catalog-cron] Fehler:",
    error
  );
  process.exit(1);
}
