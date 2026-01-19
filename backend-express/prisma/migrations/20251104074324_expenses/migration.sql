-- DropIndex
DROP INDEX "public"."users_email_idx";

-- AlterTable
ALTER TABLE "client_groups" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "contacts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "leaves" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "matters" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "timesheets" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "vendors" (
    "vendor_id" SERIAL NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "contact_person" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "pan_card_number" TEXT,
    "bank_name" TEXT,
    "account_number" TEXT,
    "ifsc_code" TEXT,
    "payment_terms" TEXT,
    "notes" TEXT,
    "active_status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("vendor_id")
);

-- CreateTable
CREATE TABLE "onetime_expenses" (
    "expense_id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "sub_category" TEXT,
    "description" TEXT NOT NULL,
    "vendor_id" INTEGER,
    "amount" DOUBLE PRECISION NOT NULL,
    "due_date" TIMESTAMP(3),
    "matter_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "receipt_url" TEXT,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "notes" TEXT,
    "recorded_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onetime_expenses_pkey" PRIMARY KEY ("expense_id")
);

-- CreateTable
CREATE TABLE "recurring_expenses" (
    "expense_id" SERIAL NOT NULL,
    "recurring_type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "recurrence_type" TEXT NOT NULL DEFAULT 'monthly',
    "cycle_day" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "user_id" INTEGER,
    "gross_salary" DOUBLE PRECISION,
    "deductions" DOUBLE PRECISION,
    "net_salary" DOUBLE PRECISION,
    "sub_category" TEXT,
    "vendor_id" INTEGER,
    "software_name" TEXT,
    "description" TEXT,
    "seats_licenses" INTEGER,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("expense_id")
);

-- CreateTable
CREATE TABLE "expense_payments" (
    "payment_id" SERIAL NOT NULL,
    "onetime_expense_id" INTEGER,
    "recurring_expense_id" INTEGER,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "payment_for_month" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "payment_method" TEXT NOT NULL,
    "transaction_ref" TEXT,
    "notes" TEXT,
    "recorded_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_payments_pkey" PRIMARY KEY ("payment_id")
);

-- CreateIndex
CREATE INDEX "vendors_vendor_name_idx" ON "vendors"("vendor_name");

-- CreateIndex
CREATE INDEX "onetime_expenses_vendor_id_idx" ON "onetime_expenses"("vendor_id");

-- CreateIndex
CREATE INDEX "onetime_expenses_matter_id_idx" ON "onetime_expenses"("matter_id");

-- CreateIndex
CREATE INDEX "onetime_expenses_category_idx" ON "onetime_expenses"("category");

-- CreateIndex
CREATE INDEX "onetime_expenses_status_idx" ON "onetime_expenses"("status");

-- CreateIndex
CREATE INDEX "recurring_expenses_recurring_type_idx" ON "recurring_expenses"("recurring_type");

-- CreateIndex
CREATE INDEX "recurring_expenses_user_id_idx" ON "recurring_expenses"("user_id");

-- CreateIndex
CREATE INDEX "recurring_expenses_vendor_id_idx" ON "recurring_expenses"("vendor_id");

-- CreateIndex
CREATE INDEX "recurring_expenses_status_idx" ON "recurring_expenses"("status");

-- CreateIndex
CREATE INDEX "recurring_expenses_start_date_idx" ON "recurring_expenses"("start_date");

-- CreateIndex
CREATE INDEX "expense_payments_onetime_expense_id_idx" ON "expense_payments"("onetime_expense_id");

-- CreateIndex
CREATE INDEX "expense_payments_recurring_expense_id_idx" ON "expense_payments"("recurring_expense_id");

-- CreateIndex
CREATE INDEX "expense_payments_payment_date_idx" ON "expense_payments"("payment_date");

-- AddForeignKey
ALTER TABLE "onetime_expenses" ADD CONSTRAINT "onetime_expenses_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("vendor_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onetime_expenses" ADD CONSTRAINT "onetime_expenses_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("matter_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onetime_expenses" ADD CONSTRAINT "onetime_expenses_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onetime_expenses" ADD CONSTRAINT "onetime_expenses_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("vendor_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_payments" ADD CONSTRAINT "expense_payments_onetime_expense_id_fkey" FOREIGN KEY ("onetime_expense_id") REFERENCES "onetime_expenses"("expense_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_payments" ADD CONSTRAINT "expense_payments_recurring_expense_id_fkey" FOREIGN KEY ("recurring_expense_id") REFERENCES "recurring_expenses"("expense_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_payments" ADD CONSTRAINT "expense_payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
