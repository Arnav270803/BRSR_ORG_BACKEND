-- CreateTable
CREATE TABLE "ghg_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "source_sheet" TEXT NOT NULL,
    "scope" TEXT,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ghg_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ghg_activities" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "source_sheet" TEXT NOT NULL,
    "source_year" INTEGER,
    "source_version" TEXT,
    "source_row" INTEGER NOT NULL,
    "scope" TEXT,
    "activity" TEXT NOT NULL,
    "subtype" TEXT,
    "variant" TEXT,
    "unit" TEXT NOT NULL,
    "factor_kg_co2e" DECIMAL(24,10),
    "factor_data" JSONB,
    "raw_data" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ghg_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ghg_categories_source_sheet_key" ON "ghg_categories"("source_sheet");

-- CreateIndex
CREATE INDEX "ghg_categories_scope_idx" ON "ghg_categories"("scope");

-- CreateIndex
CREATE INDEX "ghg_categories_is_active_idx" ON "ghg_categories"("is_active");

-- CreateIndex
CREATE INDEX "ghg_activities_category_id_idx" ON "ghg_activities"("category_id");

-- CreateIndex
CREATE INDEX "ghg_activities_scope_idx" ON "ghg_activities"("scope");

-- CreateIndex
CREATE INDEX "ghg_activities_activity_idx" ON "ghg_activities"("activity");

-- CreateIndex
CREATE INDEX "ghg_activities_unit_idx" ON "ghg_activities"("unit");

-- CreateIndex
CREATE INDEX "ghg_activities_is_active_idx" ON "ghg_activities"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ghg_activities_source_sheet_source_row_unit_activity_subtyp_key" ON "ghg_activities"("source_sheet", "source_row", "unit", "activity", "subtype", "variant");

-- AddForeignKey
ALTER TABLE "ghg_activities" ADD CONSTRAINT "ghg_activities_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ghg_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
