/*
  Warnings:

  - You are about to alter the column `hours_worked` on the `timesheets` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `billable_hours` on the `timesheets` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `non_billable_hours` on the `timesheets` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - A unique constraint covering the columns `[client_code]` on the table `clients` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "client_code" TEXT,
ADD COLUMN     "client_creation_requested_by" INTEGER;

-- AlterTable
ALTER TABLE "matters" ADD COLUMN     "matter_code" TEXT,
ADD COLUMN     "matter_creation_requested_by" INTEGER;

-- AlterTable
ALTER TABLE "timesheets" ALTER COLUMN "hours_worked" SET DATA TYPE INTEGER,
ALTER COLUMN "billable_hours" SET DATA TYPE INTEGER,
ALTER COLUMN "non_billable_hours" SET DEFAULT 0,
ALTER COLUMN "non_billable_hours" SET DATA TYPE INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "clients_client_code_key" ON "clients"("client_code");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_client_creation_requested_by_fkey" FOREIGN KEY ("client_creation_requested_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_matter_creation_requested_by_fkey" FOREIGN KEY ("matter_creation_requested_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
