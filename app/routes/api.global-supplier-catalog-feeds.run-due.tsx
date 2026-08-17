import { runDueGlobalSupplierCatalogFeeds } from "../lib/global-supplier-catalog-feed.server";

function json(
  data: unknown,
  init?: ResponseInit
) {
  return new Response(
    JSON.stringify(data),
    {
      ...init,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(init?.headers || {}),
      },
    }
  );
}

function isAuthorized(
  request: Request
) {
  const expectedSecret =
    String(
      process.env
        .GLOBAL_SUPPLIER_CATALOG_CRON_SECRET ||
        ""
    ).trim();

  if (!expectedSecret) {
    return false;
  }

  const authorization =
    String(
      request.headers.get("Authorization") ||
        ""
    ).trim();

  return (
    authorization ===
    "Bearer " + expectedSecret
  );
}

export async function loader() {
  return json(
    {
      ok: false,
      error: "METHOD_NOT_ALLOWED",
      message:
        "Dieser Endpunkt akzeptiert nur POST.",
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    }
  );
}

export async function action({
  request,
}: {
  request: Request;
}) {
  if (request.method !== "POST") {
    return json(
      {
        ok: false,
        error: "METHOD_NOT_ALLOWED",
      },
      {
        status: 405,
        headers: {
          Allow: "POST",
        },
      }
    );
  }

  if (!isAuthorized(request)) {
    return json(
      {
        ok: false,
        error: "UNAUTHORIZED",
      },
      {
        status: 401,
      }
    );
  }

  try {
    let limit = 10;

    const contentType =
      String(
        request.headers.get(
          "Content-Type"
        ) || ""
      ).toLowerCase();

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      const body =
        await request
          .json()
          .catch(() => null);

      const requestedLimit =
        Number(
          body &&
            typeof body === "object" &&
            "limit" in body
            ? body.limit
            : 10
        );

      if (
        Number.isFinite(
          requestedLimit
        )
      ) {
        limit =
          Math.max(
            1,
            Math.min(
              Math.floor(
                requestedLimit
              ),
              50
            )
          );
      }
    }

    const result =
      await runDueGlobalSupplierCatalogFeeds({
        limit,
      });

    return json({
      ok: true,
      ...result,
    });
  } catch (error: any) {
    console.error(
      "Global supplier catalog feed scheduler failed:",
      error
    );

    return json(
      {
        ok: false,
        error:
          "GLOBAL_SUPPLIER_CATALOG_FEED_SCHEDULER_FAILED",
        message:
          String(
            error?.message ||
              error ||
              "Unbekannter Fehler."
          ),
      },
      {
        status: 500,
      }
    );
  }
}
