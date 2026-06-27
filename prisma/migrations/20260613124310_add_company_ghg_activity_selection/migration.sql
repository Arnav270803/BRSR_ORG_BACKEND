-- CreateTable
CREATE TABLE "reporting_years" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reporting_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_ghg_activity_selections" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "reporting_year_id" UUID NOT NULL,
    "ghg_activity_id" UUID NOT NULL,
    "custom_label" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "selected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabled_at" TIMESTAMP(3),
    "selected_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_ghg_activity_selections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reporting_years_company_id_idx" ON "reporting_years"("company_id");

-- CreateIndex
CREATE INDEX "reporting_years_is_active_idx" ON "reporting_years"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "reporting_years_company_id_label_key" ON "reporting_years"("company_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "reporting_years_company_id_start_date_end_date_key" ON "reporting_years"("company_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "company_ghg_activity_selections_company_id_reporting_year_i_idx" ON "company_ghg_activity_selections"("company_id", "reporting_year_id");

-- CreateIndex
CREATE INDEX "company_ghg_activity_selections_ghg_activity_id_idx" ON "company_ghg_activity_selections"("ghg_activity_id");

-- CreateIndex
CREATE INDEX "company_ghg_activity_selections_is_enabled_idx" ON "company_ghg_activity_selections"("is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "company_ghg_activity_selections_reporting_year_id_ghg_activ_key" ON "company_ghg_activity_selections"("reporting_year_id", "ghg_activity_id");

-- AddForeignKey
ALTER TABLE "reporting_years" ADD CONSTRAINT "reporting_years_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_ghg_activity_selections" ADD CONSTRAINT "company_ghg_activity_selections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_ghg_activity_selections" ADD CONSTRAINT "company_ghg_activity_selections_reporting_year_id_fkey" FOREIGN KEY ("reporting_year_id") REFERENCES "reporting_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_ghg_activity_selections" ADD CONSTRAINT "company_ghg_activity_selections_ghg_activity_id_fkey" FOREIGN KEY ("ghg_activity_id") REFERENCES "ghg_activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_ghg_activity_selections" ADD CONSTRAINT "company_ghg_activity_selections_selected_by_user_id_fkey" FOREIGN KEY ("selected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
