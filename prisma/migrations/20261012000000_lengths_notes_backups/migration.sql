-- Audiobook running time, so progress can be logged as time listened
ALTER TABLE "Book" ADD COLUMN "lengthMinutes" INTEGER;

-- A note for each past read
ALTER TABLE "Read" ADD COLUMN "note" TEXT;

-- When the account last downloaded its backup
ALTER TABLE "User" ADD COLUMN "lastBackupAt" TIMESTAMP(3);
