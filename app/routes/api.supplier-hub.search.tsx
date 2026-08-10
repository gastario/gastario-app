function json(
  data: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "content-type":
          "application/json; charset=utf-8",
        "cache-control":
          "no-store"
      }
    }
  );
}

function parseLimit(
  value: string | null
) {
  const number =
    Number(value || 20);

  if (
    !Number.isFinite(number)
  ) {
    return 20;
  }

  return Math.min(
    100,
    Math.max(
      1,
      Math.floor(number)
    )
  );
}

export async function loader({
  request
}: {
  request: Request;
}) {
  const {
    requireTenantFeature
  } =
    await import(
      "../lib/features.server"
    );

  const {
    getSupplierHub
  } =
    await import(
      "../lib/supplier-hub/runtime.server"
    );

  const access =
    await requireTenantFeature(
      request,
      "PURCHASING"
    );

  const url =
    new URL(request.url);

  const query =
    String(
      url.searchParams.get("q") ||
      ""
    ).trim();

  if (query.length < 2) {
    return json(
      {
        ok: false,
        error:
          "Suchbegriff muss mindestens 2 Zeichen enthalten."
      },
      400
    );
  }

  const supplierConnectionIds =
    url.searchParams
      .getAll("connectionId")
      .map(
        (value) =>
          String(value).trim()
      )
      .filter(Boolean);

  try {
    const hub =
      getSupplierHub();

    const result =
      await hub.search.search({
        tenantId:
          access.tenantId,
        query,
        limit:
          parseLimit(
            url.searchParams.get(
              "limit"
            )
          ),
        supplierConnectionIds:
          supplierConnectionIds
            .length > 0
            ? supplierConnectionIds
            : undefined
      });

    return json({
      ok: true,
      ...result
    });
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    const notConfigured =
      message.includes(
        "SUPPLIER_HUB_METRO_GATEWAY_URL"
      ) ||
      message.includes(
        "SUPPLIER_HUB_SERVICE_TOKEN"
      );

    return json(
      {
        ok: false,
        error:
          notConfigured
            ? "Hosted Supplier Gateway ist noch nicht konfiguriert."
            : message
      },
      notConfigured
        ? 503
        : 500
    );
  }
}

export async function action() {
  return json(
    {
      ok: false,
      error:
        "Methode nicht erlaubt."
    },
    405
  );
}
