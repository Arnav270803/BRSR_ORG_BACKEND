-- Preserve the classification and factor source used when each record was calculated.
ALTER TABLE "data_records"
ADD COLUMN "scope" TEXT,
ADD COLUMN "factor_source_sheet" TEXT,
ADD COLUMN "factor_source_year" INTEGER,
ADD COLUMN "factor_source_version" TEXT;

-- Existing records inherit their snapshot values from the permanent GHG catalog.
UPDATE "data_records" AS "record"
SET
    "scope" = "activity"."scope",
    "factor_source_sheet" = "activity"."source_sheet",
    "factor_source_year" = "activity"."source_year",
    "factor_source_version" = "activity"."source_version"
FROM "ghg_activities" AS "activity"
WHERE "activity"."id" = "record"."ghg_activity_id";

CREATE INDEX "data_records_company_site_year_deleted_idx"
ON "data_records"("company_id", "site_id", "reporting_year_id", "deleted_at");
