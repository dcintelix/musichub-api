CREATE TYPE "BookingStatus" AS ENUM ('Pending', 'Accepted', 'Declined', 'Cancelled', 'Completed');

ALTER TABLE "Notification" ADD COLUMN "actionUrl" TEXT;
ALTER TABLE "OpportunityApplication" ADD COLUMN "reviewMessage" TEXT;

CREATE TABLE "BookingRequest" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "musicianId" UUID NOT NULL,
    "eventTitle" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "budget" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "responseMessage" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingRequest_requesterId_status_createdAt_idx" ON "BookingRequest"("requesterId", "status", "createdAt");
CREATE INDEX "BookingRequest_musicianId_status_createdAt_idx" ON "BookingRequest"("musicianId", "status", "createdAt");

ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_requesterId_fkey"
FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_musicianId_fkey"
FOREIGN KEY ("musicianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
