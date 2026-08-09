export interface JsonNode {
  value: Record<string, unknown>;
  path: string;
}

export function walkJsonObjects(
  input: unknown,
  options?: {
    maxDepth?: number;
    maxNodes?: number;
  }
) {
  const maxDepth =
    options?.maxDepth ?? 10;

  const maxNodes =
    options?.maxNodes ?? 20_000;

  const result: JsonNode[] = [];
  const seen = new Set<object>();

  const visit = (
    value: unknown,
    path: string,
    depth: number
  ) => {
    if (
      value == null ||
      depth > maxDepth ||
      result.length >= maxNodes
    ) {
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    if (seen.has(value as object)) {
      return;
    }

    seen.add(value as object);

    if (Array.isArray(value)) {
      for (
        let index = 0;
        index < value.length;
        index += 1
      ) {
        visit(
          value[index],
          `${path}[${index}]`,
          depth + 1
        );
      }
      return;
    }

    const record =
      value as Record<string, unknown>;

    result.push({
      value: record,
      path
    });

    for (const [key, child] of Object.entries(record)) {
      visit(
        child,
        path
          ? `${path}.${key}`
          : key,
        depth + 1
      );
    }
  };

  visit(input, "$", 0);

  return result;
}
