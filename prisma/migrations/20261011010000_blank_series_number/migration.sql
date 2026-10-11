-- A blank "No. in series" field used to be saved as 0 rather than left
-- empty (z.coerce turns "" into 0), so every book added without a series
-- number has seriesNumber = 0, and shows as "#0" once it gets a series name.
-- The form now saves blank as NULL. This clears the zeros already stored.
--
-- A deliberate #0 (some prequels are numbered 0) can't be told apart from
-- the bug's zeros, so it is cleared too and needs entering again.
UPDATE "Book" SET "seriesNumber" = NULL WHERE "seriesNumber" = 0;
