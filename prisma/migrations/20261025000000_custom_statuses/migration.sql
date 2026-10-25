-- The reader's own reading statuses (lib/statuses.ts): a book can be on one,
-- built on its built-in status.
ALTER TABLE "Book" ADD COLUMN "statusKey" TEXT;
