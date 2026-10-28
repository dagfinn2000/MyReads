# Developing MyReads

How to run MyReads from source, run the tests, and find your way around the
code. To just use the app, follow the install steps in the
[README](../README.md) instead.

## Run it locally

You need Node 22.13 or newer and a Postgres database. Older 22.x releases
can run the app, but the linter and test runner don't support them. The
compose `db` service works fine for the database.

```bash
cp .env.example .env       # set POSTGRES_PASSWORD and AUTH_SECRET
# Start only the database, reachable on localhost:5432. The dev override
# file publishes the port; the main compose file keeps Postgres private.
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npm install
npm run db:generate        # make the database client from the schema
npm run db:migrate         # create the tables (uses DATABASE_URL from .env)
npm run dev                # http://localhost:3000
```

Outside Docker the app reads `DATABASE_URL` from `.env`. Make sure its
password matches `POSTGRES_PASSWORD`. Every setting is described in
[.env.example](../.env.example).

Run `npm run db:generate` again whenever `prisma/schema.prisma` changes,
for example after a `git pull`. Without it the app stops with "Cannot
find module '.prisma/client/default'".

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Generate the Prisma client and make a production build |
| `npm run lint` | Run ESLint |
| `npm test` | Unit tests (no database needed) |
| `npm run test:db:docker` | Database tests against a throwaway Postgres container |
| `npm run test:db` | Database tests against the database in `DATABASE_URL` |
| `npm run db:generate` | Make the database client from `prisma/schema.prisma` |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run db:prune` | Delete expired search-cache rows (also runs on every container start) |
| `npm run covers:prune` | Report cover files no book uses; add `-- --yes` to delete them |

## Tests

- **`npm test`** runs the unit tests. They need no database and cover the
  logic that is easy to break without noticing: ISBNs, reading pace and
  streaks, which day a date falls on in each time zone, sorting, goals and
  challenges, own statuses and fields, themes, lending, the reading room
  and the avatar, the encryption of reading reminders, and the limits and
  guards on uploads, backups and cover downloads.
- **`npm run test:db:docker`** starts a throwaway `postgres:16-alpine`
  container, runs the database tests and removes it. They cover what
  depends on real queries: backup and restore, the nightly backups, the
  reading log and timer, Kindle import, library search and filters, bulk
  edit, saving preferences, and the checks that stop one user from
  touching another user's books.

The database tests use a real Postgres because a stand-in would get its
behaviour wrong in exactly the places that matter, and because restore is
the one feature whose failure loses data you can't get back.

CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) runs on every
pull request and every push to `main`. One job runs lint, the type check,
both test suites and a production build. A second builds the Docker image,
starts it with Docker Compose, and checks that the sign-in page answers
and the app reaches its database.

## Changing the database

1. Change [prisma/schema.prisma](../prisma/schema.prisma).
2. Add a migration that makes the same change: a new folder in
   `prisma/migrations`, named like the others (date and time, then what
   it does), with a `migration.sql` inside.
3. Check that the two agree. Set `SHADOW_DATABASE_URL` to an empty
   database that Prisma may wipe, then run

   ```bash
   npx prisma migrate diff --from-migrations prisma/migrations \
     --to-schema prisma/schema.prisma --script
   ```

   It should print an empty migration. Anything else is what your
   migration still misses.
4. Run `npm run db:generate` and `npm run db:migrate`.

A new setting usually needs no migration: settings are JSON (see
[Design decisions](#design-decisions)).

## Keeping the docs current

The [README](../README.md) is a short overview for someone deciding
whether to install MyReads. [FEATURES.md](FEATURES.md) lists everything
the app can do. When a change adds or changes something a reader can see,
update FEATURES.md, and the README only when its overview no longer fits.
Screenshots live in `docs/`, next to FEATURES.md.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router, TypeScript), built as a
  standalone server for a small Docker image
- [PostgreSQL](https://www.postgresql.org/) with [Prisma](https://www.prisma.io/) 7,
  which talks to the database through the `pg` driver
  ([prisma.ts](../src/lib/prisma.ts)). The `prisma` command-line tool gets
  `DATABASE_URL` from [prisma.config.ts](../prisma.config.ts), which reads
  `.env` when there is one.
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
│  │                   books/[id], books/[id]/edit, books/check, reading
│  │                   (Now reading), quotes, series, room (the reading
│  │                   room), stats, stats/year/[year], account
│  └─ api/             what the browser calls directly: sign-in and
│                      registration, catalogue search and covers, the
│                      library check, cover upload and serving, backups,
│                      and a browser's new address for reading reminders
├─ components/         UI components; shadcn/ui primitives are in
│                      components/ui, and the reading room's files are
│                      listed below
├─ lib/                one file per feature or rule, named after it
│  │                   (goals.ts, loans.ts, series.ts, statuses.ts and so
│  │                   on), with its tests beside it: name.test.ts, and
│  │                   name.db.test.ts when it needs a database
│  ├─ actions/         server actions for every change, each checking that
│  │                   the data belongs to the signed-in user
│  ├─ metadata/        Open Library, Google Books and nb.no clients, plus
│  │                   the database cache
│  ├─ prisma.ts        the database client
│  ├─ preferences.ts   the Preferences settings and their defaults
│  ├─ validation.ts    Zod schemas shared by actions and API routes
│  ├─ dates.ts         which calendar day a date falls on, by time zone
│  ├─ enums.ts         the database's enums, safe to import in the browser
│  ├─ net-guard.ts     stops the server fetching private addresses
│  └─ server-jobs.ts   the server's own timer, for nightly backups and
│                      reading reminders
├─ auth.config.ts      Auth.js config that is safe to run in proxy.ts
├─ auth.ts             full Auth.js config (credentials, Prisma, bcrypt)
├─ instrumentation.ts  starts the server's own jobs when it starts
└─ proxy.ts            sends signed-out visitors to the login page
                       (Next 16's new name for middleware.ts)
```

The reading room's files:

| File | What it does |
| --- | --- |
| [lib/room.ts](../src/lib/room.ts) | The layout: spine sizes, shelves, floors, and where furniture goes |
| [lib/room-styles.ts](../src/lib/room-styles.ts) | Everything Decorate offers, and its colours |
| [reading-room.tsx](../src/components/reading-room.tsx) | The Room page's picture of the house |
| [lib/cover-colours.ts](../src/lib/cover-colours.ts) | Each cover's main colour, read in the browser, for the spines here and in the library's Spines view |
| [room-art.tsx](../src/components/room-art.tsx) | The pixel art: bookcases and furniture as rows of rectangles |
| [reading-room.css](../src/components/reading-room.css) | The paints, by day and by night |
| [room-shells.ts](../src/components/room-shells.ts) | Each house style's roof, walls, floors and garden ground |
| `room-*.ts` | One part each: [fireside](../src/components/room-fireside.ts), [bookcases](../src/components/room-bookcases.ts), [pictures](../src/components/room-pictures.ts), [windows](../src/components/room-windows.ts), [doors](../src/components/room-doors.ts), [garden](../src/components/room-garden.ts), [seasons](../src/components/room-seasons.ts), [holidays](../src/components/room-holidays.ts) |
| [room-rooms.tsx](../src/components/room-rooms.tsx), [room-extras.tsx](../src/components/room-extras.tsx) | The added rooms' furniture, and the furniture catalogue |
| [room-view.tsx](../src/components/room-view.tsx), [room-interior.tsx](../src/components/room-interior.tsx) | The Decorate panel |
| [avatar-art.ts](../src/components/avatar-art.ts), [room-avatar.tsx](../src/components/room-avatar.tsx), [avatar-maker.tsx](../src/components/avatar-maker.tsx) | The avatar: drawing it, walking it about, and its maker |

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
- **A colour theme is one CSS block and one line.** Each theme is a
  `[data-theme="…"]` block of colours in
  [globals.css](../src/app/globals.css) and an entry in `THEMES` in
  [themes.ts](../src/lib/themes.ts). The entry's swatch repeats the
  block's background and accent, as it also colours the browser's title
  bar, and a test fails if the two files disagree. Dark themes get the
  `dark` class too, so textures, the reading room at night and Tailwind's
  `dark:` colours follow with nothing else to change. Themes of our own
  (not the ones ported from other apps) must reach 11:1 contrast for text
  on the page and at least 4.5:1 for muted text, buttons, the accent on
  the page and the danger colour on cards, and the same test checks it.
  An entry with a `silly` line joins the Silly set: it goes last in
  `THEMES`, and the palette menu and Preferences list it under its own
  heading, below Light and Dark.
- **A theme can bring more than colours.** In its block, `--radius` gives
  it corners of its own and `--heading-font` a heading face (Corners and
  Headings in Preferences only override them when set to something other
  than "As the theme has them"), and `--page-gradient` with `--page-size`
  puts a picture behind the page. Such a theme also needs
  `ownBackground: true` in `THEMES` (a test checks the two agree): its
  picture then shows instead of the reader's Background, through
  `data-own-background` on `<html>`, which the pre-paint script sets. The
  "Beyond colour" part of globals.css has the rest: a top bar in the theme's own
  colours, outlined cards with hard shadows, a font for the whole page.
  Give such a theme a `pattern` in `THEMES` too, so its swatch shows it.
  Before adding one, check it doesn't look like a theme we already have:
  the hues are nearly all taken, so a new theme should differ in kind,
  not shade.
- **A few themes restyle everything.** Desktop 95, Terminal, Newsprint,
  Blueprint, Notebook, Quest, Pinstripe, Aero, Golden Gate, KDE Plasma,
  GNOME and Hyprland start from a colour block like any theme, and [restyles.css](../src/app/restyles.css) reshapes the
  app for them, one section per theme. Its rules aim at shadcn's
  `data-slot` attributes and buttons by `data-size` and `data-variant`:
  a button inside a Radix trigger (`asChild`) wears the trigger's
  `data-slot` (`dialog-trigger`, `popover-trigger`) instead of
  "button". The rules aren't in a layer, so they beat Tailwind's
  utilities without `!important`, which also means each theme sets its
  own hover and pressed states. Generated text such as window titles
  uses `content: "…" / ""` so screen readers skip it. A rule that styles
  something inside the page starts from the theme's class on `<html>`
  (`.theme-is-quest .card`), never `[data-theme="quest"] .card`: the
  browser skips a rule whose class isn't there without looking, but it
  checks an attribute's value up the tree from every element, and with
  all these rules that was 40% of the time spent styling the library. A
  test fails on the attribute form. Fonts only these
  themes use are loaded with `preload: false` in
  [layout.tsx](../src/app/layout.tsx), so no one else downloads them.
  Their `@font-face` rules are in the CSS every page loads, though, so a
  face with many slices costs everyone: Quest's DotGothic16 is Japanese,
  and next/font/google wrote 124 of them (94 KB). It is its Latin slice
  alone, in [fonts](../src/app/fonts) with its licence.
  After changing one, look at every page at phone width too, and check
  the other themes still match main pixel for pixel.
- **A theme's big picture is a file, and its glass is cheap.** A picture
  more than a few hundred bytes (Aero's desktop, Golden Gate's, the
  Linux desktops') is an SVG in `public/themes`, named by `--page-gradient`, so only a
  reader on that theme downloads it; the sign-in proxy leaves that
  folder alone, as the sign-in pages show the theme too. Glass that
  blurs what is behind it (`backdrop-filter`) is kept to small or
  passing things: the top bar, menus, popovers, dialogs. A large pane
  over the page would blur again on every frame of a scroll. Aero's
  window frame is tinted glass with nothing blurred, which over so soft
  a desktop looks the same. Golden Gate's window is a fixed layer under
  the page drawn from a softened copy of the picture
  (`golden-gate-frosted.svg`), laid exactly over the sharp one; a second
  fixed layer over the page repeats the picture with the window's shape
  masked out, so what scrolls past the window's edge goes behind it.
  That copy is frosted as it is drawn, by an SVG filter that lays white
  over it as opaque as the colour beneath is dark, so the glass is
  never darker than a set luminance (0.6) and its text keeps AA
  contrast anywhere on it. The glass over the page does the same with
  `contrast()` and `brightness()` in its `backdrop-filter`, so black
  beneath it comes out light enough. Keep both when changing the
  picture or the glass. KDE Plasma, GNOME and Hyprland draw their
  windows the same way: a fixed layer under the page for the window, a
  fixed layer over it with the window cut out, and their panels and bars
  on fixed layers too, with `scroll-padding` on `<html>` so keyboard
  focus never lands under them. KDE Plasma cuts its window out with a
  `clip-path` rather than a mask: that layer takes clicks, so nothing
  hidden behind the panel can be clicked, and only a clip-path shapes
  where clicks land. Each section's comments name the variables that
  hold its geometry; change those, not the layers one by one. The
  desktops are our own drawings after each one's wallpaper: KDE
  Plasma's after Hanabi by Krystian Zajdel, GNOME's after Roundhex,
  Hyprland's after its wall0.
- **A theme is retired, never just deleted.** Take out its block and
  entry and add it to `RETIRED_THEMES` in
  [themes.ts](../src/lib/themes.ts) with the theme that replaces it, of
  the same mode. Saved settings (the account's, a device's, a part's)
  then read as the replacement, before the first paint too.
- **Motion always has an off switch.** One CSS rule stops every animation
  and transition when the device asks for reduced motion or Animations is
  off, and animations started from script (celebrations, the theme reveal,
  the cover flying to a book's page and back) check the same two things
  through `motionAllowed()` in [motion.ts](../src/lib/motion.ts).
  That rule sets transitions to `0s`, never a tiny duration: on every
  element, a duration means a transition of every property, and a theme
  change then took seconds.
- **Scrolling and theme changes stay cheap.** Three rules, each with a
  test ([motion-css.test.ts](../src/lib/motion-css.test.ts)):
  - A cover gets its 3D tilt only while it tilts (`[data-tilting]`).
    Even turned by 0deg, a 3D transform puts an element on a compositor
    layer of its own, and with every cover on one, scrolling the library
    spent most of its time sorting 200 layers.
  - `applyThemeSetting` marks `<html>` with `data-theme-changing` for the
    frame a new theme is styled in, and globals.css holds transitions off
    for the transition classes then. Otherwise every card, badge and
    button eased each changed colour: two thousand transitions on a big
    library, each three events through React's root listener.
  - No component uses `transition-all`. It animates `scrollbar-color`
    too, which Chrome restarts on every element using it whenever
    `<html>` restyles, even for a custom property nothing reads.
  A grid holding a page's content says `grid-cols-1` (or `minmax(0,1fr)`)
  rather than leaving its one column `auto`: an `auto` column grows to
  its widest child's longest word, and one long series name, a monospace
  theme or a large text size then pushed the whole page past a phone's
  edge.
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
- **Moving backgrounds keep the page asleep.** The animations are written
  in CSS, but once they run,
  [scene-motion.ts](../src/lib/scene-motion.ts) hands each one to a Web
  Animation with the same keyframes and timing. A CSS animation wakes the
  page's main thread every time it loops (React listens for that), and
  with a hundred raindrops that is many times a second; a Web Animation
  loops quietly on the compositor. Slow changes (stars twinkling, the
  aurora drifting) also step together a few times a second rather than
  every frame, so in between the browser has nothing to redraw. By day the
  Sky background doesn't draw its stars at all.
- **The reading room is drawn in code**, with no image files.
  - Its pixel art is rectangles, each naming a paint whose colour lives in
    [reading-room.css](../src/components/reading-room.css): a day palette
    for light themes and a night one for dark themes.
  - Spine colours are read from the covers in the browser as each floor
    scrolls into view, and kept in localStorage by cover address, which
    changes whenever the image does.
  - The cottage has a hand-picked palette. Every other house style gives a
    few base colours per part (`--s-*`), and the shades and the night
    version are worked out from them, so a colour picked in Decorate
    repaints any style.
  - The decoration and where furniture stands are Preferences
    (`roomStyle`, `roomLayout` and the rest). A moved piece is saved as a
    floor and a place among the pieces there, so it survives a different
    screen width. If it no longer fits, it goes where it would go by
    itself.
  - Added rooms (`roomRooms`) go above the library's floors in the order
    they were added. A room in `roomBeside` shares the floor of the one
    before it when all its furniture fits there, and gets a floor of its
    own when it doesn't. A piece moved into a room is saved by room, not
    floor number, so it stays put as the library grows underneath.
  - Catalogue furniture (`roomExtras`) goes wherever there is space. No
    floor is added just to hold it, so on a narrow screen a piece may
    wait for space, and Decorate says so.
  - The avatar is painted dot by dot in layers, from a cape behind to a
    hat on top, and coloured from six `--av-*` colours, so a colour pick
    redraws nothing. Its look is one preference (`avatar`), checked by
    `parseAvatar` in [avatar.ts](../src/lib/avatar.ts). The tests draw
    every hairstyle under every hat and every outfit, and check each stays
    outlined and fits the armchair.
  - The avatar's walk is the one part of the room moved by script rather
    than CSS, so it checks [motion.ts](../src/lib/motion.ts) and stands
    still when animations are off.
- **Own statuses and fields sit on top of the built-in ones.** A book's
  `status` is always one of the four built-in statuses, and `statusKey`
  names the reader's own status built on it, if any, so stats, goals and
  every query keep counting by the four
  ([statuses.ts](../src/lib/statuses.ts)). Own fields are defined in
  Preferences and a book's values are one JSON column, `Book.fields`,
  checked against the fields as they stand
  ([book-fields.ts](../src/lib/book-fields.ts)). Their text and choices
  are copied into `fieldSearchText` so the library search finds them.
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
  and serving, backup download and restore, and the reminders' service
  worker passing on a browser's new push address.
- **The browser only downloads what it runs.** Three habits keep pages
  light. Enum values come from [enums.ts](../src/lib/enums.ts), not
  `@prisma/client`, whose browser build is 40 KB of code nothing here uses;
  `npm run lint` refuses the Prisma import, and a test checks the two lists
  still match. Zod schemas stay in files only the server imports
  (`validation.ts`, `reading-log-input.ts`), never next to helpers that
  client components use. And `package.json` says only CSS files have side
  effects (`"sideEffects": ["*.css"]`), so the bundler can leave out a
  module a page imports but never calls.
- **Icons a page repeats are drawn once.** Ratings and the plain cover's
  book use `SpriteIcon` from [icon-sprite.tsx](../src/components/icon-sprite.tsx),
  which points at a symbol the root layout renders instead of repeating the
  icon's path. The repeated star paths were a quarter of the library's HTML.
  Add an icon there when a page shows it dozens of times; a test checks the
  paths still match lucide's.
- **Nightly backups run inside the app server.** With `BACKUP_DIR` set,
  [instrumentation.ts](../src/instrumentation.ts) starts one timer for the
  server's own jobs ([server-jobs.ts](../src/lib/server-jobs.ts)). It ticks
  once a minute and looks at each job as often as the job asks, so reading
  reminders join the same timer. The backup looks every
  15 minutes and runs once a day from `BACKUP_HOUR`, one account at a time,
  through the same `buildBackupZip` as the Download button
  ([backup-zip.ts](../src/lib/backup-zip.ts)), so both make the same file.
  Each copy is written under a temporary name and renamed once it's whole,
  and only files named like a copy are ever deleted. The timer lives on
  `globalThis`, so a hot reload doesn't start a second one.
- **Reading reminders are Web Push, with nothing but `node:crypto`.**
  [web-push.ts](../src/lib/web-push.ts) encrypts each message for the
  browser (RFC 8291, checked against the RFC's own example in the tests)
  and signs the request with a VAPID key the server makes on first use and
  keeps in `ServerSetting`. The reminder job
  ([reminders-run.ts](../src/lib/reminders-run.ts)) looks every 5 minutes;
  when a reader's time has come in their zone, it claims the day in
  `User.lastReminderDay` before sending, so a reminder never goes twice.
  The browsers are `PushDevice` rows, and
  [public/push-sw.js](../public/push-sw.js) is a service worker that only
  shows the notification: it caches nothing and handles no page loads.
  Push addresses come from the browser, so they go through the same
  network guard as cover downloads.
- **Migrations run when the container starts** (`prisma migrate deploy` in
  [docker-entrypoint.sh](../docker-entrypoint.sh)). The first start creates
  the tables, later starts apply anything new, and an up-to-date database is
  left alone.
