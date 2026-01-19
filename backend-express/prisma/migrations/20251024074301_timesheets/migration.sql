-- CreateTable
CREATE TABLE "timesheets" (
    "timesheet_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "matter_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours_worked" DOUBLE PRECISION NOT NULL,
    "billable_hours" DOUBLE PRECISION NOT NULL,
    "non_billable_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activity_type" TEXT NOT NULL,
    "description" TEXT,
    "hourly_rate" DOUBLE PRECISION,
    "calculated_amount" DOUBLE PRECISION,
    "expenses" DOUBLE PRECISION DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "last_update" TIMESTAMP(3),
    "approved_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("timesheet_id")
);

-- CreateIndex
CREATE INDEX "timesheets_user_id_idx" ON "timesheets"("user_id");

-- CreateIndex
CREATE INDEX "timesheets_matter_id_idx" ON "timesheets"("matter_id");

-- CreateIndex
CREATE INDEX "timesheets_date_idx" ON "timesheets"("date");

-- CreateIndex
CREATE INDEX "timesheets_status_idx" ON "timesheets"("status");

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("matter_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
