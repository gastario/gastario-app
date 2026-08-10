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

export async function action({
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
      "SUPPLIERS"
    );

  const formData =
    await request.formData();

  const connectionId =
    String(
      formData.get(
        "connectionId"
      ) || ""
    ).trim();

  if (!connectionId) {
    return json(
      {
        ok: false,
        error:
          "SupplierConnection-ID fehlt."
      },
      400
    );
  }

  const connection =
    await prisma
      .supplierConnection
      .findFirst({
        where: {
          id:
            connectionId,
          tenantId:
            access.tenantId,
          active:
            true
        },
        select: {
          id: true,
          supplier: {
            select: {
              name: true
            }
          }
        }
      });

  if (!connection) {
    return json(
      {
        ok: false,
        error:
          "Lieferantenverbindung wurde nicht gefunden."
      },
      404
    );
  }

  const supplierName =
    String(
      connection.supplier.name ||
      ""
    ).toUpperCase();

  if (
    !supplierName.includes(
      "METRO"
    )
  ) {
    return json(
      {
        ok: false,
        error:
          "Hosted Login ist aktuell nur für METRO vorbereitet."
      },
      400
    );
  }

  try {
    const result =
      await startSupplierConnect({
        tenantId:
          access.tenantId,
        connectionId:
          connection.id,
        provider:
          "METRO"
      });

    return json(result);
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

export async function loader() {
  return json(
    {
      ok: false,
      error:
        "Methode nicht erlaubt."
    },
    405
  );
}
