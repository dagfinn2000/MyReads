-- A day to finish a book by (a book club, a library's due date), and who a
-- borrowed copy is from.
ALTER TABLE "Book" ADD COLUMN "finishBy" TIMESTAMP(3),
ADD COLUMN "borrowedFrom" TEXT;
