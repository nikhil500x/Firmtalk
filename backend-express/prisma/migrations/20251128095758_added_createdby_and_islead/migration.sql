-- AlterTable
ALTER TABLE "client_groups" ADD COLUMN     "created_by" INTEGER;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "created_by" INTEGER;

-- AlterTable
ALTER TABLE "matter_users" ADD COLUMN     "is_lead" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "matters" ADD COLUMN     "created_by" INTEGER;

-- AlterTable
ALTER TABLE "user_rate_card" ADD COLUMN     "created_by" INTEGER;

-- CreateIndex
CREATE INDEX "client_groups_created_by_idx" ON "client_groups"("created_by");

-- CreateIndex
CREATE INDEX "contacts_created_by_idx" ON "contacts"("created_by");

-- CreateIndex
CREATE INDEX "matters_created_by_idx" ON "matters"("created_by");

-- CreateIndex
CREATE INDEX "user_rate_card_created_by_idx" ON "user_rate_card"("created_by");

-- AddForeignKey
ALTER TABLE "client_groups" ADD CONSTRAINT "client_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_rate_card" ADD CONSTRAINT "user_rate_card_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
