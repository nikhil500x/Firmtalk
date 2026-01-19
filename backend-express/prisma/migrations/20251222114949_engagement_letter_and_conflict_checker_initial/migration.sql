-- AlterTable
ALTER TABLE "matters" ADD COLUMN     "conflict_raise_tokens" JSONB,
ADD COLUMN     "conflict_status" TEXT,
ADD COLUMN     "engagement_letter_url" TEXT,
ADD COLUMN     "has_conflict" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "matter_conflicts" (
    "conflict_id" SERIAL NOT NULL,
    "matter_id" INTEGER NOT NULL,
    "raised_by" INTEGER NOT NULL,
    "conflict_type" TEXT NOT NULL,
    "conflict_description" TEXT NOT NULL,
    "conflict_details" TEXT,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolved_by" INTEGER,
    "resolution_notes" TEXT,
    "raised_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matter_conflicts_pkey" PRIMARY KEY ("conflict_id")
);

-- CreateIndex
CREATE INDEX "matter_conflicts_matter_id_idx" ON "matter_conflicts"("matter_id");

-- CreateIndex
CREATE INDEX "matter_conflicts_raised_by_idx" ON "matter_conflicts"("raised_by");

-- CreateIndex
CREATE INDEX "matter_conflicts_status_idx" ON "matter_conflicts"("status");

-- CreateIndex
CREATE INDEX "matter_conflicts_severity_idx" ON "matter_conflicts"("severity");

-- CreateIndex
CREATE INDEX "matters_has_conflict_idx" ON "matters"("has_conflict");

-- AddForeignKey
ALTER TABLE "matter_conflicts" ADD CONSTRAINT "matter_conflicts_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("matter_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_conflicts" ADD CONSTRAINT "matter_conflicts_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_conflicts" ADD CONSTRAINT "matter_conflicts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
