import {
  importGlobalSupplierCatalogRows,
  parseGlobalSupplierCatalogCsv,
} from "./global-supplier-catalog-import.server";
import { distributeGlobalSupplierCatalog } from "./global-supplier-catalog-distribution.server";
import type { SupplierCatalogImportRow } from "./supplier-catalog-import.server";

export async function refreshGlobalSupplierCatalogRows(
  params: {
    providerCode: string;
    rows: SupplierCatalogImportRow[];
    distribute?: boolean;
    tenantId?: string | null;
    supplierId?: string | null;
    onlyActiveGlobalItems?: boolean;
    perTenantLimit?: number;
  }
) {
  const imported =
    await importGlobalSupplierCatalogRows({
      providerCode:
        params.providerCode,
      rows:
        params.rows,
    });

  const distribution =
    params.distribute === false
      ? null
      : await distributeGlobalSupplierCatalog({
          providerCode:
            imported.providerCode,
          tenantId:
            params.tenantId,
          supplierId:
            params.supplierId,
          onlyActiveGlobalItems:
            params.onlyActiveGlobalItems,
          perTenantLimit:
            params.perTenantLimit,
        });

  return {
    providerCode:
      imported.providerCode,
    import: {
      total:
        imported.total,
      valid:
        imported.valid,
      created:
        imported.created,
      updated:
        imported.updated,
      skipped:
        imported.skipped,
      importedAt:
        imported.importedAt,
    },
    distribution,
  };
}

export async function refreshGlobalSupplierCatalogCsv(
  params: {
    providerCode: string;
    csvText: string;
    distribute?: boolean;
    tenantId?: string | null;
    supplierId?: string | null;
    onlyActiveGlobalItems?: boolean;
    perTenantLimit?: number;
  }
) {
  const preview =
    parseGlobalSupplierCatalogCsv(
      params.csvText
    );

  if (
    preview.fatalError
  ) {
    throw new Error(
      preview.fatalError
    );
  }

  if (
    preview.summary.valid === 0
  ) {
    throw new Error(
      "Die Datei enthält keine gültigen Katalogartikel."
    );
  }

  const refresh =
    await refreshGlobalSupplierCatalogRows({
      providerCode:
        params.providerCode,
      rows:
        preview.rows,
      distribute:
        params.distribute,
      tenantId:
        params.tenantId,
      supplierId:
        params.supplierId,
      onlyActiveGlobalItems:
        params.onlyActiveGlobalItems,
      perTenantLimit:
        params.perTenantLimit,
    });

  return {
    preview: {
      total:
        preview.summary.total,
      valid:
        preview.summary.valid,
      warnings:
        preview.summary.warnings,
      errors:
        preview.summary.errors,
    },
    ...refresh,
  };
}
