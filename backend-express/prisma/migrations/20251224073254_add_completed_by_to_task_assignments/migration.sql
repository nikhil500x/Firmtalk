-- AlterTable
ALTER TABLE "task_assignments" ADD COLUMN     "completed_by" INTEGER;

-- CreateIndex
CREATE INDEX "task_assignments_completed_by_idx" ON "task_assignments"("completed_by");

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
