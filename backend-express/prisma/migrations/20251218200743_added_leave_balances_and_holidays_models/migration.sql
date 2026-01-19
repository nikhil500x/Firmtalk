-- AlterTable
ALTER TABLE "leaves" ADD COLUMN     "year" INTEGER;

-- CreateTable
CREATE TABLE "leave_balances" (
    "balance_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "leave_type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "total_allocated" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "applied" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("balance_id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "holiday_id" SERIAL NOT NULL,
    "location" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "day" TEXT NOT NULL,
    "occasion" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("holiday_id")
);

-- CreateIndex
CREATE INDEX "leave_balances_user_id_year_idx" ON "leave_balances"("user_id", "year");

-- CreateIndex
CREATE INDEX "leave_balances_leave_type_idx" ON "leave_balances"("leave_type");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_user_id_leave_type_year_key" ON "leave_balances"("user_id", "leave_type", "year");

-- CreateIndex
CREATE INDEX "holidays_location_year_idx" ON "holidays"("location", "year");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_location_date_key" ON "holidays"("location", "date");

-- CreateIndex
CREATE INDEX "leaves_year_idx" ON "leaves"("year");

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
