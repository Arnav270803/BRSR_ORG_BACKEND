-- CreateTable
CREATE TABLE "data_records" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "reporting_year_id" UUID NOT NULL,
    "ghg_activity_selection_id" UUID NOT NULL,
    "ghg_activity_id" UUID NOT NULL,
    "record_date" DATE NOT NULL,
    "quantity" DECIMAL(24,10) NOT NULL,
    "unit" TEXT NOT NULL,
    "factor_kg_co2e" DECIMAL(24,10),
    "calculated_kg_co2e" DECIMAL(24,10),
    "notes" TEXT,
    "metadata" JSONB,
    "created_by_user_id" UUID NOT NULL,
    "deleted_by_user_id" UUID,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_records_company_id_reporting_year_id_idx" ON "data_records"("company_id", "reporting_year_id");

-- CreateIndex
CREATE INDEX "data_records_ghg_activity_selection_id_idx" ON "data_records"("ghg_activity_selection_id");

-- CreateIndex
CREATE INDEX "data_records_ghg_activity_id_idx" ON "data_records"("ghg_activity_id");

-- CreateIndex
CREATE INDEX "data_records_created_by_user_id_idx" ON "data_records"("created_by_user_id");

-- CreateIndex
CREATE INDEX "data_records_deleted_at_idx" ON "data_records"("deleted_at");

-- CreateIndex
CREATE INDEX "data_records_record_date_idx" ON "data_records"("record_date");

-- AddForeignKey
ALTER TABLE "data_records" ADD CONSTRAINT "data_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_records" ADD CONSTRAINT "data_records_reporting_year_id_fkey" FOREIGN KEY ("reporting_year_id") REFERENCES "reporting_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_records" ADD CONSTRAINT "data_records_ghg_activity_selection_id_fkey" FOREIGN KEY ("ghg_activity_selection_id") REFERENCES "company_ghg_activity_selections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_records" ADD CONSTRAINT "data_records_ghg_activity_id_fkey" FOREIGN KEY ("ghg_activity_id") REFERENCES "ghg_activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_records" ADD CONSTRAINT "data_records_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_records" ADD CONSTRAINT "data_records_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
