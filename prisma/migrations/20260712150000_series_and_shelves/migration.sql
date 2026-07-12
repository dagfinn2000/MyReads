-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "seriesName" TEXT,
ADD COLUMN     "seriesNumber" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Shelf" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shelf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BookToShelf" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BookToShelf_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shelf_userId_name_key" ON "Shelf"("userId", "name");

-- CreateIndex
CREATE INDEX "_BookToShelf_B_index" ON "_BookToShelf"("B");

-- AddForeignKey
ALTER TABLE "Shelf" ADD CONSTRAINT "Shelf_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookToShelf" ADD CONSTRAINT "_BookToShelf_A_fkey" FOREIGN KEY ("A") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookToShelf" ADD CONSTRAINT "_BookToShelf_B_fkey" FOREIGN KEY ("B") REFERENCES "Shelf"("id") ON DELETE CASCADE ON UPDATE CASCADE;

