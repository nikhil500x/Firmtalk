-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "external_reference_name" TEXT,
ADD COLUMN     "internal_reference_id" INTEGER,
ADD COLUMN     "notes" TEXT;

-- CreateIndex
CREATE INDEX "clients_internal_reference_id_idx" ON "clients"("internal_reference_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_internal_reference_id_fkey" FOREIGN KEY ("internal_reference_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
