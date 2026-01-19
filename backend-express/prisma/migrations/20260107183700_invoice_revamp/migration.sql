-- DropForeignKey
ALTER TABLE "public"."invoices" DROP CONSTRAINT "invoices_matter_id_fkey";

-- AlterTable
ALTER TABLE "invoice_timesheets" ADD COLUMN     "billed_amount" DOUBLE PRECISION,
ADD COLUMN     "billed_hours" INTEGER,
ADD COLUMN     "hourly_rate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "amount_in_inr" DOUBLE PRECISION,
ADD COLUMN     "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "discount_type" VARCHAR(20),
ADD COLUMN     "discount_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "final_amount" DOUBLE PRECISION,
ADD COLUMN     "is_multi_matter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "split_percentage" DOUBLE PRECISION,
ADD COLUMN     "split_sequence" INTEGER,
ADD COLUMN     "subtotal" DOUBLE PRECISION,
ADD COLUMN     "uploaded_at" TIMESTAMP(3),
ADD COLUMN     "uploaded_invoice_url" TEXT,
ADD COLUMN     "user_exchange_rate" DOUBLE PRECISION,
ALTER COLUMN "matter_id" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'draft';

-- CreateTable
CREATE TABLE "invoice_matters" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "matter_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_matters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_partner_shares" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "partner_user_id" INTEGER NOT NULL,
    "share_percentage" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_partner_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_matters_invoice_id_idx" ON "invoice_matters"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_matters_matter_id_idx" ON "invoice_matters"("matter_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_matters_invoice_id_matter_id_key" ON "invoice_matters"("invoice_id", "matter_id");

-- CreateIndex
CREATE INDEX "invoice_partner_shares_invoice_id_idx" ON "invoice_partner_shares"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_partner_shares_partner_user_id_idx" ON "invoice_partner_shares"("partner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_partner_shares_invoice_id_partner_user_id_key" ON "invoice_partner_shares"("invoice_id", "partner_user_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("matter_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_matters" ADD CONSTRAINT "invoice_matters_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("invoice_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_matters" ADD CONSTRAINT "invoice_matters_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("matter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_partner_shares" ADD CONSTRAINT "invoice_partner_shares_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("invoice_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_partner_shares" ADD CONSTRAINT "invoice_partner_shares_partner_user_id_fkey" FOREIGN KEY ("partner_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
