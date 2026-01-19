-- CreateTable
CREATE TABLE "contact_relationships" (
    "relationship_id" SERIAL NOT NULL,
    "from_contact_id" INTEGER NOT NULL,
    "to_contact_id" INTEGER NOT NULL,
    "relationship_type" TEXT NOT NULL DEFAULT 'reports_to',
    "line_style" TEXT NOT NULL DEFAULT 'solid',
    "line_color" TEXT,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_relationships_pkey" PRIMARY KEY ("relationship_id")
);

-- CreateTable
CREATE TABLE "contact_badges" (
    "badge_id" SERIAL NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "badge_type" TEXT NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_badges_pkey" PRIMARY KEY ("badge_id")
);

-- CreateTable
CREATE TABLE "contact_interactions" (
    "interaction_id" SERIAL NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "interaction_type" TEXT NOT NULL,
    "interaction_data" TEXT NOT NULL,
    "related_entity_type" TEXT,
    "related_entity_id" INTEGER,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_interactions_pkey" PRIMARY KEY ("interaction_id")
);

-- CreateIndex
CREATE INDEX "contact_relationships_from_contact_id_idx" ON "contact_relationships"("from_contact_id");

-- CreateIndex
CREATE INDEX "contact_relationships_to_contact_id_idx" ON "contact_relationships"("to_contact_id");

-- CreateIndex
CREATE INDEX "contact_relationships_relationship_type_idx" ON "contact_relationships"("relationship_type");

-- CreateIndex
CREATE UNIQUE INDEX "contact_relationships_from_contact_id_to_contact_id_relatio_key" ON "contact_relationships"("from_contact_id", "to_contact_id", "relationship_type");

-- CreateIndex
CREATE INDEX "contact_badges_contact_id_idx" ON "contact_badges"("contact_id");

-- CreateIndex
CREATE INDEX "contact_badges_badge_type_idx" ON "contact_badges"("badge_type");

-- CreateIndex
CREATE UNIQUE INDEX "contact_badges_contact_id_badge_type_key" ON "contact_badges"("contact_id", "badge_type");

-- CreateIndex
CREATE INDEX "contact_interactions_contact_id_idx" ON "contact_interactions"("contact_id");

-- CreateIndex
CREATE INDEX "contact_interactions_interaction_type_idx" ON "contact_interactions"("interaction_type");

-- CreateIndex
CREATE INDEX "contact_interactions_created_at_idx" ON "contact_interactions"("created_at");

-- CreateIndex
CREATE INDEX "contact_interactions_related_entity_type_related_entity_id_idx" ON "contact_interactions"("related_entity_type", "related_entity_id");

-- AddForeignKey
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_from_contact_id_fkey" FOREIGN KEY ("from_contact_id") REFERENCES "contacts"("contact_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_to_contact_id_fkey" FOREIGN KEY ("to_contact_id") REFERENCES "contacts"("contact_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_badges" ADD CONSTRAINT "contact_badges_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("contact_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_badges" ADD CONSTRAINT "contact_badges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_interactions" ADD CONSTRAINT "contact_interactions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("contact_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_interactions" ADD CONSTRAINT "contact_interactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
