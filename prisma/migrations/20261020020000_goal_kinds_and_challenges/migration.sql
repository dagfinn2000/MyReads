-- Goals counted in reading days, goals for each month as well as the year,
-- and challenges: a goal for a slice of the library ("6 classics in 2026").

ALTER TYPE "GoalUnit" ADD VALUE 'DAYS';

CREATE TYPE "GoalSpan" AS ENUM ('YEAR', 'MONTH');
ALTER TABLE "ReadingGoal" ADD COLUMN "span" "GoalSpan" NOT NULL DEFAULT 'YEAR';

-- A year can now have two goals: one for the year, one for each month.
DROP INDEX "ReadingGoal_userId_year_key";
CREATE UNIQUE INDEX "ReadingGoal_userId_year_span_key" ON "ReadingGoal"("userId", "year", "span");

CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "target" INTEGER NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Challenge_userId_year_idx" ON "Challenge"("userId", "year");

ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
