import os from "node:os";
import path from "node:path";

function envBoolean(
  value: string | undefined,
  fallback: boolean
) {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  return /^(1|true|yes|on)$/i.test(value.trim());
}

const defaultProfileDir = path.join(
  process.env.LOCALAPPDATA ||
    path.join(os.homedir(), "AppData", "Local"),
  "Gastario",
  "SupplierAgent",
  "chrome-profile"
);

export const agentConfig = {
  profileDir:
    process.env.SUPPLIER_AGENT_PROFILE_DIR?.trim() ||
    defaultProfileDir,

  cdpUrl:
    process.env.SUPPLIER_AGENT_CDP_URL?.trim() ||
    null,

  chromeExecutable:
    process.env.SUPPLIER_AGENT_CHROME_EXECUTABLE?.trim() ||
    null,

  headless: envBoolean(
    process.env.SUPPLIER_AGENT_HEADLESS,
    false
  ),

  logLevel:
    process.env.SUPPLIER_AGENT_LOG_LEVEL?.trim() ||
    "info",

  networkBodyLimitBytes: 5_000_000,
  networkObservationLimit: 250
} as const;
