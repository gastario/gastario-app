import fs from "node:fs";
import path from "node:path";

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
import {
  runMetroSearch
} from "./adapters/metro-native-search.js";

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
  if (command === "search") {
    const supplierKey =
      String(
        process.argv[3] || ""
      )
        .trim()
        .toLowerCase();

    const query =
      process.argv
        .slice(4)
        .join(" ")
        .trim();

    if (
      supplierKey !==
      "metro"
    ) {
      throw new Error(
        "Phase 5B currently supports: metro"
      );
    }

    if (!query) {
      throw new Error(
        'Usage: npm.cmd run dev -- search metro "Tomaten"'
      );
    }

    const adapter =
      registry
        .all()
        .find(
          (candidate) =>
            candidate.key ===
            "metro"
        );

    if (!adapter) {
      throw new Error(
        "METRO adapter is not registered."
      );
    }

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

      await page.goto(
        "https://lieferservice.metro.de",
        {
          waitUntil:
            "domcontentloaded",
          timeout:
            45_000
        }
      );
    }
    const result =
      await runMetroSearch(
        page,
        network,
        query,
        {
          page: 1,
          rows: 80
        }
      );

    console.log(
      JSON.stringify(
        {
          ok: true,
          supplier:
            "metro",
          mode:
            result.mode,
          query:
            result.query,
          status:
            result.status,
          amount:
            result.amount,
          page:
            result.page,
          rows:
            result.rows,
          totalPages:
            result.totalPages,
          resultCount:
            result.resultIds.length,
          additionalVariantCount:
            result.additionalVariantIds.length,
          resultIds:
            result.resultIds,
          additionalVariantIds:
            result.additionalVariantIds
        },
        null,
        2
      )
    );

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
        adapter.key,
        adapter
      );

    /*
     * Raw Network Recorder:
     * Unabhängig von NetworkCapture/Adapter-Parsing mitschneiden,
     * damit auch Suchrequests sichtbar werden, die keine Produkte
     * extrahieren.
     *
     * Die vollständigen URLs bleiben ausschließlich lokal im
     * supplier-agent/artifacts/raw-network Ordner.
     */
    const rawNetworkDir =
      path.join(
        process.cwd(),
        "artifacts",
        "raw-network"
      );

    fs.mkdirSync(
      rawNetworkDir,
      {
        recursive: true
      }
    );

    const rawNetworkFile =
      path.join(
        rawNetworkDir,
        `${adapter.key}-${new Date()
          .toISOString()
          .replace(
            /[:.]/g,
            "-"
          )}.ndjson`
      );

    const rawResponseListener =
      async (
        response:
          import("playwright-core").Response
      ) => {
        const request =
          response.request();

        const url =
          response.url();

        let host = "";

        try {
          host =
            new URL(
              url
            ).hostname;
        } catch {
          return;
        }

        if (
          !adapter.hosts.some(
            (candidateHost) =>
              host === candidateHost ||
              host.endsWith(
                `.${candidateHost}`
              )
          )
        ) {
          return;
        }

        const record = {
          capturedAt:
            new Date()
              .toISOString(),
          method:
            request.method(),
          url,
          status:
            response.status(),
          resourceType:
            request.resourceType(),
          contentType:
            response.headers()[
              "content-type"
            ] || null,
          postData:
            request.postData() || null
        };

        fs.appendFileSync(
          rawNetworkFile,
          JSON.stringify(
            record
          ) + "\n",
          "utf8"
        );
      };

    browser.context.on(
      "response",
      rawResponseListener
    );

    logger.info(
      "Supplier raw network recording active",
      {
        supplier:
          adapter.key,
        file:
          rawNetworkFile
      }
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
      browser.context.off(
        "response",
        rawResponseListener
      );

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
