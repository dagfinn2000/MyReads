-- Indexes for the filters and sorts the app actually issues. Book previously
-- had only (userId, status) and (userId, createdAt), so everything else was a
-- sequential scan over the user's whole library.

-- Tag filter: `tags: { has: … }` is array containment, which a btree cannot
-- serve at all.
CREATE INDEX "Book_tags_idx" ON "Book" USING GIN ("tags");

-- The year pages and the per-year stats filter and order by finish date.
CREATE INDEX "Book_userId_dateFinished_idx" ON "Book" ("userId", "dateFinished");


-- "Do I own this?" looks books up by ISBN in both 10- and 13-digit forms.
CREATE INDEX "Book_userId_isbn_idx" ON "Book" ("userId", "isbn");

-- Quotes are always read newest-first, scoped to a book.
CREATE INDEX "Quote_bookId_createdAt_idx" ON "Quote" ("bookId", "createdAt");
