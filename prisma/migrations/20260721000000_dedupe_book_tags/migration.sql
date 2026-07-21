-- Deduplicate Book.tags in place, first occurrence winning. The add/edit
-- form previously didn't dedupe the comma-separated tags field, so metadata
-- subjects differing only in case ("Fiction", "fiction") could land on a
-- book twice — breaking React keys wherever tags render. The form now
-- dedupes; this cleans up rows saved before the fix.
UPDATE "Book" b
SET "tags" = d.tags
FROM (
  SELECT id, array_agg(tag ORDER BY first_ord) AS tags
  FROM (
    SELECT b2."id" AS id, t.tag AS tag, min(t.ord) AS first_ord
    FROM "Book" b2
    CROSS JOIN LATERAL unnest(b2."tags") WITH ORDINALITY AS t(tag, ord)
    GROUP BY b2."id", t.tag
  ) u
  GROUP BY id
) d
WHERE b."id" = d.id AND d.tags IS DISTINCT FROM b."tags";
