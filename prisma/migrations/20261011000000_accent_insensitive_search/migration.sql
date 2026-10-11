-- Accent-insensitive search: "bronte" finds "Brontë", "bjorn" finds "Bjørn".
--
-- Book.searchText was the lowercased title + authors + series. It is now
-- also accent-folded (foldForSearch in src/lib/utils.ts), and the words
-- typed into search are folded the same way. Existing rows are folded here
-- with the same steps, in the same order, starting from the text that is
-- already lowercased:
--   1. decompose (NFD) so accents become separate combining marks,
--   2. drop the combining marks U+0300 to U+036F,
--   3. recompose (NFC) whatever else was decomposed (kana, hangul),
--   4. spell out letters NFD leaves whole: ø đ ð ł æ œ ß þ.
-- If foldForSearch changes, rows saved before the change keep the old
-- folding until the book is edited, so change both together.
UPDATE "Book"
SET "searchText" =
  replace(replace(replace(replace(
    translate(
      normalize(regexp_replace(normalize("searchText", NFD), '[̀-ͯ]', '', 'g'), NFC),
      'øđðł', 'oddl'
    ),
    'æ', 'ae'), 'œ', 'oe'), 'ß', 'ss'), 'þ', 'th');
