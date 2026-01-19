/*
  Warnings:

  - You are about to drop the column `status` on the `timesheets` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."timesheets" DROP CONSTRAINT "timesheets_matter_id_fkey";

-- DropIndex
DROP INDEX "public"."timesheets_status_idx";

-- AlterTable
ALTER TABLE "timesheets" DROP COLUMN "status",
ALTER COLUMN "matter_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("matter_id") ON DELETE SET NULL ON UPDATE CASCADE;
