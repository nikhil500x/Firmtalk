/*
  Warnings:

  - You are about to drop the column `contact_email` on the `clients` table. All the data in the column will be lost.
  - You are about to drop the column `contact_jobtitle` on the `clients` table. All the data in the column will be lost.
  - You are about to drop the column `contact_name` on the `clients` table. All the data in the column will be lost.
  - You are about to drop the column `contact_number` on the `clients` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "clients" DROP COLUMN "contact_email",
DROP COLUMN "contact_jobtitle",
DROP COLUMN "contact_name",
DROP COLUMN "contact_number";

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false;
