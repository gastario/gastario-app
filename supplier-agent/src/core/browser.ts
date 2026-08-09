import fs from "node:fs";
import {
  chromium,
  type Browser,
  type BrowserContext
} from "playwright-core";

import { agentConfig } from "./config.js";
import { createLogger } from "./logger.js";

const logger =
  createLogger(agentConfig.logLevel);

export interface AgentBrowser {
  context: BrowserContext;
  browser: Browser | null;
  mode:
    | "PERSISTENT_CONTEXT"
    | "CDP";
  close(): Promise<void>;
}

export async function openAgentBrowser():
Promise<AgentBrowser> {
  if (agentConfig.cdpUrl) {
    logger.info(
      "Connecting to Chrome over CDP",
      {
        cdpUrl: agentConfig.cdpUrl
      }
    );

    const browser =
      await chromium.connectOverCDP(
        agentConfig.cdpUrl
      );

    const context =
      browser.contexts()[0];

    if (!context) {
      throw new Error(
        "CDP browser has no default context."
      );
    }

    return {
      context,
      browser,
      mode: "CDP",
      close: async () => {
        // Nur die Playwright-Verbindung schließen.
        // Der externe Chrome-Prozess soll nicht absichtlich beendet werden.
        await browser.close();
      }
    };
  }

  fs.mkdirSync(
    agentConfig.profileDir,
    {
      recursive: true
    }
  );

  logger.info(
    "Launching dedicated persistent supplier browser",
    {
      profileDir:
        agentConfig.profileDir,
      headless:
        agentConfig.headless
    }
  );

  const context =
    await chromium.launchPersistentContext(
      agentConfig.profileDir,
      {
        channel:
          agentConfig.chromeExecutable
            ? undefined
            : "chrome",

        executablePath:
          agentConfig.chromeExecutable ||
          undefined,

        headless:
          agentConfig.headless,

        viewport: null,

        acceptDownloads: false
      }
    );

  return {
    context,
    browser: null,
    mode:
      "PERSISTENT_CONTEXT",
    close: async () => {
      await context.close();
    }
  };
}
