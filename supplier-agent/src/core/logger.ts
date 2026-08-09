type Level =
  | "debug"
  | "info"
  | "warn"
  | "error";

const weights: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export function createLogger(
  configuredLevel: string
) {
  const threshold =
    weights[
      configuredLevel as Level
    ] ?? weights.info;

  const write = (
    level: Level,
    message: string,
    details?: unknown
  ) => {
    if (weights[level] < threshold) {
      return;
    }

    const prefix =
      `[${new Date().toISOString()}]` +
      ` [${level.toUpperCase()}]`;

    if (details === undefined) {
      console.log(prefix, message);
      return;
    }

    console.log(
      prefix,
      message,
      typeof details === "string"
        ? details
        : JSON.stringify(details, null, 2)
    );
  };

  return {
    debug: (
      message: string,
      details?: unknown
    ) => write("debug", message, details),

    info: (
      message: string,
      details?: unknown
    ) => write("info", message, details),

    warn: (
      message: string,
      details?: unknown
    ) => write("warn", message, details),

    error: (
      message: string,
      details?: unknown
    ) => write("error", message, details)
  };
}
