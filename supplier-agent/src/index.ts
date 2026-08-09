import {
  createSupplierRegistry
} from "./adapters/index.js";

import {
  openAgentBrowser
} from "./core/browser.js";

import {
  agentConfig
} from "./core/config.js";

import {
  createLogger
} from "./core/logger.js";

import {
  NetworkCapture
} from "./core/network-capture.js";

const logger =
  createLogger(
    agentConfig.logLevel
  );

async function waitForever() {
  await new Promise<void>(
    (resolve) => {
      const stop = () =>
        resolve();

      process.once(
        "SIGINT",
        stop
      );

      process.once(
        "SIGTERM",
        stop
      );
    }
  );
}

async function main() {
  const command =
    process.argv[2] ||
    "health";

  const registry =
    createSupplierRegistry();

  const browser =
    await openAgentBrowser();

  const network =
    new NetworkCapture(
      registry
    );

  network.start(
    browser.context
  );

  logger.info(
    "Supplier Agent started",
    {
      mode:
        browser.mode,
      profileDir:
        browser.mode ===
        "PERSISTENT_CONTEXT"
          ? agentConfig.profileDir
          : null,
      adapters:
        registry
          .all()
          .map(
            (adapter) => ({
              key:
                adapter.key,
              displayName:
                adapter.displayName,
              hosts:
                adapter.hosts
            })
          )
    }
  );

  if (command === "health") {
    const pages =
      browser.context
        .pages()
        .map((page) => ({
          url: page.url(),
          supplier:
            registry.byUrl(
              page.url()
            )?.key ||
            null
        }));

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode:
            browser.mode,
          profileDir:
            browser.mode ===
            "PERSISTENT_CONTEXT"
              ? agentConfig.profileDir
              : null,
          adapters:
            registry
              .all()
              .map(
                (adapter) =>
                  adapter.key
              ),
          pages
        },
        null,
        2
      )
    );

    await browser.close();
    return;
  }

  if (command === "browser") {
    logger.info(
      "Dedicated supplier browser is running. Log into supplier shops here. Ctrl+C stops the agent."
    );

    await waitForever();
    await browser.close();
    return;
  }

  throw new Error(
    `Unknown command: ${command}`
  );
}

main().catch((error) => {
  logger.error(
    "Supplier Agent failed",
    error instanceof Error
      ? {
          message:
            error.message,
          stack:
            error.stack
        }
      : String(error)
  );

  process.exitCode = 1;
});
