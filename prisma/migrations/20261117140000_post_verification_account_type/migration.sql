ALTER TABLE "User"
ADD COLUMN "accountTypeSelectedAt" TIMESTAMP(3);

UPDATE "User"
SET "accountTypeSelectedAt" = CURRENT_TIMESTAMP
WHERE "onboardingCompletedAt" IS NOT NULL;
