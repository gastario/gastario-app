ALTER TABLE "SupplierCatalogItem"
ADD COLUMN "searchTokens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "SupplierCatalogItem"
SET "searchTokens" = ARRAY(
  SELECT DISTINCT token
  FROM unnest(
    regexp_split_to_array(
      trim(
        regexp_replace(
          replace(
            translate(
              lower(
                concat_ws(
                  ' ',
                  "name",
                  "brand",
                  "description",
                  "externalId",
                  "articleNumber",
                  "ean",
                  "gtin",
                  "orderUnit",
                  "baseUnit"
                )
              ),
              'äöü',
              'aou'
            ),
            'ß',
            'ss'
          ),
          '[^a-z0-9]+',
          ' ',
          'g'
        )
      ),
      '\s+'
    )
  ) AS token
  WHERE length(token) >= 2
    AND length(token) <= 80
);

CREATE INDEX "SupplierCatalogItem_searchTokens_idx"
ON "SupplierCatalogItem"
USING GIN ("searchTokens");