export type MoneyCandidate = {
  cents: number;
  source: string;
};

export type ResolvedMoneyRow = {
  quantity: number;
  unitCents: number;
  totalCents: number;
  exact: boolean;
  differenceCents: number;
  source: string;
};

function positiveInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.round(parsed));
}

export function calculateItemsTotal(
  items: Array<{
    totalCents?: number;
  }>
) {
  return items.reduce(
    (sum, item) =>
      sum +
      positiveInteger(item.totalCents),
    0
  );
}

/*
 * Wählt den Einzelpreis, dessen Multiplikation mit
 * der Menge am besten zur ausgewiesenen Zeilensumme
 * passt.
 *
 * Beispiel On Running:
 * Menge 100
 * Kandidaten 12,00 € und 12,80 €
 * Zeilensumme 1.280,00 €
 * → 12,80 € gewinnt mathematisch eindeutig.
 */
export function resolveMoneyRow(input: {
  quantity: number;
  unitCandidates: MoneyCandidate[];
  statedTotalCents?: number | null;
}): ResolvedMoneyRow | null {
  const quantity = positiveInteger(
    input.quantity
  );

  if (quantity <= 0) {
    return null;
  }

  const statedTotalCents =
    positiveInteger(input.statedTotalCents);

  const candidates = input.unitCandidates
    .map((candidate) => ({
      cents: positiveInteger(
        candidate.cents
      ),
      source: candidate.source,
    }))
    .filter(
      (candidate) => candidate.cents > 0
    );

  if (candidates.length === 0) {
    if (statedTotalCents <= 0) {
      return null;
    }

    const inferredUnitCents = Math.round(
      statedTotalCents / quantity
    );

    return {
      quantity,
      unitCents: inferredUnitCents,
      totalCents: statedTotalCents,
      exact:
        inferredUnitCents * quantity ===
        statedTotalCents,
      differenceCents: Math.abs(
        inferredUnitCents * quantity -
          statedTotalCents
      ),
      source: "INFERRED_FROM_ROW_TOTAL",
    };
  }

  const ranked = candidates
    .map((candidate) => {
      const calculatedTotal =
        candidate.cents * quantity;

      const differenceCents =
        statedTotalCents > 0
          ? Math.abs(
              calculatedTotal -
                statedTotalCents
            )
          : 0;

      return {
        quantity,
        unitCents: candidate.cents,
        totalCents:
          statedTotalCents > 0
            ? statedTotalCents
            : calculatedTotal,
        exact:
          statedTotalCents <= 0 ||
          differenceCents === 0,
        differenceCents,
        source: candidate.source,
      };
    })
    .sort((a, b) => {
      if (
        a.differenceCents !==
        b.differenceCents
      ) {
        return (
          a.differenceCents -
          b.differenceCents
        );
      }

      return b.unitCents - a.unitCents;
    });

  return ranked[0] || null;
}

export function resolveOrderTotal(input: {
  calculatedItemsTotalCents: number;
  documentNetTotalCents?: number | null;
  toleranceCents?: number;
}) {
  const calculatedItemsTotalCents =
    positiveInteger(
      input.calculatedItemsTotalCents
    );

  const documentNetTotalCents =
    positiveInteger(
      input.documentNetTotalCents
    );

  const toleranceCents = Math.max(
    0,
    positiveInteger(
      input.toleranceCents ?? 2
    )
  );

  if (
    documentNetTotalCents > 0 &&
    calculatedItemsTotalCents > 0
  ) {
    const differenceCents = Math.abs(
      documentNetTotalCents -
        calculatedItemsTotalCents
    );

    return {
      selectedOrderTotalCents:
        differenceCents <= toleranceCents
          ? documentNetTotalCents
          : null,
      selectedTotalSource:
        differenceCents <= toleranceCents
          ? ("DOCUMENT_NET" as const)
          : null,
      differenceCents,
      consistent:
        differenceCents <= toleranceCents,
    };
  }

  if (documentNetTotalCents > 0) {
    return {
      selectedOrderTotalCents:
        documentNetTotalCents,
      selectedTotalSource:
        "DOCUMENT_NET" as const,
      differenceCents: 0,
      consistent: true,
    };
  }

  if (calculatedItemsTotalCents > 0) {
    return {
      selectedOrderTotalCents:
        calculatedItemsTotalCents,
      selectedTotalSource:
        "ITEM_SUM" as const,
      differenceCents: 0,
      consistent: true,
    };
  }

  return {
    selectedOrderTotalCents: null,
    selectedTotalSource: null,
    differenceCents: 0,
    consistent: false,
  };
}