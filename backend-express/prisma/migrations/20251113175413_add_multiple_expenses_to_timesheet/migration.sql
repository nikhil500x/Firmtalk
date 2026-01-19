/*
  Warnings:

  - You are about to drop the column `expense_id` on the `timesheets` table. All the data in the column will be lost.
  - You are about to drop the column `expense_included` on the `timesheets` table. All the data in the column will be lost.
  - Made the column `matter_id` on table `invoices` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."invoices" DROP CONSTRAINT "invoices_matter_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."timesheets" DROP CONSTRAINT "timesheets_expense_id_fkey";

-- DropIndex
DROP INDEX "public"."timesheets_expense_id_idx";

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "matter_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "onetime_expenses" ADD COLUMN     "expense_included" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "timesheet_id" INTEGER;

-- AlterTable
ALTER TABLE "timesheets" DROP COLUMN "expense_id",
DROP COLUMN "expense_included";

-- CreateIndex
CREATE INDEX "onetime_expenses_timesheet_id_idx" ON "onetime_expenses"("timesheet_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("matter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onetime_expenses" ADD CONSTRAINT "onetime_expenses_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("timesheet_id") ON DELETE SET NULL ON UPDATE CASCADE;
