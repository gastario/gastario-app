import { requireSuperAdmin } from "../lib/session.server";
import { refreshGlobalSupplierCatalogCsv } from "../lib/global-supplier-catalog-refresh.server";

function json(
  data: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
        "Cache-Control":
          "no-store",
      },
    }
  );
}

export async function loader({
  request,
}: {
  request: Request;
}) {
  await requireSuperAdmin(
    request
  );

  return json({
    ok: true,
    route:
      "global-supplier-catalog-refresh",
    method:
      "POST",
    fields: {
      providerCode:
        "z. B. METRO",
      file:
        "CSV-Datei",
      distribute:
        "true | false, Standard true",
    },
  });
}

export async function action({
  request,
}: {
  request: Request;
}) {
  await requireSuperAdmin(
    request
  );

  if (
    request.method.toUpperCase() !==
    "POST"
  ) {
    return json(
      {
        ok: false,
        error:
          "Nur POST ist erlaubt.",
      },
      405
    );
  }

  const formData =
    await request.formData();

  const providerCode =
    String(
      formData.get(
        "providerCode"
      ) || ""
    )
      .trim()
      .toUpperCase();

  if (!providerCode) {
    return json(
      {
        ok: false,
        error:
          "Provider-Code fehlt.",
      },
      400
    );
  }

  const file =
    formData.get(
      "file"
    ) as any;

  if (
    !file ||
    typeof file.text !==
      "function"
  ) {
    return json(
      {
        ok: false,
        error:
          "CSV-Datei fehlt.",
      },
      400
    );
  }

  const fileName =
    String(
      file.name || ""
    );

  if (
    fileName &&
    !fileName
      .toLocaleLowerCase(
        "de-DE"
      )
      .endsWith(".csv")
  ) {
    return json(
      {
        ok: false,
        error:
          "Für V1 wird eine CSV-Datei erwartet.",
      },
      400
    );
  }

  const csvText =
    await file.text();

  if (
    !String(csvText || "")
      .trim()
  ) {
    return json(
      {
        ok: false,
        error:
          "Die CSV-Datei ist leer.",
      },
      400
    );
  }

  const distributeRaw =
    String(
      formData.get(
        "distribute"
      ) ?? "true"
    )
      .trim()
      .toLocaleLowerCase(
        "de-DE"
      );

  const distribute =
    ![
      "false",
      "0",
      "nein",
      "no",
    ].includes(
      distributeRaw
    );

  try {
    const result =
      await refreshGlobalSupplierCatalogCsv({
        providerCode,
        csvText,
        distribute,
      });

    return json({
      ok: true,
      fileName:
        fileName ||
        null,
      distribute,
      ...result,
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        providerCode,
        error:
          String(
            error?.message ||
            error
          ),
      },
      400
    );
  }
}
