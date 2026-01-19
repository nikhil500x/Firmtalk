-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "date_from" TIMESTAMP(3),
ADD COLUMN     "date_to" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "invoice_timesheets" (
    "invoice_id" INTEGER NOT NULL,
    "timesheet_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_timesheets_pkey" PRIMARY KEY ("invoice_id","timesheet_id")
);

-- CreateIndex
CREATE INDEX "invoice_timesheets_invoice_id_idx" ON "invoice_timesheets"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_timesheets_timesheet_id_idx" ON "invoice_timesheets"("timesheet_id");

-- AddForeignKey
ALTER TABLE "invoice_timesheets" ADD CONSTRAINT "invoice_timesheets_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("invoice_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_timesheets" ADD CONSTRAINT "invoice_timesheets_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("timesheet_id") ON DELETE RESTRICT ON UPDATE CASCADE;
