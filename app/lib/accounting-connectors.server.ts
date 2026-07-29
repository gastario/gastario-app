const LEXWARE_API_BASE_URL = "https://api.lexware.io";

export type AccountingProfile = {
  organizationId: string;
  companyName: string;
  connectionId: string;
  subscriptionStatus?: string | null;
  taxType?: string | null;
  smallBusiness?: boolean | null;
  created?: {
    userId?: string | null;
    userName?: string | null;
    userEmail?: string | null;
    date?: string | null;
  } | null;
  businessFeatures?: string[];
};

export type AccountingOrderConfirmationSummary = {
  id: string;
  voucherNumber: string | null;
  voucherDate: string | null;
  createdDate: string | null;
  updatedDate: string | null;
  voucherStatus: string | null;
  contactId: string | null;
  totalGrossAmount: number | null;
  currency: string | null;
};

export type AccountingOrderConfirmation = {
  id: string;
  organizationId?: string | null;
  voucherNumber?: string | null;
  voucherDate?: string | null;
  createdDate?: string | null;
  updatedDate?: string | null;
  voucherStatus?: string | null;
  language?: string | null;
  address?: {
    contactId?: string | null;
    name?: string | null;
    supplement?: string | null;
    street?: string | null;
    city?: string | null;
    zip?: string | null;
    countryCode?: string | null;
  } | null;
  lineItems?: Array<{
    id?: string | null;
    type?: string | null;
    name?: string | null;
    description?: string | null;
    quantity?: number | null;
    unitName?: string | null;
    unitPrice?: {
      currency?: string | null;
      netAmount?: number | null;
      grossAmount?: number | null;
      taxRatePercentage?: number | null;
    } | null;
    lineItemAmount?: number | null;
    discountPercentage?: number | null;
  }>;
  totalPrice?: {
    currency?: string | null;
    totalNetAmount?: number | null;
    totalGrossAmount?: number | null;
    totalTaxAmount?: number | null;
  } | null;
  shippingConditions?: {
    shippingDate?: string | null;
    shippingType?: string | null;
  } | null;
  introduction?: string | null;
  remark?: string | null;
  deliveryTerms?: string | null;
};

export type AccountingOrderConfirmationPage = {
  content: AccountingOrderConfirmationSummary[];
  first: boolean;
  last: boolean;
  totalPages: number;
  totalElements: number;
  numberOfElements: number;
  size: number;
  number: number;
};

export type AccountingPdfFile = {
  data: Buffer;
  filename: string;
  mimeType: string;
};

type ApiRequestOptions = {
  accessToken: string;
  path: string;
  accept?: string;
};

function normalizeAccessToken(value: string) {
  const accessToken = String(value || "").trim();

  if (!accessToken) {
    throw new Error(
      "Es ist kein Zugangsschlüssel für die Buchhaltungsanbindung vorhanden."
    );
  }

  return accessToken;
}

async function readErrorMessage(response: Response) {
  try {
    const body = await response.json();

    if (
      body &&
      typeof body === "object" &&
      "message" in body
    ) {
      return String(
        (body as Record<string, unknown>).message || ""
      );
    }

    return JSON.stringify(body);
  } catch {
    try {
      return await response.text();
    } catch {
      return "";
    }
  }
}

async function accountingApiRequest({
  accessToken,
  path,
  accept = "application/json",
}: ApiRequestOptions) {
  const normalizedToken =
    normalizeAccessToken(accessToken);

  const response = await fetch(
    LEXWARE_API_BASE_URL + path,
    {
      method: "GET",
      headers: {
        Authorization:
          "Bearer " + normalizedToken,
        Accept: accept,
      },
    }
  );

  if (!response.ok) {
    const errorMessage =
      await readErrorMessage(response);

    if (response.status === 401) {
      throw new Error(
        "Der Zugangsschlüssel wurde abgelehnt."
      );
    }

    if (response.status === 403) {
      throw new Error(
        "Der Zugang hat nicht die erforderliche Berechtigung."
      );
    }

    if (response.status === 404) {
      throw new Error(
        "Das angeforderte Dokument wurde nicht gefunden."
      );
    }

    if (response.status === 409) {
      throw new Error(
        "Für diesen Dokumentstatus ist noch keine PDF-Datei verfügbar."
      );
    }

    if (response.status === 429) {
      throw new Error(
        "Die Buchhaltungsschnittstelle wurde zu häufig aufgerufen. Bitte später erneut versuchen."
      );
    }

    throw new Error(
      "Buchhaltungsschnittstelle antwortete mit HTTP " +
        response.status +
        (errorMessage
          ? ": " + errorMessage
          : ".")
    );
  }

  return response;
}

export async function testAccountingConnection(
  accessToken: string
) {
  const profile =
    await getAccountingProfile(accessToken);

  return {
    ok: true,
    organizationId: profile.organizationId,
    companyName: profile.companyName,
    userEmail:
      profile.created?.userEmail || null,
    subscriptionStatus:
      profile.subscriptionStatus || null,
  };
}

export async function getAccountingProfile(
  accessToken: string
): Promise<AccountingProfile> {
  const response =
    await accountingApiRequest({
      accessToken,
      path: "/v1/profile",
    });

  return response.json();
}

export async function listOrderConfirmations(
  accessToken: string,
  options?: {
    page?: number;
    size?: number;
    voucherStatus?: string;
    voucherNumber?: string;
  }
): Promise<AccountingOrderConfirmationPage> {
  const page = Math.max(
    0,
    Number(options?.page || 0)
  );

  const size = Math.min(
    250,
    Math.max(
      1,
      Number(options?.size || 25)
    )
  );

  const searchParams = new URLSearchParams({
    voucherType: "orderconfirmation",
    page: String(page),
    size: String(size),
  });

  if (options?.voucherStatus) {
    searchParams.set(
      "voucherStatus",
      String(options.voucherStatus)
    );
  }

  if (options?.voucherNumber) {
    searchParams.set(
      "voucherNumber",
      String(options.voucherNumber)
    );
  }

  const response =
    await accountingApiRequest({
      accessToken,
      path:
        "/v1/voucherlist?" +
        searchParams.toString(),
    });

  return response.json();
}

export async function getOrderConfirmation(
  accessToken: string,
  documentId: string
): Promise<AccountingOrderConfirmation> {
  const normalizedDocumentId =
    String(documentId || "").trim();

  if (!normalizedDocumentId) {
    throw new Error(
      "Es wurde keine Dokument-ID übergeben."
    );
  }

  const response =
    await accountingApiRequest({
      accessToken,
      path:
        "/v1/order-confirmations/" +
        encodeURIComponent(
          normalizedDocumentId
        ),
    });

  return response.json();
}

function getFilenameFromContentDisposition(
  value: string | null
) {
  if (!value) {
    return null;
  }

  const utf8Match = value.match(
    /filename\*=UTF-8''([^;]+)/i
  );

  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(
        utf8Match[1]
      );
    } catch {
      return utf8Match[1];
    }
  }

  const filenameMatch = value.match(
    /filename="?([^";]+)"?/i
  );

  return filenameMatch?.[1] || null;
}

export async function getOrderConfirmationPdf(
  accessToken: string,
  documentId: string
): Promise<AccountingPdfFile> {
  const normalizedDocumentId =
    String(documentId || "").trim();

  if (!normalizedDocumentId) {
    throw new Error(
      "Es wurde keine Dokument-ID übergeben."
    );
  }

  const response =
    await accountingApiRequest({
      accessToken,
      path:
        "/v1/order-confirmations/" +
        encodeURIComponent(
          normalizedDocumentId
        ) +
        "/file",
      accept: "application/pdf",
    });

  const arrayBuffer =
    await response.arrayBuffer();

  const filename =
    getFilenameFromContentDisposition(
      response.headers.get(
        "content-disposition"
      )
    ) ||
    "Auftragsbestaetigung-" +
      normalizedDocumentId +
      ".pdf";

  return {
    data: Buffer.from(arrayBuffer),
    filename,
    mimeType:
      response.headers.get(
        "content-type"
      ) || "application/pdf",
  };
}