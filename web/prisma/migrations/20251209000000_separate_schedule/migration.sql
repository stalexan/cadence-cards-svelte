-- AlterTable: Add deck-level settings for bidirectional study
ALTER TABLE "Deck" ADD COLUMN "field1Label" TEXT;
ALTER TABLE "Deck" ADD COLUMN "field2Label" TEXT;
ALTER TABLE "Deck" ADD COLUMN "isBidirectional" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: Schedule table for SM-2 state per study direction
CREATE TABLE "Schedule" (
    "id" SERIAL NOT NULL,
    "cardId" INTEGER NOT NULL,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "easiness" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "repCount" INTEGER NOT NULL DEFAULT 0,
    "grade" "CardGrade",
    "lastSeen" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_cardId_isReversed_key" ON "Schedule"("cardId", "isReversed");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing SM-2 data from Card to Schedule (forward direction only)
INSERT INTO "Schedule" ("cardId", "isReversed", "easiness", "interval", "repCount", "grade", "lastSeen", "updatedAt")
SELECT "id", false, "easiness", "interval", "repCount", "grade", "lastSeen", CURRENT_TIMESTAMP FROM "Card";

-- Remove SM-2 columns from Card (keep priority and tags)
ALTER TABLE "Card" DROP COLUMN "easiness";
ALTER TABLE "Card" DROP COLUMN "interval";
ALTER TABLE "Card" DROP COLUMN "repCount";
ALTER TABLE "Card" DROP COLUMN "grade";
ALTER TABLE "Card" DROP COLUMN "lastSeen";

