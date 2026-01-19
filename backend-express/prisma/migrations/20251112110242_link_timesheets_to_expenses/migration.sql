/*
  Warnings:

  - You are about to drop the column `expenses` on the `timesheets` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "timesheets" DROP COLUMN "expenses",
ADD COLUMN     "expense_id" INTEGER;

-- CreateIndex
CREATE INDEX "timesheets_expense_id_idx" ON "timesheets"("expense_id");

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "onetime_expenses"("expense_id") ON DELETE SET NULL ON UPDATE CASCADE;
