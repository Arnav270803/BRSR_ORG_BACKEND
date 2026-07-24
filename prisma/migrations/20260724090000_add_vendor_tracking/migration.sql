-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VendorMembershipRole" AS ENUM ('VENDOR_ADMIN', 'VENDOR_CONTRIBUTOR');

-- CreateEnum
CREATE TYPE "VendorTrackingMode" AS ENUM ('NONE', 'OPTIONAL', 'REQUIRED');

-- CreateEnum
CREATE TYPE "VendorDataRequestStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'IN_PROGRESS',
    'SUBMITTED',
    'APPROVED',
    'CHANGES_REQUESTED',
    'OVERDUE',
    'CANCELLED'
);

-- CreateEnum
CREATE TYPE "DataOrigin" AS ENUM ('INTERNAL', 'VENDOR');

-- AlterTable
ALTER TABLE "companies"
ADD COLUMN "vendor_tracking_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "company_ghg_activity_selections"
ADD COLUMN "vendor_tracking_mode" "VendorTrackingMode" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "data_records"
ADD COLUMN "data_origin" "DataOrigin" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN "vendor_id" UUID,
ADD COLUMN "vendor_submission_record_id" UUID;

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "vendor_code" TEXT,
    "primary_email" TEXT NOT NULL,
    "primary_phone" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "country" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "tax_id" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'PENDING',
    "profile_completed_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_site_assignments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_site_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_memberships" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "VendorMembershipRole" NOT NULL DEFAULT 'VENDOR_CONTRIBUTOR',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_invitations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "VendorMembershipRole" NOT NULL DEFAULT 'VENDOR_ADMIN',
    "token_hash" TEXT NOT NULL,
    "invited_by_user_id" UUID NOT NULL,
    "accepted_by_user_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_data_requests" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "reporting_year_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "due_date" DATE NOT NULL,
    "status" "VendorDataRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "review_notes" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "reviewed_by_user_id" UUID,
    "sent_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "changes_requested_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_data_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_data_request_items" (
    "id" UUID NOT NULL,
    "vendor_data_request_id" UUID NOT NULL,
    "ghg_activity_selection_id" UUID NOT NULL,
    "tracking_mode" "VendorTrackingMode" NOT NULL,
    "instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_data_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_submission_records" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "reporting_year_id" UUID NOT NULL,
    "vendor_data_request_id" UUID NOT NULL,
    "vendor_data_request_item_id" UUID NOT NULL,
    "ghg_activity_selection_id" UUID NOT NULL,
    "record_date" DATE NOT NULL,
    "quantity" DECIMAL(24,10) NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_submission_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendors_company_id_primary_email_key"
ON "vendors"("company_id", "primary_email");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_company_id_vendor_code_key"
ON "vendors"("company_id", "vendor_code");

-- CreateIndex
CREATE INDEX "vendors_company_id_status_idx"
ON "vendors"("company_id", "status");

-- CreateIndex
CREATE INDEX "vendors_display_name_idx"
ON "vendors"("display_name");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_site_assignments_vendor_id_site_id_key"
ON "vendor_site_assignments"("vendor_id", "site_id");

-- CreateIndex
CREATE INDEX "vendor_site_assignments_company_id_site_id_idx"
ON "vendor_site_assignments"("company_id", "site_id");

-- CreateIndex
CREATE INDEX "vendor_site_assignments_vendor_id_idx"
ON "vendor_site_assignments"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_memberships_vendor_id_user_id_key"
ON "vendor_memberships"("vendor_id", "user_id");

-- CreateIndex
CREATE INDEX "vendor_memberships_company_id_user_id_idx"
ON "vendor_memberships"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "vendor_memberships_user_id_status_idx"
ON "vendor_memberships"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_invitations_token_hash_key"
ON "vendor_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "vendor_invitations_company_id_vendor_id_idx"
ON "vendor_invitations"("company_id", "vendor_id");

-- CreateIndex
CREATE INDEX "vendor_invitations_email_expires_at_idx"
ON "vendor_invitations"("email", "expires_at");

-- CreateIndex
CREATE INDEX "vendor_data_requests_company_id_reporting_year_id_site_id_idx"
ON "vendor_data_requests"("company_id", "reporting_year_id", "site_id");

-- CreateIndex
CREATE INDEX "vendor_data_requests_vendor_id_status_idx"
ON "vendor_data_requests"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "vendor_data_requests_due_date_status_idx"
ON "vendor_data_requests"("due_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_data_request_items_request_selection_key"
ON "vendor_data_request_items"("vendor_data_request_id", "ghg_activity_selection_id");

-- CreateIndex
CREATE INDEX "vendor_data_request_items_ghg_activity_selection_id_idx"
ON "vendor_data_request_items"("ghg_activity_selection_id");

-- CreateIndex
CREATE INDEX "vendor_submission_records_vendor_data_request_id_idx"
ON "vendor_submission_records"("vendor_data_request_id");

-- CreateIndex
CREATE INDEX "vendor_submission_records_vendor_data_request_item_id_idx"
ON "vendor_submission_records"("vendor_data_request_item_id");

-- CreateIndex
CREATE INDEX "vendor_submission_records_company_year_site_idx"
ON "vendor_submission_records"("company_id", "reporting_year_id", "site_id");

-- CreateIndex
CREATE INDEX "vendor_submission_records_vendor_id_idx"
ON "vendor_submission_records"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "data_records_vendor_submission_record_id_key"
ON "data_records"("vendor_submission_record_id");

-- CreateIndex
CREATE INDEX "data_records_vendor_id_idx"
ON "data_records"("vendor_id");

-- CreateIndex
CREATE INDEX "data_records_data_origin_idx"
ON "data_records"("data_origin");

-- AddForeignKey
ALTER TABLE "vendors"
ADD CONSTRAINT "vendors_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors"
ADD CONSTRAINT "vendors_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_site_assignments"
ADD CONSTRAINT "vendor_site_assignments_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_site_assignments"
ADD CONSTRAINT "vendor_site_assignments_vendor_id_fkey"
FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_site_assignments"
ADD CONSTRAINT "vendor_site_assignments_site_id_fkey"
FOREIGN KEY ("site_id") REFERENCES "company_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_site_assignments"
ADD CONSTRAINT "vendor_site_assignments_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_memberships"
ADD CONSTRAINT "vendor_memberships_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_memberships"
ADD CONSTRAINT "vendor_memberships_vendor_id_fkey"
FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_memberships"
ADD CONSTRAINT "vendor_memberships_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invitations"
ADD CONSTRAINT "vendor_invitations_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invitations"
ADD CONSTRAINT "vendor_invitations_vendor_id_fkey"
FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invitations"
ADD CONSTRAINT "vendor_invitations_invited_by_user_id_fkey"
FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invitations"
ADD CONSTRAINT "vendor_invitations_accepted_by_user_id_fkey"
FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_data_requests"
ADD CONSTRAINT "vendor_data_requests_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_data_requests"
ADD CONSTRAINT "vendor_data_requests_vendor_id_fkey"
FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_data_requests"
ADD CONSTRAINT "vendor_data_requests_site_id_fkey"
FOREIGN KEY ("site_id") REFERENCES "company_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_data_requests"
ADD CONSTRAINT "vendor_data_requests_reporting_year_id_fkey"
FOREIGN KEY ("reporting_year_id") REFERENCES "reporting_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_data_requests"
ADD CONSTRAINT "vendor_data_requests_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_data_requests"
ADD CONSTRAINT "vendor_data_requests_reviewed_by_user_id_fkey"
FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_data_request_items"
ADD CONSTRAINT "vendor_data_request_items_vendor_data_request_id_fkey"
FOREIGN KEY ("vendor_data_request_id") REFERENCES "vendor_data_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_data_request_items"
ADD CONSTRAINT "vendor_data_request_items_ghg_activity_selection_id_fkey"
FOREIGN KEY ("ghg_activity_selection_id") REFERENCES "company_ghg_activity_selections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_submission_records"
ADD CONSTRAINT "vendor_submission_records_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_submission_records"
ADD CONSTRAINT "vendor_submission_records_vendor_id_fkey"
FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_submission_records"
ADD CONSTRAINT "vendor_submission_records_site_id_fkey"
FOREIGN KEY ("site_id") REFERENCES "company_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_submission_records"
ADD CONSTRAINT "vendor_submission_records_reporting_year_id_fkey"
FOREIGN KEY ("reporting_year_id") REFERENCES "reporting_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_submission_records"
ADD CONSTRAINT "vendor_submission_records_vendor_data_request_id_fkey"
FOREIGN KEY ("vendor_data_request_id") REFERENCES "vendor_data_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_submission_records"
ADD CONSTRAINT "vendor_submission_records_vendor_data_request_item_id_fkey"
FOREIGN KEY ("vendor_data_request_item_id") REFERENCES "vendor_data_request_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_submission_records"
ADD CONSTRAINT "vendor_submission_records_ghg_activity_selection_id_fkey"
FOREIGN KEY ("ghg_activity_selection_id") REFERENCES "company_ghg_activity_selections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_submission_records"
ADD CONSTRAINT "vendor_submission_records_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_records"
ADD CONSTRAINT "data_records_vendor_id_fkey"
FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_records"
ADD CONSTRAINT "data_records_vendor_submission_record_id_fkey"
FOREIGN KEY ("vendor_submission_record_id") REFERENCES "vendor_submission_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
