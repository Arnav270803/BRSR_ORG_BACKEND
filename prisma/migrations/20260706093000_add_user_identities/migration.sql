-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'LINKEDIN');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "google_sub" DROP NOT NULL;

-- CreateTable
CREATE TABLE "user_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

-- Backfill existing Google users as identities.
INSERT INTO "user_identities" (
    "id",
    "user_id",
    "provider",
    "provider_user_id",
    "email",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    "id",
    'GOOGLE'::"AuthProvider",
    "google_sub",
    "email",
    "created_at",
    "updated_at"
FROM "users"
WHERE "google_sub" IS NOT NULL
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE INDEX "user_identities_user_id_idx" ON "user_identities"("user_id");

-- CreateIndex
CREATE INDEX "user_identities_email_idx" ON "user_identities"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_provider_user_id_key" ON "user_identities"("provider", "provider_user_id");

-- AddForeignKey
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
