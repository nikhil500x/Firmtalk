/*
  Warnings:

  - The primary key for the `matter_users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `matter_id` to the `user_rate_card` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "billing_location_id" INTEGER;

-- AlterTable
ALTER TABLE "matter_users" DROP CONSTRAINT "matter_users_pkey",
ALTER COLUMN "service_type" DROP NOT NULL,
ADD CONSTRAINT "matter_users_pkey" PRIMARY KEY ("matter_id", "user_id");

-- AlterTable
ALTER TABLE "matters" ADD COLUMN     "matter_location_id" INTEGER;

-- AlterTable
ALTER TABLE "user_rate_card" ADD COLUMN     "currency_conversion_rate" DOUBLE PRECISION,
ADD COLUMN     "matter_id" INTEGER NOT NULL,
ALTER COLUMN "service_type" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "location_id" INTEGER;

-- CreateTable
CREATE TABLE "locations" (
    "location_id" SERIAL NOT NULL,
    "location_code" TEXT NOT NULL,
    "location_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "office_address" TEXT,
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "address_line_3" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "website" TEXT,
    "timezone" TEXT DEFAULT 'Asia/Kolkata',
    "gst_number" TEXT,
    "is_billing_location" BOOLEAN NOT NULL DEFAULT false,
    "active_status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("location_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locations_location_code_key" ON "locations"("location_code");

-- CreateIndex
CREATE INDEX "locations_location_code_idx" ON "locations"("location_code");

-- CreateIndex
CREATE INDEX "locations_is_billing_location_idx" ON "locations"("is_billing_location");

-- CreateIndex
CREATE INDEX "matters_matter_location_id_idx" ON "matters"("matter_location_id");

-- CreateIndex
CREATE INDEX "users_location_id_idx" ON "users"("location_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_matter_location_id_fkey" FOREIGN KEY ("matter_location_id") REFERENCES "locations"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_rate_card" ADD CONSTRAINT "user_rate_card_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("matter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billing_location_id_fkey" FOREIGN KEY ("billing_location_id") REFERENCES "locations"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;
