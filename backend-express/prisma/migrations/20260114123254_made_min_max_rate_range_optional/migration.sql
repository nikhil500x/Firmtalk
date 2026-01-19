-- AlterTable
ALTER TABLE "user_rate_card" ALTER COLUMN "max_hourly_rate" DROP NOT NULL,
ALTER COLUMN "min_hourly_rate" DROP NOT NULL;
