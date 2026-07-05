-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "CompanySiteType" AS ENUM ('OFFICE', 'PLANT', 'WAREHOUSE', 'BRANCH', 'FACTORY', 'OTHER');

-- CreateEnum
CREATE TYPE "CompanySiteStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "company_sites" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CompanySiteType" NOT NULL DEFAULT 'OTHER',
    "country" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "CompanySiteStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_site_memberships" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'USER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_site_memberships_pkey" PRIMARY KEY ("id")
);

-- Backfill one primary site for every existing company.
INSERT INTO "company_sites" (
    "id",
    "company_id",
    "name",
    "type",
    "country",
    "state",
    "city",
    "address",
    "is_primary",
    "status",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    "id",
    'Primary Site',
    'OTHER',
    "country",
    "state",
    "city",
    "registered_address",
    true,
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "companies";

-- Add nullable first so existing records can be backfilled safely.
ALTER TABLE "company_ghg_activity_selections" ADD COLUMN "site_id" UUID;
ALTER TABLE "data_records" ADD COLUMN "site_id" UUID;

UPDATE "company_ghg_activity_selections" AS "selection"
SET "site_id" = "site"."id"
FROM "company_sites" AS "site"
WHERE "site"."company_id" = "selection"."company_id"
  AND "site"."is_primary" = true;

UPDATE "data_records" AS "record"
SET "site_id" = "site"."id"
FROM "company_sites" AS "site"
WHERE "site"."company_id" = "record"."company_id"
  AND "site"."is_primary" = true;

ALTER TABLE "company_ghg_activity_selections" ALTER COLUMN "site_id" SET NOT NULL;
ALTER TABLE "data_records" ALTER COLUMN "site_id" SET NOT NULL;

-- Backfill active users onto the primary site so existing users do not lose access.
INSERT INTO "company_site_memberships" (
    "id",
    "company_id",
    "site_id",
    "user_id",
    "role",
    "status",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    "membership"."company_id",
    "site"."id",
    "membership"."user_id",
    "membership"."role",
    "membership"."status",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "company_memberships" AS "membership"
JOIN "company_sites" AS "site"
  ON "site"."company_id" = "membership"."company_id"
 AND "site"."is_primary" = true
WHERE "membership"."status" = 'ACTIVE';

-- Replace company/year uniqueness with company/year/site uniqueness.
DROP INDEX "company_ghg_activity_selections_reporting_year_id_ghg_activ_key";

-- CreateIndex
CREATE UNIQUE INDEX "company_sites_company_id_name_key" ON "company_sites"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "company_sites_one_primary_per_company_key" ON "company_sites"("company_id") WHERE "is_primary" = true;

-- CreateIndex
CREATE INDEX "company_sites_company_id_idx" ON "company_sites"("company_id");

-- CreateIndex
CREATE INDEX "company_sites_company_id_is_primary_idx" ON "company_sites"("company_id", "is_primary");

-- CreateIndex
CREATE INDEX "company_sites_status_idx" ON "company_sites"("status");

-- CreateIndex
CREATE UNIQUE INDEX "company_site_memberships_site_id_user_id_key" ON "company_site_memberships"("site_id", "user_id");

-- CreateIndex
CREATE INDEX "company_site_memberships_company_id_user_id_idx" ON "company_site_memberships"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "company_site_memberships_site_id_idx" ON "company_site_memberships"("site_id");

-- CreateIndex
CREATE INDEX "company_site_memberships_user_id_idx" ON "company_site_memberships"("user_id");

-- CreateIndex
CREATE INDEX "company_site_memberships_status_idx" ON "company_site_memberships"("status");

-- CreateIndex
CREATE UNIQUE INDEX "company_ghg_activity_selections_reporting_year_site_act_key" ON "company_ghg_activity_selections"("reporting_year_id", "site_id", "ghg_activity_id");

-- CreateIndex
CREATE INDEX "company_ghg_activity_selections_company_site_year_idx" ON "company_ghg_activity_selections"("company_id", "site_id", "reporting_year_id");

-- CreateIndex
CREATE INDEX "company_ghg_activity_selections_site_id_idx" ON "company_ghg_activity_selections"("site_id");

-- CreateIndex
CREATE INDEX "data_records_company_site_year_idx" ON "data_records"("company_id", "site_id", "reporting_year_id");

-- CreateIndex
CREATE INDEX "data_records_site_id_idx" ON "data_records"("site_id");

-- AddForeignKey
ALTER TABLE "company_sites" ADD CONSTRAINT "company_sites_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_site_memberships" ADD CONSTRAINT "company_site_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_site_memberships" ADD CONSTRAINT "company_site_memberships_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "company_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_site_memberships" ADD CONSTRAINT "company_site_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_ghg_activity_selections" ADD CONSTRAINT "company_ghg_activity_selections_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "company_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_records" ADD CONSTRAINT "data_records_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "company_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
