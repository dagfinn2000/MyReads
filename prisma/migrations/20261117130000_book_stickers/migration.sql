-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "stickers" TEXT[] DEFAULT ARRAY[]::TEXT[];
