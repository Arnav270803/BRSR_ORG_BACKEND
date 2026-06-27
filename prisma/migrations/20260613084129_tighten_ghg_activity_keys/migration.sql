/*
  Warnings:

  - Made the column `subtype` on table `ghg_activities` required. This step will fail if there are existing NULL values in that column.
  - Made the column `variant` on table `ghg_activities` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ghg_activities" ALTER COLUMN "subtype" SET NOT NULL,
ALTER COLUMN "subtype" SET DEFAULT '',
ALTER COLUMN "variant" SET NOT NULL,
ALTER COLUMN "variant" SET DEFAULT '';
