-- Trigram indexes for the two case-insensitive substring lookups the app
-- issues. Both compile to LIKE/ILIKE patterns, which no btree can serve — they
-- were sequential scans over every book in the library.
--
-- Verified against a 20k-row table: library search goes from a full scan to a
-- bitmap index scan (~1ms), and the series lookup likewise.
--
-- A functional lower("seriesName") btree was written first and deliberately
-- dropped: Prisma compiles `mode: "insensitive"` to ILIKE (~~*), which never
-- uses it. It would have been an index that cost writes and served nothing.
--
-- Deliberately its own migration, ordered last: CREATE EXTENSION needs
-- privileges a managed Postgres may withhold. If it fails there, this is the
-- only migration that fails, everything before it stays applied, and both
-- queries keep working exactly as they do today — just without the index.
-- The docker-compose Postgres runs as superuser and applies it fine.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Library text search: `searchText contains …` -> LIKE '%term%'.
CREATE INDEX "Book_searchText_trgm_idx" ON "Book" USING GIN ("searchText" gin_trgm_ops);

-- Series sidebar on the book page, plus the series filter and grouping:
-- `seriesName equals … mode: insensitive` -> ILIKE 'name'.
CREATE INDEX "Book_seriesName_trgm_idx" ON "Book" USING GIN ("seriesName" gin_trgm_ops);
