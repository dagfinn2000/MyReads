-- CreateTable
CREATE TABLE "DeletedBook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverUrl" TEXT,
    "data" JSONB NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedBook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeletedBook_userId_deletedAt_idx" ON "DeletedBook"("userId", "deletedAt");

-- AddForeignKey
ALTER TABLE "DeletedBook" ADD CONSTRAINT "DeletedBook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
