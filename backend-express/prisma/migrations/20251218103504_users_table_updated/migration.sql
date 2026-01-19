/*
  Warnings:

  - A unique constraint covering the columns `[user_code]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "date_of_joining" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "user_code" TEXT,
ADD COLUMN     "user_type" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_user_code_key" ON "users"("user_code");

-- CreateIndex
CREATE INDEX "users_user_code_idx" ON "users"("user_code");
