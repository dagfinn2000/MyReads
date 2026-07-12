# MyReads

A self-hosted, single-purpose personal book library. Think *GoodReads, but
just for you*: catalog the books you own, track what you're reading, rate and
review everything — with no friends, feeds, follows, or any other social
surface area.

> **Status:** fully functional. Screenshots coming soon.
>
> ![Library view placeholder](docs/screenshot-library.png)
> ![Stats placeholder](docs/screenshot-stats.png)

## Features

- **Book catalog** — add books manually or via search-and-import, with title,
  author(s), ISBN, cover, description, page count, publish date, genre/tags,
  format (physical / ebook / audiobook), and an owned flag. Full edit/delete.
- **Search & import** — search-as-you-type against the
  [Open Library API](https://openlibrary.org/developers/api) (free, no key).
  Optionally enriched by the Google Books API when `GOOGLE_BOOKS_API_KEY` is
  set. Every fetched field is reviewable/editable before saving, responses are
  cached in Postgres for a week, and cover images are downloaded into a local
  cache so the app never depends on third-party image hosting.
- **Personal reading data** — status (Want to Read / Currently Reading /
  Read / Did Not Finish), 1–5 star ratings **with half stars**, free-text
  review/notes, start & finish dates, and re-read tracking.
- **Library views** — status shelves, text search across title/author,
  filters by tag, format, and minimum rating, sorting by title, author,
  rating, date added, or date finished. All view state lives in the URL.
- **Stats dashboard** — books read per year, average rating, total pages
  read, genre and format breakdowns.
- **Auth** — username/password accounts via Auth.js (Credentials provider),
  bcrypt-hashed passwords, JWT sessions. Registration can be disabled once
  your account exists.

Deliberately out of scope: anything social, recommendation engines, CSV
import.

## Quick start (Docker)

Requirements: Docker with the compose plugin.

```bash
git clone https://github.com/dagfinn2000/myreads.git
cd myreads
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD and AUTH_SECRET (openssl rand -base64 32)
docker compose up -d
```

That's it. The app container waits for Postgres to be healthy, applies
database migrations automatically, and starts on
[http://localhost:3000](http://localhost:3000). Register an account and start
adding books.

Data persists in two named volumes: `pgdata` (the database — your entire
library) and `covers` (cached cover images).

## Environment variables

All configuration is documented inline in [.env.example](.env.example).
Summary:

| Variable | Required | Purpose |
| --- | --- | --- |
| `POSTGRES_USER` / `POSTGRES_DB` | no (default `myreads`) | Postgres credentials for the compose `db` service |
| `POSTGRES_PASSWORD` | **yes** | Postgres password; compose refuses to start without it |
| `AUTH_SECRET` | **yes** | Signs session JWTs — generate with `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | yes (keep `true`) | Required by Auth.js on self-hosted deployments |
| `DATABASE_URL` | outside Docker only | Connection string for local dev / the Prisma CLI; inside Docker compose assembles it from the `POSTGRES_*` values |
| `GOOGLE_BOOKS_API_KEY` | no | Enables Google Books as search fallback + metadata enrichment |
| `COVERS_DIR` | no | Cover cache directory (Docker sets `/app/data/covers`; local dev defaults to `./data/covers`) |
| `DISABLE_REGISTRATION` | no | `true` blocks new accounts after you've made yours |
| `APP_PORT` | no | Host port for the app (default `3000`) |

## Local development

Requirements: Node 22+, a Postgres instance (the compose `db` service works
fine for this).

```bash
cp .env.example .env       # set POSTGRES_PASSWORD, AUTH_SECRET
# start just the database, with 5432 published on localhost (dev override —
# the base compose file deliberately keeps Postgres unexposed)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npm install
npx prisma migrate deploy  # apply migrations (DATABASE_URL points at localhost)
npm run dev                # http://localhost:3000
```

Useful scripts: `npm run build` (prisma generate + production build),
`npm run db:studio` (browse the DB), `npm run db:migrate` (apply migrations).

## Tech stack

- **[Next.js 15](https://nextjs.org/)** (App Router, TypeScript) — UI and API
  routes in one codebase, standalone output for a small Docker image
- **[PostgreSQL](https://www.postgresql.org/)** + **[Prisma](https://www.prisma.io/)**
- **[Auth.js v5](https://authjs.dev/)** (NextAuth) — Credentials provider,
  JWT sessions, bcryptjs hashing
- **[Tailwind CSS v4](https://tailwindcss.com/)** + **[shadcn/ui](https://ui.shadcn.com/)**
- **[Zod](https://zod.dev/)** for validation

## Architecture notes

```
src/
├─ app/
│  ├─ (auth)/          login & register (no nav shell)
│  ├─ (app)/           authenticated pages: books, books/new, books/[id],
│  │                   books/[id]/edit, stats
│  └─ api/             auth (Auth.js), register, metadata search/details,
│                      cached cover serving
├─ components/         UI (shadcn/ui in components/ui, app components beside)
├─ lib/
│  ├─ actions/books.ts server actions: create/update/delete + reading data
│  ├─ metadata/        Open Library + Google Books clients, DB cache layer
│  ├─ covers.ts        cover image download/cache
│  └─ validation.ts    zod schemas shared by actions and API routes
├─ auth.config.ts      edge-safe Auth.js config (used by middleware)
├─ auth.ts             full Auth.js config (Credentials + Prisma + bcrypt)
└─ middleware.ts       route protection
```

Design decisions worth knowing about:

- **Reading data lives on the Book row.** Books are per-user in this app, so
  a separate "reading entry" join model would add indirection for nothing.
  `timesRead` covers re-reads.
- **Ratings are integers 1–10** (half-star units); `7` renders as 3.5 stars.
- **Metadata caching is a read-through table** (`MetadataCache`) keyed by
  `(source, normalized query)` with a one-week TTL and stale-if-error
  fallback, so a flaky Open Library never breaks previously working lookups.
- **Cover images are cached locally.** On save, a remote cover URL is
  downloaded to `COVERS_DIR` and the book is repointed to
  `/api/covers/<id>.<ext>`; deletion cleans the file up. Failures are
  non-fatal (the remote URL simply stays).
- **Mutations are server actions** with per-user ownership checks;
  list/detail pages are server components querying Prisma directly. The only
  client-fetch API routes are the metadata endpoints (interactive search) and
  cover serving.
- **Migrations run on container start** (`prisma migrate deploy` in the
  entrypoint) — first boot creates the schema, upgrades apply pending
  migrations, and an already-migrated DB is a no-op.

## License

[MIT](LICENSE)
