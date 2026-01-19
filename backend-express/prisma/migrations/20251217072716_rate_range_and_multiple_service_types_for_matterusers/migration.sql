/*
  Warnings:

  - The primary key for the `matter_users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `hourly_rate` on the `user_rate_card` table. All the data in the column will be lost.
  - Made the column `service_type` on table `matter_users` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `max_hourly_rate` to the `user_rate_card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `min_hourly_rate` to the `user_rate_card` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "referral_contact_id" INTEGER,
ADD COLUMN     "referral_partner_id" INTEGER,
ADD COLUMN     "referral_source" TEXT;

-- AlterTable
ALTER TABLE "contacts" ALTER COLUMN "tags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "matter_users" DROP CONSTRAINT "matter_users_pkey",
ALTER COLUMN "service_type" SET NOT NULL,
ADD CONSTRAINT "matter_users_pkey" PRIMARY KEY ("matter_id", "user_id", "service_type");

-- AlterTable
ALTER TABLE "user_rate_card" DROP COLUMN "hourly_rate",
ADD COLUMN     "max_hourly_rate" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "min_hourly_rate" DOUBLE PRECISION NOT NULL;

-- CreateTable
CREATE TABLE "opportunities" (
    "opportunity_id" SERIAL NOT NULL,
    "client_id" INTEGER,
    "contact_id" INTEGER,
    "matter_id" INTEGER,
    "opportunity_name" TEXT NOT NULL,
    "description" TEXT,
    "practice_area" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'prospect',
    "probability" INTEGER NOT NULL DEFAULT 0,
    "estimated_value" DOUBLE PRECISION,
    "expected_close_date" TIMESTAMP(3),
    "source" TEXT,
    "lost_reason" TEXT,
    "won_notes" TEXT,
    "assigned_to" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("opportunity_id")
);

-- CreateTable
CREATE TABLE "leads" (
    "lead_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "score" INTEGER NOT NULL DEFAULT 0,
    "assigned_to" INTEGER,
    "converted_to_client_id" INTEGER,
    "converted_to_contact_id" INTEGER,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "practice_area_interest" TEXT,
    "estimated_value" DOUBLE PRECISION,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("lead_id")
);

-- CreateTable
CREATE TABLE "crm_automations" (
    "automation_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "trigger_conditions" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "action_data" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_automations_pkey" PRIMARY KEY ("automation_id")
);

-- CreateIndex
CREATE INDEX "opportunities_client_id_idx" ON "opportunities"("client_id");

-- CreateIndex
CREATE INDEX "opportunities_contact_id_idx" ON "opportunities"("contact_id");

-- CreateIndex
CREATE INDEX "opportunities_assigned_to_idx" ON "opportunities"("assigned_to");

-- CreateIndex
CREATE INDEX "opportunities_stage_idx" ON "opportunities"("stage");

-- CreateIndex
CREATE INDEX "opportunities_practice_area_idx" ON "opportunities"("practice_area");

-- CreateIndex
CREATE INDEX "opportunities_created_by_idx" ON "opportunities"("created_by");

-- CreateIndex
CREATE INDEX "leads_assigned_to_idx" ON "leads"("assigned_to");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_source_idx" ON "leads"("source");

-- CreateIndex
CREATE INDEX "leads_converted_to_client_id_idx" ON "leads"("converted_to_client_id");

-- CreateIndex
CREATE INDEX "leads_converted_to_contact_id_idx" ON "leads"("converted_to_contact_id");

-- CreateIndex
CREATE INDEX "crm_automations_is_active_idx" ON "crm_automations"("is_active");

-- CreateIndex
CREATE INDEX "crm_automations_trigger_type_idx" ON "crm_automations"("trigger_type");

-- CreateIndex
CREATE INDEX "matter_users_service_type_idx" ON "matter_users"("service_type");

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("contact_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("matter_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_to_client_id_fkey" FOREIGN KEY ("converted_to_client_id") REFERENCES "clients"("client_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_to_contact_id_fkey" FOREIGN KEY ("converted_to_contact_id") REFERENCES "contacts"("contact_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_automations" ADD CONSTRAINT "crm_automations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
