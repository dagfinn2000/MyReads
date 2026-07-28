-- Ownership state replaces the `owned` boolean.
--
-- The boolean had to carry two meanings — true = "on my shelf", false = "on
-- the wishlist" — which left no way to say "borrowed from someone" or "read
-- it and no longer have it". Both were previously forced into the wishlist,
-- where they showed up as things to acquire.
--
-- Conversion is exactly the old meaning, so nothing is reinterpreted:
-- true -> OWNED, false -> WISHLIST. The two new states are only ever reached
-- by the user choosing them.
CREATE TYPE "BookOwnership" AS ENUM ('OWNED', 'WISHLIST', 'BORROWED', 'GIVEN_AWAY');

ALTER TABLE "Book" ADD COLUMN "ownership" "BookOwnership" NOT NULL DEFAULT 'OWNED';

UPDATE "Book" SET "ownership" = CASE WHEN "owned" THEN 'OWNED'::"BookOwnership"
                                     ELSE 'WISHLIST'::"BookOwnership" END;

ALTER TABLE "Book" DROP COLUMN "owned";

-- Lending: a copy that went out to someone. An open loan (returnedAt null)
-- means the book is currently lent; returned loans stay as history.
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "borrower" TEXT NOT NULL,
    "lentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Loan_bookId_returnedAt_idx" ON "Loan"("bookId", "returnedAt");
CREATE INDEX "Loan_bookId_lentAt_idx" ON "Loan"("bookId", "lentAt");

ALTER TABLE "Loan" ADD CONSTRAINT "Loan_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
