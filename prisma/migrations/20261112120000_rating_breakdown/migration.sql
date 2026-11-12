-- Ratings broken down: the plot, the characters and the writing, each in
-- the same 1-10 half-star units as the overall rating.
ALTER TABLE "Book" ADD COLUMN "plotRating" INTEGER,
ADD COLUMN "charactersRating" INTEGER,
ADD COLUMN "writingRating" INTEGER;
