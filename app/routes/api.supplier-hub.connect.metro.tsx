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
    prisma
  } =
    await import(
      "../lib/prisma.server"
    );

  const {
    startSupplierConnect
  } =
    await import(
      "../lib/supplier-hub/connect-client.server"
    );

  const access =
    await requireTenantFeature(
      request,
      "PURCHASING"
    );

  const connections =
    await prisma
      .supplierConnection
      .findMany({
        where: {
          tenantId:
            access.tenantId,
          active:
            true
        },
        select: {
          id: true,
          label: true,
          settingsJson: true,
          supplier: {
            select: {
              name: true
            }
          }
        }
      });

  const metroConnection =
    connections.find(
      (
        connection
      ) => {
        const settings =
          connection.settingsJson &&
          typeof connection.settingsJson ===
            "object" &&
          !Array.isArray(
            connection.settingsJson
          )
            ? connection.settingsJson as Record<
                string,
                unknown
              >
            : {};

        const providerCode =
          String(
            settings.providerCode ||
            connection.label ||
            connection
              .supplier
              .name ||
            ""
          )
            .trim()
            .toUpperCase();

        return (
          providerCode === "METRO" ||
          providerCode.includes(
            "METRO"
          )
        );
      }
    );

  if (!metroConnection) {
    return json(
      {
        ok: false,
        error:
          "Keine aktive METRO-Verbindung gefunden."
      },
      404
    );
  }

  try {
    const result =
      await startSupplierConnect({
        tenantId:
          access.tenantId,
        connectionId:
          metroConnection.id,
        provider:
          "METRO"
      });

    const connectUrl =
      String(
        result?.connectUrl ||
        ""
      ).trim();

    if (!connectUrl) {
      return json(
        {
          ok: false,
          error:
            "Der Supplier Hub hat keine Connect-URL geliefert."
        },
        502
      );
    }

    return new Response(
      null,
      {
        status: 302,
        headers: {
          location:
            connectUrl,
          "cache-control":
            "no-store"
        }
      }
    );
  }
  catch (error) {
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error)
      },
      502
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
