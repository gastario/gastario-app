export type AccountingProviderAvailability =
  | "AVAILABLE"
  | "PLANNED";

export type AccountingProviderDefinition = {
  code: string;
  name: string;
  description: string;
  availability: AccountingProviderAvailability;
  capabilities: string[];
};

export const ACCOUNTING_PROVIDERS: AccountingProviderDefinition[] = [
  {
    code: "LEXWARE",
    name: "Lexware Office",
    description:
      "Auftragsbestätigungen und zugehörige PDF-Dateien lesend abrufen.",
    availability: "AVAILABLE",
    capabilities: [
      "Verbindung testen",
      "Auftragsbestätigungen abrufen",
      "PDF-Dateien herunterladen",
    ],
  },
  {
    code: "SEVDESK",
    name: "sevdesk",
    description:
      "Eine optionale Gastario-Anbindung ist für einen späteren Ausbau vorgesehen.",
    availability: "PLANNED",
    capabilities: [],
  },
  {
    code: "DATEV",
    name: "DATEV",
    description:
      "Eine optionale Gastario-Anbindung ist für einen späteren Ausbau vorgesehen.",
    availability: "PLANNED",
    capabilities: [],
  },
  {
    code: "FASTBILL",
    name: "FastBill",
    description:
      "Eine optionale Gastario-Anbindung ist für einen späteren Ausbau vorgesehen.",
    availability: "PLANNED",
    capabilities: [],
  },
];

export function getAccountingProvider(
  providerCode: unknown
) {
  const normalizedCode = String(
    providerCode || ""
  )
    .trim()
    .toUpperCase();

  return (
    ACCOUNTING_PROVIDERS.find(
      (provider) =>
        provider.code === normalizedCode
    ) || null
  );
}