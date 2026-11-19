ALTER TABLE "Community"
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Community_single_default_idx"
ON "Community" ("isDefault")
WHERE "isDefault" = true;

ALTER TABLE "MusicGroup"
ADD COLUMN "communityId" UUID,
ADD COLUMN "conversationId" UUID;

CREATE UNIQUE INDEX "MusicGroup_conversationId_key"
ON "MusicGroup" ("conversationId");

CREATE INDEX "MusicGroup_communityId_idx"
ON "MusicGroup" ("communityId");

ALTER TABLE "MusicGroup"
ADD CONSTRAINT "MusicGroup_communityId_fkey"
FOREIGN KEY ("communityId") REFERENCES "Community"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MusicGroup"
ADD CONSTRAINT "MusicGroup_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
