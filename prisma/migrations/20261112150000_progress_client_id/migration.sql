-- Offline logging: the id the browser gave a log, so a log sent twice
-- (saved offline, or sent again after the connection dropped) is written
-- once.
ALTER TABLE "ProgressEntry" ADD COLUMN "clientId" TEXT;

CREATE UNIQUE INDEX "ProgressEntry_bookId_clientId_key" ON "ProgressEntry"("bookId", "clientId");
