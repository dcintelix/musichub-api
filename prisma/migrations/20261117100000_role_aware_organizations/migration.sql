ALTER TABLE "User"
ADD COLUMN "accountType" TEXT NOT NULL DEFAULT 'Musician',
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

UPDATE "User"
SET "onboardingCompletedAt" = CURRENT_TIMESTAMP
WHERE "onboardingCompletedAt" IS NULL;

ALTER TABLE "Organization"
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "location" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Post"
ADD COLUMN "organizationId" UUID;

CREATE INDEX "Post_organizationId_idx" ON "Post"("organizationId");

ALTER TABLE "Post"
ADD CONSTRAINT "Post_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Opportunity"
ADD CONSTRAINT "Opportunity_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Opportunity_organizationId_idx" ON "Opportunity"("organizationId");
