-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "currency_conversion_rate" DOUBLE PRECISION,
ADD COLUMN     "invoice_amount_in_matter_currency" DOUBLE PRECISION,
ADD COLUMN     "invoice_currency" TEXT,
ADD COLUMN     "matter_currency" TEXT;

-- AlterTable
ALTER TABLE "matters" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR';

-- AlterTable
ALTER TABLE "onetime_expenses" ADD COLUMN     "amount_currency" TEXT NOT NULL DEFAULT 'INR';

-- AlterTable
ALTER TABLE "timesheets" ADD COLUMN     "calculated_amount_currency" TEXT,
ADD COLUMN     "hourly_rate_conversion_rate" DOUBLE PRECISION,
ADD COLUMN     "hourly_rate_currency" TEXT DEFAULT 'INR';
