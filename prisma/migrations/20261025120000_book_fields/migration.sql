-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "fieldSearchText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "fields" JSONB;
