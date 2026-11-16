-- Why a book was put down (lib/stop-reasons.ts), while it's Did Not Finish.
ALTER TABLE "Book" ADD COLUMN "stopReason" TEXT;
