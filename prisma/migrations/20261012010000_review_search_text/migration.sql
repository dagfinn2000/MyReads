-- Review search in SQL: Book.reviewSearchText is the review folded like
-- searchText (foldForSearch in src/lib/utils.ts), so searching reviews is a
-- `contains` per word instead of reading every review into the app.
ALTER TABLE "Book" ADD COLUMN "reviewSearchText" TEXT NOT NULL DEFAULT '';

-- Existing reviews are folded here with foldForSearch's steps, in its order:
--   0. lowercase,
--   1. decompose (NFD) so accents become separate combining marks,
--   2. drop the combining marks U+0300 to U+036F,
--   3. recompose (NFC) whatever else was decomposed (kana, hangul),
--   4. spell out letters NFD leaves whole: ø đ ð ł æ œ ß þ.
-- Steps 1 to 4 are the 20261011000000_accent_insensitive_search migration's.
-- Step 0 is new: lower() follows the collation, and the database's own may
-- only know ASCII, so it uses ICU's root locale where Postgres has ICU (as
-- the postgres images do), which lowercases the way JavaScript does.
DO $do$
DECLARE
  coll text := CASE
    WHEN EXISTS (SELECT 1 FROM pg_collation WHERE collname = 'und-x-icu') THEN '"und-x-icu"'
    ELSE '"default"'
  END;
BEGIN
  EXECUTE format($sql$
    UPDATE "Book"
    SET "reviewSearchText" =
      replace(replace(replace(replace(
        translate(
          normalize(regexp_replace(normalize(lower("review" COLLATE %s), NFD), '[̀-ͯ]', '', 'g'), NFC),
          'øđðł', 'oddl'
        ),
        'æ', 'ae'), 'œ', 'oe'), 'ß', 'ss'), 'þ', 'th')
    WHERE "review" IS NOT NULL
  $sql$, coll);
END
$do$;
