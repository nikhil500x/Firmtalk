-- CreateTable
CREATE TABLE "matters" (
    "matter_id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "assigned_lawyer" INTEGER,
    "matter_title" TEXT NOT NULL,
    "description" TEXT,
    "matter_type" TEXT,
    "practice_area" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "estimated_deadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "estimated_value" DOUBLE PRECISION,
    "billing_rate_type" TEXT,
    "opposing_party_name" TEXT,
    "active_status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matters_pkey" PRIMARY KEY ("matter_id")
);

-- CreateTable
CREATE TABLE "matter_users" (
    "matter_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matter_users_pkey" PRIMARY KEY ("matter_id","user_id")
);

-- CreateIndex
CREATE INDEX "matters_client_id_idx" ON "matters"("client_id");

-- CreateIndex
CREATE INDEX "matters_assigned_lawyer_idx" ON "matters"("assigned_lawyer");

-- CreateIndex
CREATE INDEX "matters_status_idx" ON "matters"("status");

-- CreateIndex
CREATE INDEX "matters_practice_area_idx" ON "matters"("practice_area");

-- CreateIndex
CREATE INDEX "matter_users_matter_id_idx" ON "matter_users"("matter_id");

-- CreateIndex
CREATE INDEX "matter_users_user_id_idx" ON "matter_users"("user_id");

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_assigned_lawyer_fkey" FOREIGN KEY ("assigned_lawyer") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_users" ADD CONSTRAINT "matter_users_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("matter_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_users" ADD CONSTRAINT "matter_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
