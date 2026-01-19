-- CreateTable
CREATE TABLE "user_activities" (
    "activity_id" SERIAL NOT NULL,
    "action_type" TEXT NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("activity_id")
);

-- CreateTable
CREATE TABLE "user_notifications" (
    "notification_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateIndex
CREATE INDEX "user_activities_actor_id_idx" ON "user_activities"("actor_id");

-- CreateIndex
CREATE INDEX "user_activities_entity_type_entity_id_idx" ON "user_activities"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "user_activities_action_type_idx" ON "user_activities"("action_type");

-- CreateIndex
CREATE INDEX "user_activities_created_at_idx" ON "user_activities"("created_at");

-- CreateIndex
CREATE INDEX "user_notifications_user_id_is_read_idx" ON "user_notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "user_notifications_activity_id_idx" ON "user_notifications"("activity_id");

-- CreateIndex
CREATE INDEX "user_notifications_created_at_idx" ON "user_notifications"("created_at");

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "user_activities"("activity_id") ON DELETE CASCADE ON UPDATE CASCADE;
