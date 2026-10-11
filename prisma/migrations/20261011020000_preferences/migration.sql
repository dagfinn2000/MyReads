-- User preferences (lib/preferences.ts)
ALTER TABLE "User" ADD COLUMN "preferences" JSONB;

-- Reading goals in pages, and goals that leave out re-reads
CREATE TYPE "GoalUnit" AS ENUM ('BOOKS', 'PAGES');
ALTER TABLE "ReadingGoal" ADD COLUMN "unit" "GoalUnit" NOT NULL DEFAULT 'BOOKS';
ALTER TABLE "ReadingGoal" ADD COLUMN "countRereads" BOOLEAN NOT NULL DEFAULT true;

-- Saved library views
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedView_userId_name_key" ON "SavedView"("userId", "name");

ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
