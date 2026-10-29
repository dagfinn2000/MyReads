# Performance

MyReads should feel smooth on a cheap phone and still look the way it
does: every theme, the glass ones included, the animations and the reading
room. So a change made for speed must leave the screen exactly as it was.
Each one here was checked by comparing screenshots of the build before and
after, pixel for pixel, in several themes and at phone and desktop widths.

## Measuring

`npm run perf` loads pages and taps through the app in a real browser
against a running build, as a mid-range Android phone would: a 390 × 844
screen at three times the pixels, the processor slowed six times, and for
page loads a slow 4G connection.

```bash
npm run build && npm start      # a production build, never the dev server
MYREADS_USER=me MYREADS_PASSWORD=… npm run perf          # loads and taps
MYREADS_USER=me MYREADS_PASSWORD=… npm run perf -- taps  # taps only
```

It needs Playwright and its Chromium, which the app itself doesn't
(`npm install --no-save playwright && npx playwright install chromium`).
`BASE`, `RUNS`, `CPU` and `THEME` change where, how often and how hard it
measures. Measure an account with a few hundred books: an empty library
hides most of what matters. The script writes nothing to the account.

What the numbers mean:

- **Response**: from a tap to the next frame the browser draws, the
  interaction delay that browsers report as INP. On a real phone under
  200 ms feels instant; six times slower, expect several times that.
- **Shown**: from the tap until its result is on the screen, a trip to
  the server included.
- **Blocking**: how long the page's tasks held up input while it loaded,
  past 50 ms each (total blocking time).
- **Shift**: how far things moved as the page loaded (cumulative layout
  shift); under 0.1 is good.

One run varies by a tenth or more. To judge a change, measure the build
before it and the build after it in turns, three runs or more each, and
compare medians.

## Last measured

29 October 2026, the test library (250 books, 44 being read), light theme,
three runs each, medians. "Before" is the app as it was when this page was
written; "after" is with the changes below.

Page loads, cold, on slow 4G:

| Page | Blocking, before | Blocking, after | Elements, before | Elements, after |
| --- | ---: | ---: | ---: | ---: |
| Library (`/books`) | 1,550 ms | 1,180 ms | 4,386 | 4,386 |
| Now reading (`/reading`) | 2,260 ms | 950 ms | 3,974 | 3,755 |
| Reading room (`/room`) | 3,960 ms | 2,460 ms | 6,030 | 1,289 |
| Quotes (`/quotes`) | 860 ms | 760 ms | 2,262 | 2,263 |
| Stats (`/stats`) | 630 ms | 750 ms | 1,083 | 1,084 |

First paint stayed at about 1.5 s and the largest paint between 1.8 and
2.7 s on every page; Stats was not changed, and its difference is the
noise between runs. Now reading no longer shifts as it loads (0.017 to
0); the reading room still does (0.10), as its house is laid out in the
browser.

Taps:

| Tap | Response, before | Response, after | Shown, before | Shown, after |
| --- | ---: | ---: | ---: | ---: |
| Open the format list | 1,000 ms | 470 ms | 1,480 ms | 940 ms |
| Pick a format | 660 ms | 340 ms | 2,130 ms | 1,580 ms |
| Open the sort list | 1,110 ms | 610 ms | 1,580 ms | 1,060 ms |
| Open the View menu | 1,180 ms | 650 ms | 1,670 ms | 1,290 ms |
| Start picking books | 830 ms | 740 ms | 1,410 ms | 1,300 ms |
| Pick a book | 480 ms | 410 ms | 1,210 ms | 1,040 ms |
| Open a book | 690 ms | 600 ms | 2,590 ms | 2,620 ms |
| Go to Now reading | 210 ms | 190 ms | 5,300 ms | 4,030 ms |
| Open the theme palette | 540 ms | 590 ms | 1,070 ms | 1,150 ms |

Runs taking turns between the two builds found more: ticking a second
or third book went from about 430 to 150 ms and from 520 to 250 ms,
leaving the picking from 500 to 350 ms, closing Manage shelves from 420
to 180 ms, and a new sort was shown in 2.0 s rather than 2.9 s.

## Rules

What keeps the app quick, with the test that guards each where one can.

- **Draw only what is on screen.** Library cards and Now reading rows off
  screen are skipped (`.card-skip`, `content-visibility: auto`) until they
  come near it; see DEVELOPMENT.md, "A slow phone only draws what it
  shows".
- **Opening a menu, list or dialog restyles nothing but itself.** Radix
  stops the page behind an open layer scrolling and taking the pointer,
  through a custom property and `pointer-events: none` on `<body>`. Both
  are inherited, so each opening and closing restyled every element on
  the page. The property is registered as not inherited, `<body>` keeps
  its own `pointer-events`, and an empty shield over the window takes the
  taps behind the layer instead
  ([globals.css](../src/app/globals.css),
  [motion-css.test.ts](../src/lib/motion-css.test.ts)). A tap outside still
  closes the layer and reaches nothing behind it.
- **Redraw only what changed.** A list of things (library cards, Now
  reading rows) is memoised item by item and compared as data, since each
  trip to the server sends every item again as a new object. Anything
  handed to such an item has to stay the same between renders for that to
  work: handlers through `useCallback` or a ref, derived lists through
  `useMemo`, and the preferences, which `PreferencesProvider` keeps as one
  object while they are equal.
- **A closed list draws no items.** A closed Radix Select still draws
  every item, off the page, so its button can show the chosen one.
  `lazyList` ([ui/select.tsx](../src/components/ui/select.tsx)) draws them
  when the button is first focused or pressed, for a Select whose
  `SelectValue` is given the chosen item's text. Use it for any Select
  repeated on a page or holding many items.
- **Don't ask the server again for what is already on its way.** The
  library's sort and grouping are in the address it goes to, so saving
  them on the account redraws nothing (`rememberLibraryView`). An action
  that revalidates already brings the page drawn again, so
  `router.refresh()` after it draws it twice.
- **Draw a repeated icon once.** The star and book icons are a sprite the
  root layout draws once ([icon-sprite.tsx](../src/components/icon-sprite.tsx)),
  and a rating's rows of stars are handed over as markup, made once per
  size ([stars.test.ts](../src/components/stars.test.ts) checks it is the
  same markup the components drew).
- **The reading room is light to draw.** Its pixel art is drawn as paths,
  one per run of a paint, not one `<rect>` per rectangle
  ([room-art.test.ts](../src/components/room-art.test.ts) checks every dot
  gets the same paints); the art of a piece is drawn the first time it is
  shown, not every piece as the page loads; and the house is built in a
  transition, so a tap meanwhile is answered.
- **Motion stays on the compositor.** See DEVELOPMENT.md: no
  `transition-all`, transitions held off while a theme changes, a 3D
  layer only for a cover that tilts, and moving backgrounds as Web
  Animations ([motion-css.test.ts](../src/lib/motion-css.test.ts)).
- **Pictures come at the size they are shown.** Covers come in smaller
  copies, chosen by the browser from the size of their box
  ([cover-src.ts](../src/lib/cover-src.ts)).
- **Fonts come early.** Geist, the default face, is preloaded; the Linux
  desktop themes' faces are asked for by the script that applies the
  theme before the first paint ([themes.ts](../src/lib/themes.ts)).

## Still to do

Measured, and left for later:

- Code that only runs on demand loads with every page: the Kindle import,
  the quote card picture, the celebrations, the scanners and the bulk
  scan-add.
- The reading room lays out its house only once the page is running in
  the browser, as it needs the page's width; it could keep the house's
  height from the first paint for a reader whose window hasn't changed.
- The theme pictures and textures in `public/` are checked with the
  server on every hard load; giving them content-hashed names would let
  them be kept.
- Opening a book is mostly the cover's flight and the book page itself.
- Opening a Radix menu or list is still a few hundred milliseconds of
  Radix's own work at six times slower.
