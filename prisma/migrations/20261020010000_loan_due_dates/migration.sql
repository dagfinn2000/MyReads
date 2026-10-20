-- When a lent copy is due back. Null = no date was agreed.
ALTER TABLE "Loan" ADD COLUMN "dueAt" TIMESTAMP(3);
