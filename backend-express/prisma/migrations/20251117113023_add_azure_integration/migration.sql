-- AlterTable
ALTER TABLE "users" ADD COLUMN     "azure_access_token" TEXT,
ADD COLUMN     "azure_connected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "azure_connected_at" TIMESTAMP(3),
ADD COLUMN     "azure_refresh_token" TEXT,
ADD COLUMN     "azure_tenant_id" TEXT,
ADD COLUMN     "azure_token_expires_at" TIMESTAMP(3);
