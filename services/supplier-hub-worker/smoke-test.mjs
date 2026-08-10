const baseUrl =
  String(
    process.env
      .SUPPLIER_HUB_SMOKE_URL ||
      ""
  )
    .trim()
    .replace(/\/+$/, "");

if (!baseUrl) {
  console.error(
    "SUPPLIER_HUB_SMOKE_URL fehlt."
  );

  process.exit(1);
}

async function main() {
  const startedAt =
    Date.now();

  const response =
    await fetch(
      `${baseUrl}/health`,
      {
        headers: {
          accept:
            "application/json"
        },
        signal:
          AbortSignal.timeout(
            15_000
          )
      }
    );

  if (!response.ok) {
    throw new Error(
      `Healthcheck HTTP ${response.status}`
    );
  }

  const body =
    await response.json();

  if (
    body?.ok !== true ||
    body?.service !==
      "gastario-supplier-hub-worker"
  ) {
    throw new Error(
      "Unerwartete Healthcheck-Antwort."
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        service:
          body.service,
        version:
          body.version,
        latencyMs:
          Date.now() -
          startedAt
      },
      null,
      2
    )
  );
}

main()
  .catch(
    (error) => {
      console.error(
        error instanceof Error
          ? error.stack ||
              error.message
          : String(error)
      );

      process.exit(1);
    }
  );
