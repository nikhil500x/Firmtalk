-- CreateTable
CREATE TABLE "invoice_expenses" (
    "invoice_id" INTEGER NOT NULL,
    "expense_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billed_amount" DOUBLE PRECISION,
    "billed_amount_currency" TEXT,
    "original_amount" DOUBLE PRECISION NOT NULL,
    "original_currency" TEXT NOT NULL DEFAULT 'INR',
    "exchange_rate" DOUBLE PRECISION,

    CONSTRAINT "invoice_expenses_pkey" PRIMARY KEY ("invoice_id","expense_id")
);

-- CreateIndex
CREATE INDEX "invoice_expenses_invoice_id_idx" ON "invoice_expenses"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_expenses_expense_id_idx" ON "invoice_expenses"("expense_id");

-- AddForeignKey
ALTER TABLE "invoice_expenses" ADD CONSTRAINT "invoice_expenses_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("invoice_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_expenses" ADD CONSTRAINT "invoice_expenses_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "onetime_expenses"("expense_id") ON DELETE RESTRICT ON UPDATE CASCADE;
