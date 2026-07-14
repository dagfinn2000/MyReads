-- CreateTable
CREATE TABLE "Read" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "dateStarted" TIMESTAMP(3),
    "dateFinished" TIMESTAMP(3),
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Read_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Read_bookId_dateFinished_idx" ON "Read"("bookId", "dateFinished");

-- AddForeignKey
ALTER TABLE "Read" ADD CONSTRAINT "Read_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: materialize the re-read history that `timesRead` already implies.
-- The Book row keeps the latest read, so a finished book (status READ) with
-- timesRead = 3 gets 2 undated past-read rows; an unfinished book with
-- timesRead = 2 (read twice before, now re-reading or reshelved) gets 2.
-- Undated is honest — we never knew when those earlier reads happened.
INSERT INTO "Read" ("id", "bookId", "createdAt")
SELECT gen_random_uuid()::text, b."id", b."createdAt"
FROM "Book" b
CROSS JOIN LATERAL generate_series(
  1,
  GREATEST(b."timesRead" - (CASE WHEN b."status" = 'READ' THEN 1 ELSE 0 END), 0)
) AS s(n);
