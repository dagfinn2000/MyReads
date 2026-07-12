-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ReadingStatus" AS ENUM ('WANT_TO_READ', 'READING', 'READ', 'DNF');

-- CreateEnum
CREATE TYPE "BookFormat" AS ENUM ('PHYSICAL', 'EBOOK', 'AUDIOBOOK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isbn" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "pageCount" INTEGER,
    "publishedDate" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "format" "BookFormat" NOT NULL DEFAULT 'PHYSICAL',
    "owned" BOOLEAN NOT NULL DEFAULT true,
    "openLibraryId" TEXT,
    "status" "ReadingStatus" NOT NULL DEFAULT 'WANT_TO_READ',
    "rating" INTEGER,
    "review" TEXT,
    "dateStarted" TIMESTAMP(3),
    "dateFinished" TIMESTAMP(3),
    "timesRead" INTEGER NOT NULL DEFAULT 0,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetadataCache" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetadataCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Book_userId_status_idx" ON "Book"("userId", "status");

-- CreateIndex
CREATE INDEX "Book_userId_createdAt_idx" ON "Book"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MetadataCache_source_query_key" ON "MetadataCache"("source", "query");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

