-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "moods" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Book_moods_idx" ON "Book" USING GIN ("moods");
