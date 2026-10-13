# Developing MyReads

How to run MyReads from source, run the tests, and find your way around the
code. To just use the app, follow the install steps in the
[README](../README.md) instead.

## Run it locally

You need Node 22+ and a Postgres database. The compose `db` service works
fine for the database.

```bash
cp .env.example .env       # set POSTGRES_PASSWORD and AUTH_SECRET
# Start only the database, reachable on localhost:5432. The dev override
# file publishes the port; the main compose file keeps Postgres private.
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npm install
npx prisma migrate deploy  # create the tables (uses DATABASE_URL from .env)
npm run dev                # http://localhost:3000
```

Outside Docker the app reads `DATABASE_URL` from `.env`. Make sure its
password matches `POSTGRES_PASSWORD`. Every setting is described in
[.env.example](../.env.example).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Generate the Prisma client and make a production build |
| `npm run lint` | Run ESLint |
| `npm test` | Unit tests (no database needed) |
| `npm run test:db:docker` | Database tests against a throwaway Postgres container |
| `npm run test:db` | Database tests against the database in `DATABASE_URL` |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run db:prune` | Delete expired search-cache rows (also runs on every container start) |
| `npm run covers:prune` | Report cover files no book uses; add `-- --yes` to delete them |

## Tests

- **`npm test`** covers the pure logic that is easiest to break without
  noticing: ISBN-10/13 conversion, reading pace and streaks, which day a date
  falls on in each time zone, sorting authors by surname and series in
  order, the sorting rules and alphabets, saved library views, reading
  goals, reading preferences and themes, the colours of drawn covers,
  the reading room's shelves and spine colours, lending, the rate
  limiter, the
  guard that stops cover downloads from reaching private addresses, image
  type detection, and the size limits on uploads and backup files.
- **`npm run test:db:docker`** starts a `postgres:16-alpine` container, runs
  the database tests, and removes it. They cover backup and restore (the
  round trip, merging, duplicates, and settings), re-read counts, the book
  form and the reading log it writes, library search, bulk edit, saving
  preferences and saved views, and the checks that stop one user from
  touching another user's books.

These run against a real database because a stand-in would copy Postgres's
behaviour wrongly in exactly the places that matter, and because restore is
the one feature whose failure loses data you can't get back.

CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) runs lint, the
type check, both test suites and a production build on every pull request.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router, TypeScript), built as a
  standalone server for a small Docker image
- [PostgreSQL](https://www.postgresql.org/) with [Prisma](https://www.prisma.io/)
- [Auth.js v5](https://authjs.dev/): username and password, JWT sessions,
  passwords hashed with bcrypt
- [Tailwind CSS v4](https://tailwindcss.com/) and [shadcn/ui](https://ui.shadcn.com/)
- [Zod](https://zod.dev/) for validation and [Vitest](https://vitest.dev/) for tests

## Project layout

```
src/
├─ app/
│  ├─ (auth)/          login and register pages
│  ├─ (app)/           pages behind login: books (the library), books/new,
│  │                   books/[id], books/[id]/edit, books/check, quotes,
│  │                   room (the reading room), stats, stats/year/[year],
│  │                   account
│  └─ api/             Auth.js, register, metadata search/details/covers,
│                      library check, cover upload and serving,
│                      backup export and import
├─ components/         UI components (shadcn/ui primitives in components/ui);
│                      reading-room.tsx, room-art.tsx, room-shells.ts,
│                      room-rooms.tsx (the added rooms' furniture) and
│                      room-extras.tsx (the furniture catalogue) draw the
│                      reading room, with its colours in
│                      reading-room.css; room-view.tsx is its Decorate panel;
│                      avatar-art.ts draws the reader's avatar,
│                      room-avatar.tsx walks it about and avatar-maker.tsx
│                      is its maker
├─ lib/
│  ├─ actions/         server actions for every change, each checking that
│  │                   the data belongs to the signed-in user
│  ├─ metadata/        Open Library, Google Books and nb.no clients, plus
│  │                   the database cache
│  ├─ cover-art.ts     colours and layout of drawn covers
│  ├─ cover-flight.ts  a book's cover flying to its page, and back to the
│  │                   library when the page is closed
│  ├─ covers.ts        downloading and caching cover images
│  ├─ dates.ts         which calendar day a date falls on, by time zone
│  ├─ library-return.ts
│  │                   where a book page's X goes back to: the library
│  │                   page it was opened from, and how far down it was
│  ├─ avatar.ts        the avatar's choices and their colours
│  ├─ motion.ts        whether animations may run right now
│  ├─ net-guard.ts     blocks cover downloads from private addresses
│  ├─ preferences.ts   the Preferences settings and their defaults
│  ├─ rate-limit.ts    in-memory limits for sign-in, registration,
│  │                   catalogue lookups and cover uploads
│  ├─ room.ts          the reading room's layout: spine sizes, shelves,
│  │                   and where bookcases and furniture go as it grows
│  │                   or as the reader moves it
│  ├─ room-styles.ts   the reading room's house styles and colours
│  ├─ sky.ts           the Sky background: how high the sun is where
│  │                   the reader's time zone is, as colours
│  ├─ spine-colour.ts  a spine's colour, picked from its cover
│  └─ validation.ts    Zod schemas shared by actions and API routes
├─ auth.config.ts      Auth.js config that is safe to run in proxy.ts
├─ auth.ts             full Auth.js config (credentials, Prisma, bcrypt)
└─ proxy.ts            sends signed-out visitors to the login page
                       (Next 16's new name for middleware.ts)
```

## Design decisions

- **Reading data lives on the Book row.** Each book belongs to one user, so
  a separate "reading entry" table would add nothing. The Book row holds the
  latest read; earlier reads are archived in the `Read` table, and
  `timesRead` is worked out from both.
- **Ratings are stored as whole numbers from 1 to 10**, in half stars. `7`
  shows as 3.5 stars, or as 7/10 for someone who rates out of 10. Changing
  the rating style only changes how ratings look and are entered, never the
  stored numbers.
- **Settings are one JSON value per account.** Preferences live in
  `User.preferences` and the library's look in `User.libraryView`. Each is
  read through a parse function (`parsePreferences`, `parseLibraryView`)
  that fills in a default for anything missing or wrong. Adding a setting
  means adding it there; older rows just get the default. Saves merge the
  changed keys in SQL, so two quick changes can't undo each other.
- **Appearance settings are attributes on `<html>`.** The root layout
  writes the theme, accent, fonts, corners, card style, background, cover
  style, book page backdrop and animation setting as `data-*` attributes,
  and
  [globals.css](../src/app/globals.css) does the rest, so server and client
  components never pass them down. Preferences sets the attribute at once
  as well as saving, so a change shows without waiting for the server.
- **Motion always has an off switch.** One CSS rule stops every animation
  and transition when the device asks for reduced motion or Animations is
  off, and animations started from script (confetti, the theme reveal, the
  cover flying to a book's page and back) check the same two things through
  `motionAllowed()` in [motion.ts](../src/lib/motion.ts).
- **Moving backgrounds slide pictures, they don't redraw them.**
  [background-scene.tsx](../src/components/background-scene.tsx) puts one
  fixed layer under the page, and everything in it moves by `transform` or
  fades by `opacity` alone. Rain, snow and stars must not look tiled, so
  the far-off marks are two or three tiles (in `public/textures`) of sizes
  that share no factor, laid over each other as masks over a theme colour
  and moved one tile per loop so they never jump; the near drops, flakes
  and bright stars are each their own element, scattered by a seeded random
  generator so the server and the browser agree. When animations may not
  play, or "Moving backgrounds" is off, rain, snow and stars hold still
  where they are, and aurora and ripples show their still textures. The
  Sky background is worked out from the sun's height where the reader's
  time zone is ([sky.ts](../src/lib/sky.ts)), on the server for the first
  paint and then once a minute in the browser.
- **The reading room is drawn in code**, with no image files. Its pixel art
  is rectangles ([room-art.tsx](../src/components/room-art.tsx)), each
  naming a paint whose colour lives in
  [reading-room.css](../src/components/reading-room.css), which has a day
  palette for light themes and a night one for dark themes. Spine colours
  are read from the covers in the browser as each floor scrolls into view,
  and kept in localStorage by cover address, which changes whenever the
  image does. The house's shell (roof, walls, floors, garden) is drawn per
  style in [room-shells.ts](../src/components/room-shells.ts); the cottage
  keeps a hand-picked palette, and every other style gives a few base
  colours per part (`--s-*`) that the shades and the night version are
  worked out from, so a Decorate colour pick repaints any style. The
  decoration and where the furniture stands are Preferences
  (`roomStyle`, `roomLayout` and the rest); placements name a floor and a
  place among the pieces there, so they survive a different screen width,
  falling back to where a piece would go by itself when it doesn't fit.
  Added rooms (`roomRooms`) are floors over the library's own, in the
  order they were added; a piece moved into one names the room rather
  than a floor number, so it stays put as the library grows underneath.
  Furniture added from the catalogue (`roomExtras`) goes wherever there
  is space, like the library's own; no floor is added just to hold it, so
  on a narrow screen a piece may wait for space, and Decorate says so.
  The avatar is painted dot by dot and outlined in code
  ([avatar-art.ts](../src/components/avatar-art.ts)) in layers, from a
  cape behind to a hat on top, and coloured from five `--av-*` colours, so
  a colour pick redraws nothing. Its look is one Preferences value
  (`avatar`), checked by `parseAvatar` in [avatar.ts](../src/lib/avatar.ts),
  which also reads the looks saved before the wardrobe. The tests draw
  every hairstyle under every hat and every outfit, and check each stays
  outlined and fits the armchair. Its walk is the
  one piece of the room moved by script rather than CSS, so it checks
  [motion.ts](../src/lib/motion.ts) and stands still when animations are
  off.
- **Typed dates and moments are read differently.** A date typed into a date
  field is stored as midnight UTC and means that day everywhere. Anything
  else, like "finished today" or a reading-log entry, is a moment, and
  counts on the day it was in the reader's time zone. `calendarDay` in
  [dates.ts](../src/lib/dates.ts) applies the rule. The time zone is taken
  from the browser on the first visit and can be changed in Preferences.
- **Catalogue lookups are cached** in the `MetadataCache` table for a week,
  keyed by source and query. If a source is down, the last good answer is
  used, so a flaky Open Library doesn't break lookups that worked before.
- **Cover images are stored locally.** After a save, the cover is downloaded
  to `COVERS_DIR` in the background (with `after()`, so saving never waits
  for it) and the book is pointed at `/api/covers/<id>-<hash>.<ext>`. The
  hash in the name means a changed cover gets a new URL, so browsers can
  cache covers forever. A slow host gets one retry. If the download fails,
  the book keeps the remote URL. A cover file is deleted only when no book
  uses it any more.
- **Changes go through server actions** that check ownership, and pages
  are server components that query Prisma directly. API routes are used
  only where the browser has to call the server itself: sign-in and
  registration, metadata search, the "Do I own this?" check, cover upload
  and serving, and backup download and restore.
- **Migrations run when the container starts** (`prisma migrate deploy` in
  [docker-entrypoint.sh](../docker-entrypoint.sh)). The first start creates
  the tables, later starts apply anything new, and an up-to-date database is
  left alone.
