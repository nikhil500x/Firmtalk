-- DropForeignKey
ALTER TABLE "public"."contacts" DROP CONSTRAINT "contacts_client_id_fkey";

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "external_reference_email" TEXT,
ADD COLUMN     "external_reference_phone" TEXT;

-- AlterTable
ALTER TABLE "contacts" ALTER COLUMN "client_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE SET NULL ON UPDATE CASCADE;
