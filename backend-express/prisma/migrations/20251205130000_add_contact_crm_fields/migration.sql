-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "birthday" TIMESTAMP(3),
ADD COLUMN "anniversary" TIMESTAMP(3),
ADD COLUMN "linkedin_url" TEXT,
ADD COLUMN "twitter_handle" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "preferred_contact_method" TEXT,
ADD COLUMN "timezone" TEXT;

