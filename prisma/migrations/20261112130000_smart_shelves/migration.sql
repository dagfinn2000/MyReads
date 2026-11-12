-- Smart shelves: shelves that fill themselves with every book matching
-- their rules (the library filters, kept as a query string).
CREATE TABLE "SmartShelf" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rules" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartShelf_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmartShelf_userId_name_key" ON "SmartShelf"("userId", "name");

ALTER TABLE "SmartShelf" ADD CONSTRAINT "SmartShelf_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
