ALTER TABLE "User"
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 1;

UPDATE "User"
SET "onboardingStep" = 4
WHERE "onboardingCompletedAt" IS NOT NULL;

ALTER TABLE "MusicianProfile"
ADD COLUMN "socialLinks" JSONB,
ADD COLUMN "customGenres" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Organization"
ADD COLUMN "coverImageUrl" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "physicalAddress" TEXT,
ADD COLUMN "socialLinks" JSONB,
ADD COLUMN "registrationNumber" TEXT,
ADD COLUMN "establishedYear" INTEGER;

ALTER TABLE "OrganizationMember"
ADD COLUMN "title" TEXT,
ADD COLUMN "authorizationConfirmedAt" TIMESTAMP(3);
