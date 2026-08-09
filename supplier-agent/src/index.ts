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

import {
  SupplierNetworkRecorder
} from "./core/network-recorder.js";

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

  if (command === "record") {
    const supplierKey =
      String(
        process.argv[3] || ""
      )
        .trim()
        .toLowerCase();

    const adapter =
      registry
        .all()
        .find(
          (candidate) =>
            candidate.key ===
            supplierKey
        );

    if (!adapter) {
      throw new Error(
        "Unknown supplier for recording. Use one of: " +
          registry
            .all()
            .map(
              (candidate) =>
                candidate.key
            )
            .join(", ")
      );
    }

    const recorder =
      new SupplierNetworkRecorder(
        adapter.key
      );

    const unsubscribe =
      network.subscribe(
        async (event) => {
          if (
            event.observation
              .supplierKey !==
            adapter.key
          ) {
            return;
          }

          await recorder.record(
            event
          );
        }
      );

    let page =
      browser.context
        .pages()
        .find(
          (candidate) =>
            adapter.matchesUrl(
              candidate.url()
            )
        );

    if (!page) {
      page =
        await browser.context
          .newPage();
    }

    const firstHost =
      adapter.hosts[0];

    if (
      firstHost &&
      !adapter.matchesUrl(
        page.url()
      )
    ) {
      await page.goto(
        `https://${firstHost}`,
        {
          waitUntil:
            "domcontentloaded",
          timeout:
            45_000
        }
      );
    }

    logger.info(
      "Supplier network recording active",
      {
        supplier:
          adapter.key,
        file:
          recorder.filePath,
        instructions:
          "Im Browser anmelden, nach mehreren Artikeln suchen und Produktseiten öffnen. Ctrl+C beendet die Aufzeichnung."
      }
    );

    try {
      await waitForever();
    } finally {
      unsubscribe();
      await browser.close();
    }

    logger.info(
      "Supplier network recording stopped",
      {
        file:
          recorder.filePath
      }
    );

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
