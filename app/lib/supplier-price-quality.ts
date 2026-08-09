export type SupplierPriceQualityStatus =
  | "VALID"
  | "SUSPICIOUS"
  | "UNCHECKED";

type HistoricalPrice = {
  netPriceCents?: number | null;
  qualityStatus?: string | null;
  priceUnit?: string | null;
  minimumQuantity?: number | null;
  fetchedAt?: Date | string | null;
};

function normalizeUnit(value: unknown) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/\s+/g, " ");
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const middle = Math.floor(
    sorted.length / 2
  );

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return Math.round(
    (sorted[middle - 1] + sorted[middle]) /
      2
  );
}

export function assessSupplierPriceQuality(
  params: {
    netPriceCents: number;
    grossPriceCents?: number | null;
    priceUnit?: string | null;
    minimumQuantity?: number | null;
    history?: HistoricalPrice[];
  }
) {
  const netPriceCents = Math.round(
    Number(params.netPriceCents || 0)
  );

  if (
    !Number.isFinite(netPriceCents) ||
    netPriceCents <= 0
  ) {
    return {
      status: "SUSPICIOUS" as const,
      reason: "Preis ist null oder ungueltig.",
      referencePriceCents: null,
      priceRatio: null,
    };
  }

  const grossPriceCents =
    params.grossPriceCents == null
      ? null
      : Math.round(
          Number(params.grossPriceCents)
        );

  if (
    grossPriceCents != null &&
    Number.isFinite(grossPriceCents) &&
    (
      grossPriceCents < netPriceCents ||
      grossPriceCents >
        netPriceCents * 1.5
    )
  ) {
    return {
      status: "SUSPICIOUS" as const,
      reason:
        "Netto- und Bruttopreis stehen in einem unplausiblen Verhaeltnis.",
      referencePriceCents: null,
      priceRatio: null,
    };
  }

  const unit = normalizeUnit(
    params.priceUnit
  );

  const minimumQuantity =
    Number(
      params.minimumQuantity || 1
    ) || 1;

  const comparableHistory = (
    params.history || []
  )
    .filter((entry) => {
      const price = Number(
        entry.netPriceCents || 0
      );

      if (
        !Number.isFinite(price) ||
        price <= 0 ||
        entry.qualityStatus ===
          "SUSPICIOUS"
      ) {
        return false;
      }

      const historicalUnit =
        normalizeUnit(entry.priceUnit);

      if (
        unit &&
        historicalUnit &&
        unit !== historicalUnit
      ) {
        return false;
      }

      const historicalMinimum =
        Number(
          entry.minimumQuantity || 1
        ) || 1;

      return (
        Math.abs(
          historicalMinimum -
            minimumQuantity
        ) < 0.0001
      );
    })
    .map((entry) =>
      Math.round(
        Number(entry.netPriceCents)
      )
    )
    .slice(0, 8);

  const referencePriceCents =
    median(comparableHistory);

  if (
    referencePriceCents == null ||
    comparableHistory.length < 2
  ) {
    return {
      status: "VALID" as const,
      reason:
        comparableHistory.length === 0
          ? "Noch keine vergleichbare Preishistorie."
          : "Noch zu wenig Preishistorie fuer Ausreisserpruefung.",
      referencePriceCents,
      priceRatio:
        referencePriceCents
          ? netPriceCents /
            referencePriceCents
          : null,
    };
  }

  const ratio =
    netPriceCents /
    referencePriceCents;

  /*
   * Sehr hohe Schwelle, damit echte Preisbewegungen nicht
   * blockiert werden. Faktor-100-Parserfehler werden dagegen
   * sicher erkannt.
   */
  if (ratio >= 8 || ratio <= 0.125) {
    return {
      status: "SUSPICIOUS" as const,
      reason:
        `Preis weicht um Faktor ${ratio.toFixed(
          2
        )} von der bisherigen Preishistorie ab.`,
      referencePriceCents,
      priceRatio: ratio,
    };
  }

  return {
    status: "VALID" as const,
    reason: null,
    referencePriceCents,
    priceRatio: ratio,
  };
}

export function selectTrustedSupplierPrice<
  T extends HistoricalPrice
>(
  prices: T[]
): {
  price: T | null;
  rejectedLatest: T | null;
} {
  if (!Array.isArray(prices) || prices.length === 0) {
    return {
      price: null,
      rejectedLatest: null,
    };
  }

  const sorted = [...prices].sort(
    (left, right) =>
      new Date(
        right.fetchedAt || 0
      ).getTime() -
      new Date(
        left.fetchedAt || 0
      ).getTime()
  );

  const latest = sorted[0];

  if (
    latest.qualityStatus !==
      "SUSPICIOUS" &&
    latest.qualityStatus !==
      "REJECTED"
  ) {
    /*
     * LEGACY/UNCHECKED-Snapshots bekommen zusaetzlich eine
     * Laufzeitpruefung gegen ihre eigene Historie. Dadurch
     * koennen bereits gespeicherte Faktor-100-Ausreisser
     * abgefangen werden, bevor ein neuer Import erfolgt.
     */
    if (
      !latest.qualityStatus ||
      latest.qualityStatus ===
        "UNCHECKED"
    ) {
      const assessment =
        assessSupplierPriceQuality({
          netPriceCents: Number(
            latest.netPriceCents || 0
          ),
          priceUnit:
            latest.priceUnit || null,
          minimumQuantity:
            latest.minimumQuantity || 1,
          history: sorted.slice(1),
        });

      if (
        assessment.status !==
          "SUSPICIOUS"
      ) {
        return {
          price: latest,
          rejectedLatest: null,
        };
      }
    } else {
      return {
        price: latest,
        rejectedLatest: null,
      };
    }
  }

  const fallback =
    sorted.find(
      (entry, index) =>
        index > 0 &&
        entry.qualityStatus !==
          "SUSPICIOUS" &&
        entry.qualityStatus !==
          "REJECTED"
    ) || null;

  return {
    price: fallback,
    rejectedLatest: latest,
  };
}
export async function autoResolveSuspiciousSupplierPrices(
  prisma: any,
  params: {
    tenantId: string;
    catalogItemId: string;
    currentNetPriceCents: number;
    currentGrossPriceCents?: number | null;
    priceUnit?: string | null;
    minimumQuantity?: number | null;
  }
) {
  const comparableWhere = {
    tenantId: params.tenantId,
    catalogItemId: params.catalogItemId,
    priceUnit: params.priceUnit || null,
    minimumQuantity:
      params.minimumQuantity || 1,
  };

  const recentTrusted =
    await prisma.supplierPriceSnapshot.findMany({
      where: {
        ...comparableWhere,
        qualityStatus: {
          in: [
            "VALID",
            "UNCHECKED",
          ],
        },
      },
      orderBy: {
        fetchedAt: "desc",
      },
      take: 8,
    });

  /*
   * Der frisch importierte VALID-Preis zählt als dritter
   * plausibler Datenpunkt. Zusätzlich verlangen wir mindestens
   * zwei bereits gespeicherte brauchbare Vergleichspreise.
   */
  if (recentTrusted.length < 2) {
    return {
      checked: 0,
      autoRejected: 0,
    };
  }

  const suspicious =
    await prisma.supplierPriceSnapshot.findMany({
      where: {
        ...comparableWhere,
        qualityStatus: "SUSPICIOUS",
      },
      orderBy: {
        fetchedAt: "desc",
      },
      take: 20,
    });

  if (suspicious.length === 0) {
    return {
      checked: 0,
      autoRejected: 0,
    };
  }

  const currentPrice = {
    netPriceCents:
      params.currentNetPriceCents,
    grossPriceCents:
      params.currentGrossPriceCents ??
      null,
    priceUnit:
      params.priceUnit || null,
    minimumQuantity:
      params.minimumQuantity || 1,
    qualityStatus: "VALID",
    fetchedAt: new Date(),
  };

  const history = [
    currentPrice,
    ...recentTrusted,
  ];

  let autoRejected = 0;

  for (const candidate of suspicious) {
    const assessment =
      assessSupplierPriceQuality({
        netPriceCents:
          candidate.netPriceCents,
        grossPriceCents:
          candidate.grossPriceCents,
        priceUnit:
          candidate.priceUnit,
        minimumQuantity:
          candidate.minimumQuantity,
        history,
      });

    if (
      assessment.status !==
        "SUSPICIOUS"
    ) {
      continue;
    }

    await prisma.supplierPriceSnapshot.update({
      where: {
        id: candidate.id,
      },
      data: {
        qualityStatus: "REJECTED",
        qualityReason:
          `Automatisch verworfen: ${assessment.reason || "Ausreißer durch spätere plausible Preisverläufe bestätigt."}`,
        referencePriceCents:
          assessment.referencePriceCents,
        priceRatio:
          assessment.priceRatio,
        qualityCheckedAt:
          new Date(),
      },
    });

    autoRejected += 1;
  }

  return {
    checked: suspicious.length,
    autoRejected,
  };
}
