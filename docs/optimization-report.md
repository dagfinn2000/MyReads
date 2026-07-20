# MyReads — performance & code-quality findings

> **Phase 2 outcome (2026-07-20):** all of Tier 1 was implemented as
> commits `8394f13`…`ec46438` (findings 1–6, one commit each). Finding 8 was
> implemented per revised instruction — instead of shortening the fallback
> chain, all three sources are now queried in parallel and **all** results
> are shown with source labels, with the cover-picker grid interleaved
> round-robin (`f252691`); this is a deliberate, requested behaviour change.
> Findings 7, 9–17 were not implemented. Every commit built clean, and the
> flows were verified end-to-end against a throwaway local database
> (register → multi-source search → import → cover picker → save → reading
> updates → re-read → stats → library filters) with zero console or server
> errors.

## Phase 1 findings (as reported, pre-implementation)

Investigation pass, 2026-07-20, on `main` @ `f29d2a3`. No code was changed.
Baseline `npm run build` compiles clean; largest route is `/books` at 218 kB
first-load JS, and no heavy libraries are eagerly imported — **client bundle
weight is not a problem** (the barcode scanner uses the native
`BarcodeDetector` API, charts are hand-rolled SVG/divs).

Framing for the impact ratings: this is a single-user app with a
hundreds-to-low-thousands-of-rows database. Postgres scans at that scale are
sub-millisecond, so classic "add indexes / move to SQL" advice matters much
less here than (a) bytes shipped to the browser, (b) external-network latency
on the save/search paths, and (c) correctness. Findings are sorted by
impact-to-risk within each tier.

---

## Tier 1 — recommended (high value, low risk)

### 1. Genuine bug: metadata cache key ignores `limit` → cross-flow collisions
- **Files:** [cache.ts:15-23](../src/lib/metadata/cache.ts) (key is
  `source` + normalized query only); callers with different limits:
  [openlibrary.ts:46-66](../src/lib/metadata/openlibrary.ts),
  [googlebooks.ts:74-85](../src/lib/metadata/googlebooks.ts),
  [nb.ts:78-88](../src/lib/metadata/nb.ts),
  [index.ts:95-99](../src/lib/metadata/index.ts)
- **What's wrong:** `searchOpenLibrary(query, 10)` (search flow) and
  `searchOpenLibrary(titleQuery, 6)` (cover picker, via
  `getCoverCandidates`) share the cache row `("ol-search", query)`. Whichever
  runs first pins the payload for a week: search the same title twice — once
  in the import search, once via "Find covers" — and one of the flows gets
  the other's result count (6 results in the search list, or extra cover
  candidates). Same pattern for `gb-search` and `nb-search`.
- **Fix:** include the limit in the cache key (`${query}|${limit}`), or
  normalize both callers to one limit and slice client-side.
- **Impact:** medium (user-visible inconsistency today) · **Effort:** low ·
  **Risk:** none beyond briefly colder cache after deploy.
- Reported as a bug per the ground rules, not silently folded into a
  refactor.

### 2. `/books` ships every book's full row to the client
- **Files:** [books/page.tsx:185](../src/app/(app)/books/page.tsx) (`findMany`
  with no `select`), [library-view.tsx:33-42](../src/components/library-view.tsx)
  (client component typed on full `Book`),
  [book-card.tsx:38](../src/components/book-card.tsx)
- **What's wrong:** `LibraryView` is a client component, so every book row is
  serialized into the RSC payload/HTML — including `description` (≤10 kB),
  `review` (≤20 kB), `searchText`, `openLibraryId`, `isbn`, timestamps. The
  cards render ~10 scalar fields. A 300-book library with imported
  descriptions ships hundreds of kB of dead text on every library view, on
  every filter/sort navigation (the page is `force-dynamic`, so this repeats
  per interaction).
- **Fix:** select a card-shaped DTO (`id, title, authors, coverUrl, status,
  rating, currentPage, pageCount, seriesName, seriesNumber, tags?,
  dateFinished, createdAt` — the last two feed the sorts) and thread that type
  through `sortBooks` / `groupBooks` / `LibraryView` / `BookCard`.
- **Impact:** high (dominant cost of the most-visited page) · **Effort:**
  medium (type threading; `BookCard` also serves the detail/series/year pages,
  which can pass the same subset) · **Risk:** low — pure narrowing; bulk
  actions and "pick for me" use `id`/`status`/`title`, which stay.

### 3. Cover images load eagerly across the whole grid
- **Files:** [book-card.tsx:21-27](../src/components/book-card.tsx) (`<img>`
  with no `loading` attribute); same pattern in
  [import-search.tsx:155-159](../src/components/import-search.tsx) and
  [check-book-client.tsx:168-173](../src/components/check-book-client.tsx)
- **What's wrong:** the library grid requests every cover at once; a few
  hundred books = a few hundred simultaneous image fetches competing with
  everything else. `cover-picker.tsx` already does this correctly
  (`loading="lazy"`).
- **Fix:** `loading="lazy"` + `decoding="async"` on grid/list `<img>`s.
- **Impact:** medium · **Effort:** trivial · **Risk:** negligible (same
  pixels, better scheduling).

### 4. Redundant/sequential queries on hot pages (batchable round-trips)
- **`/books`** [books/page.tsx:140-149](../src/app/(app)/books/page.tsx):
  the saved-view `user.findUnique` is awaited *before* the `Promise.all`,
  though it only affects sort/group (not the `where`). Fold it into the
  parallel batch — one round-trip saved on every param-less visit.
- **`/books`** [books/page.tsx:191](../src/app/(app)/books/page.tsx): the
  tag list re-fetches `tags` for **all** books alongside the main (often
  identical) fetch. Cheap options: reuse the main result when unfiltered, or
  one `groupBy`-style raw `unnest(tags)` aggregate that returns tag + count
  directly (also replaces the JS counting loop).
- **Book detail** [books/[id]/page.tsx:28-69](../src/app/(app)/books/[id]/page.tsx):
  `allShelves` doesn't depend on the book row — start it before the first
  `await` so it overlaps. `seriesBooks` (line 60) also fetches full rows for
  a cover-strip that needs 5 fields.
- **Stats** [stats/page.tsx:61-69](../src/app/(app)/stats/page.tsx): the
  random quote is a second sequential query (count → skip). A single
  `ORDER BY random() LIMIT 1` raw query joins the `Promise.all`.
- **Export** [export/route.ts:84-94](../src/app/api/export/route.ts): covers
  are read from disk sequentially; `Promise.all` them.
- **Impact:** medium (perceived latency, additive) · **Effort:** low ·
  **Risk:** low — same data, same shapes.

### 5. Minor bug: old cover file deleted before the row update commits
- **File:** [books.ts:91-94](../src/lib/actions/books.ts) (`updateBook`)
- **What's wrong:** when the cover changes, the cached file is unlinked
  *before* `prisma.book.update`. If the update throws (DB hiccup, constraint),
  the row still points at a file that no longer exists → permanently broken
  image.
- **Fix:** reorder — update the row first, delete the orphaned file after.
- **Impact:** low (narrow failure window) · **Effort:** trivial · **Risk:**
  none. Reported as a bug per the ground rules.

### 6. Multi-write actions aren't atomic (`$transaction` candidates)
- **Files:** [reads.ts:41-70](../src/lib/actions/reads.ts) (`readAgain`:
  archive-read → book flip → page-0 anchor as three independent writes — a
  failure between them strands the book in an inconsistent pass state; it
  also fetches the full book row where 4 fields are used),
  [reads.ts:96-101](../src/lib/actions/reads.ts) (`addPastRead` +
  `syncTimesRead` re-fetch), [books.ts:167-190](../src/lib/actions/books.ts)
  (`updateReading` + `logProgress`)
- **Fix:** wrap each action's writes in one `prisma.$transaction`; keep the
  logic identical. `syncTimesRead`'s re-fetch can fold into the same
  transaction.
- **Impact:** low-medium (robustness more than speed; also 1-2 fewer
  round-trips per save) · **Effort:** low · **Risk:** low — same statements,
  now atomic.

---

## Tier 2 — worthwhile, needs a judgement call (please pick)

### 7. Save path blocks on the remote cover download (up to 15 s)
- **Files:** [books.ts:65](../src/lib/actions/books.ts) (`createBook` awaits
  `localizeCover` before `redirect`), [books.ts:115-117](../src/lib/actions/books.ts)
  (`updateBook` same), [covers.ts:33-61](../src/lib/covers.ts) (15 s fetch
  timeout)
- **What's wrong:** "Add to library" waits for the external cover fetch +
  disk write before navigating. On a slow upstream that's a multi-second
  (worst case 15 s) frozen save button.
- **Fix option:** move `localizeCover` into Next 15's `after()` so the
  redirect returns immediately and the download completes post-response.
- **The judgement call:** the very first render of the detail page may then
  show the *remote* cover URL (the localized path lands a beat later — a
  refresh shows it). End state is identical; the transition is observable.
  Strictly read, that bends "no observable behaviour change", so I won't do
  it without your OK.
- **Impact:** medium-high on the add flow · **Effort:** low · **Risk:** the
  described transient only.

### 8. Metadata search worst-case latency (sequential 3-provider fallback)
- **File:** [index.ts:18-24](../src/lib/metadata/index.ts)
- **What's wrong:** OL → Google → nb.no run sequentially with 10 s timeouts
  each; when OL is down and the query is Norwegian, a search can take ~20-30 s
  before results appear.
- **The judgement call:** racing all three in parallel and picking by
  priority keeps the same *result* but always hits all providers (more
  upstream traffic, defeats the deliberate "NB only as last resort" design).
  A middle ground: keep sequential but shorten the timeout for the fallback
  hops. Tell me which you prefer — or leave as-is; the DB cache already
  absorbs repeats.

### 9. Stats/heatmap aggregation in JS vs SQL
- **Files:** [stats/page.tsx:53-56](../src/app/(app)/stats/page.tsx) and
  [stats/year/[year]/page.tsx:108-112](../src/app/(app)/stats/year/[year]/page.tsx)
  fetch **every** `ProgressEntry`; [progress.ts:46-65](../src/lib/progress.ts)
  computes per-day deltas in JS.
- **Analysis:** this is the prompt's "move work into SQL" candidate (a
  window-function `LAG` per book, positive deltas summed per local day). The
  catch: `dayKey`/`getFullYear` bucket in the **server's local timezone**, and
  a SQL `date_trunc` would bucket in UTC/DB-time unless carefully
  `AT TIME ZONE`'d — an off-by-one-day drift around midnight is exactly the
  kind of silent behaviour change the constraints forbid. The rows fetched
  are already `select`-trimmed (bookId/page/date, ~50 bytes each), so even a
  heavy log (thousands of entries) is tens of kB server-side, never shipped
  to the client.
- **Recommendation:** skip for now; revisit only if the stats page measurably
  slows. If you want it anyway I'll do it with an explicit
  `AT TIME ZONE current_setting('TimeZone')` and verify parity against the JS
  path on your data.
- The **year page's book/read fetches** (not the progress log) *can* be
  bounded safely: computing the year's `[Jan 1, Jan 1)` range in server-local
  JS `Date`s and filtering `dateFinished` by it matches `getFullYear()`
  bucketing exactly. Low value at this scale, but zero-risk — included in
  finding 4's batch if you want it.

### 10. Import restores one book per round-trip, non-atomically
- **File:** [import.ts:174-308](../src/lib/import.ts) (per-shelf create loop,
  per-goal upsert loop, per-book `create` with nested creates)
- **What's wrong:** a 500-book restore is ~500+ sequential queries; a failure
  mid-way leaves a half-restored library (merge semantics make a re-run safe,
  so this is latency more than correctness).
- **The judgement call:** nested creates rule out `createMany`; a single
  interactive `$transaction` would make it atomic *but* Prisma's default 5 s
  interactive-transaction timeout would abort large restores unless raised —
  and atomic-vs-resumable is a real semantics choice. Options: (a) leave it
  (honest default — restores are rare), (b) transaction with a generous
  timeout, (c) chunked transactions of ~50 books. Your call.

### 11. Additive indexes — proposed, honestly marginal
- **File:** [schema.prisma:129-130](../prisma/schema.prisma) (existing:
  `[userId, status]`, `[userId, createdAt]`)
- The prompt asks about ISBN, series, and finish-date indexes. Reality check:
  every one of these queries scans one user's few-hundred rows after the
  existing `userId`-prefixed indexes — all sub-ms. The only lookup with a
  hit-path worth naming is the bookstore "do I own this?" ISBN check
  ([library/check/route.ts:66-69](../src/app/api/library/check/route.ts)),
  and even that is fast today. Series lookups use `mode: "insensitive"`, so a
  plain `[userId, seriesName]` index wouldn't even be used (it would need a
  raw `lower(...)` expression index).
- **Recommendation:** none needed at this scale. If you want future-proofing
  anyway, the one defensible addition is `@@index([userId, isbn])` as a new
  additive migration — say the word and I'll write it (constraints require
  your sign-off on any migration).

---

## Tier 3 — code quality (small, safe cleanups)

12. **Unused runtime dependency:** `shadcn` (^4.13.0) in `dependencies`
    ([package.json:24](../package.json)) is the code-gen CLI — nothing
    imports it (components import `radix-ui`). It bloats installs (standalone
    output already excludes it from the runtime image). Removing it is a
    dependency change, so flagging rather than doing: OK to drop (or move to
    `devDependencies` if you still scaffold with it)?
13. **Duplicated `EXT_BY_MIME` map:** [covers.ts:16-21](../src/lib/covers.ts)
    vs [covers/upload/route.ts:9-14](../src/app/api/covers/upload/route.ts)
    (upload also re-derives the reverse of the serving route's
    `MIME_BY_EXT`). Export one shared map from `covers.ts`.
14. **Duplicated lenient-date parsing:** `dateField` transform in
    [import.ts:22-30](../src/lib/import.ts) vs `parseDateOrNull` in
    [validation.ts:104-108](../src/lib/validation.ts) — same semantics,
    share one helper.
15. **Duplicated cover-thumbnail markup:** the `<img>`-or-placeholder block
    appears in [import-search.tsx:152-165](../src/components/import-search.tsx)
    and [check-book-client.tsx:166-179](../src/components/check-book-client.tsx);
    `BookCover` ([book-card.tsx:10-35](../src/components/book-card.tsx))
    already is that component — both callsites can use it.
16. **MetadataCache grows forever:** expired rows are never deleted
    ([cache.ts](../src/lib/metadata/cache.ts) only upserts). Tiny table in
    practice; an opportunistic `deleteMany({ expiresAt: { lt: … } })` (e.g.
    fire-and-forget after a fresh upsert) caps it. Low priority.
17. **Redundant `export const dynamic = "force-dynamic"`:** every page that
    declares it also calls `auth()`/`searchParams`, which force dynamic
    rendering anyway. Harmless belt-and-braces; I'd leave it unless you want
    the noise gone.

## Explicitly checked, no action needed

- **Bundle weight:** no heavy eager imports; scanner uses native
  `BarcodeDetector`; charts are hand-rolled SVG. Largest first-load is
  218 kB (`/books`), dominated by the framework + Radix primitives.
- **Search-as-you-type:** debounced 400 ms with `AbortController`
  cancellation ([import-search.tsx:43-77](../src/components/import-search.tsx));
  filter bar and quotes search debounced 300 ms. Correct as-is.
- **`"use client"` boundaries:** already tight — pages/layouts/nav/heatmap
  are server components; client components are the genuinely interactive
  leaves. No profitable push-downs found.
- **In-memory sort/group on `/books`:** deliberate and documented
  (author-array sort + nulls-last semantics Prisma can't express cleanly);
  right call at this scale.
- **Auth/session/ownership:** every action/route checks `userId` scoping
  consistently; found no holes (and per constraints, made no changes).
- **Dead code:** essentially none — exports all have consumers.
- **Backup/restore compatibility:** untouched by everything proposed above;
  the import/export formats are not affected by any Tier 1 item.

## Suggested implementation order (pending your approval)

1. Finding 1 (cache-key bug) — separate bug-fix commit
2. Finding 5 (cover delete ordering) — separate bug-fix commit
3. Finding 2 (library DTO) — the big win
4. Finding 3 (lazy covers)
5. Finding 4 (query batching/trimming)
6. Finding 6 (transactions)
7. Any of Tier 2/3 you green-light (7, 8, 10, 11, 12 need your decision)
