export async function createQuoteWithNextNumber(
  prisma: any,
  tenantId: string,
  data: Record<string, unknown>
) {
  const year = new Date().getFullYear();
  const prefix = `AN-${year}-`;

  const existingQuotes =
    await prisma.quote.findMany({
      where: {
        tenantId,
        quoteNumber: {
          startsWith: prefix,
        },
      },
      select: {
        quoteNumber: true,
      },
    });

  let highestNumber = 0;

  for (const quote of existingQuotes) {
    const match = String(
      quote.quoteNumber || ""
    ).match(
      new RegExp(
        `^${prefix.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}(\\d+)$`
      )
    );

    if (!match) {
      continue;
    }

    highestNumber = Math.max(
      highestNumber,
      Number(match[1]) || 0
    );
  }

  let nextNumber = highestNumber + 1;

  for (
    let attempt = 0;
    attempt < 20;
    attempt += 1
  ) {
    const quoteNumber =
      prefix +
      String(nextNumber).padStart(
        4,
        "0"
      );

    try {
      return await prisma.quote.create({
        data: {
          ...data,
          tenantId,
          quoteNumber,
        },
      });
    } catch (error: any) {
      if (error?.code === "P2002") {
        nextNumber += 1;
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    "Es konnte keine freie Angebotsnummer erzeugt werden."
  );
}