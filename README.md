# MyReads

A book library you host yourself, for one reader. Think of it as Goodreads
without the social side: keep track of the books you own, what you're
reading, and what you thought of them, on your own server.

![The library page with status shelves, search, filters and covers](docs/library.png)

## What it does

**Adding books**

- Search by title, author or ISBN and import the details from
  [Open Library](https://openlibrary.org/), with
  [Google Books](https://developers.google.com/books) (optional) and the
  [National Library of Norway](https://api.nb.no/) as extra sources. You
  choose which of them to search and in what order. You can check and edit
  everything before saving, or type a book in by hand.
- Scan the barcode on a book with your phone's camera.
- Choose a cover from the search results, paste an image link, or upload a
  photo. Covers are stored on your server.
- **Do I own this?** In a bookshop, scan a barcode on the Check page to see
  whether the book is already in your library.

**Tracking your reading**

- Status (Want to Read, Currently Reading, Read, Did Not Finish), ratings,
  notes, and start and finish dates. Rate in half stars, whole stars or out
  of 10, or switch ratings off.
- Update your current page as you go. The book page shows your pace and when
  you're likely to finish.
- Re-reads are kept as history and count in your stats.
- Save favourite quotes with page numbers, and search all of them on the
  Quotes page.

**Organising your library**

- Custom shelves, tags, series in reading order, format (physical, ebook,
  audiobook) and ownership (owned, wishlist, borrowed, no longer have it).
- Keep track of who borrowed your books and when.
- Search, filter, sort and group the library. Authors sort by surname, the
  way a bookshelf is filed. "Pick for me" opens a random book from Want to
  Read.
- Show the library as cards, bare covers or a bookshelf, in three sizes, or
  as a list, and choose what each book shows. Covers can look like little
  hardbacks, and books without a cover get one drawn with their title. Save
  the searches and filters you use often as views, and open the library on
  one of them if you like.
- Edit many books at once: set their status, format or ownership, add or
  remove tags, put them on a shelf or take them off it, or delete them.
  Pick the books on screen, or every book that matches your filters.
- Rename, merge, reorder and hide shelves, and choose which status tabs the
  library shows. Saved views can be renamed and reordered too.

**Stats**

- Books read per year, pages read, ratings, genres and formats, and a
  calendar of the days you read. Look at all time, this year, the last 12
  months or the last 30 days.
- Decide what counts: whole books when you finish them or the pages you
  log, whether books you stop reading count, and how audiobooks count.
- A "year in review" page for every year, and yearly reading goals in books
  or pages, with or without re-reads. The goal shows whether you're on
  track, and next year's can be set ahead of time.

**Everything else**

- Download a backup (a zip with everything, covers and settings included)
  and restore it on any MyReads server.
- 26 colour themes, or a light and a dark one that switch with your device,
  with an accent colour of your own on top if you like. Your choice follows
  you to every device you sign in on.
- Preferences on the Account page: date and number formats, your time zone
  and the first day of the week, how titles and authors sort, what new books
  start as, text size, a serif font for reviews and quotes, the font for
  headings, how round the corners are, a background texture, which
  page opens first, and which links and stats cards you see.
- A little motion: pages fade in, a book's cover flies to its page, bars
  fill up, and finishing a book or reaching your goal sets off confetti.
  Animations can be turned off, and stay off when your device asks for
  reduced motion.
- Install it on your phone's home screen like an app.

Deliberately out of scope: anything social, recommendation engines, and CSV
import.

## Screenshots

<details>
<summary>Show screenshots: book page, adding a book, cover picker, series, stats, year in review, themes</summary>

**Book page**: details, the rest of the series, shelves, and your own
reading data.

![Book page](docs/book-page.png)

**Adding a book**: search by title, author or ISBN, or scan the barcode, then
pick a result to fill in the form.

![Search and import](docs/add-book.png)

**Cover picker**: covers from all sources, with exact matches for your
edition first.

![Cover picker](docs/cover-picker.png)

**Grouped by series**, in reading order:

![Library grouped by series](docs/series-grouping.png)

**Stats and reading goals**:

![Stats page](docs/stats.png)

**Year in review**:

![Year in review](docs/year-in-review.png)

**Themes**: a dark theme, and the theme picker.

![Library in a dark theme](docs/library-dark.png)

![Theme picker](docs/themes.png)

</details>

## Install

You need [Docker](https://docs.docker.com/get-docker/) with Docker Compose.

1. Get the code and make a settings file:

   ```bash
   git clone https://github.com/dagfinn2000/MyReads.git
   cd MyReads
   cp .env.example .env
   ```

2. Open `.env` and change two values:
   - `POSTGRES_PASSWORD`: any long random string.
   - `AUTH_SECRET`: paste the output of `openssl rand -base64 32`.

3. Start MyReads:

   ```bash
   docker compose up -d
   ```

4. Open <http://localhost:3000>, register an account, and add your first
   book.

The first start builds the app, so it takes a while. The database is set up
automatically.

## After installing

- **Close registration.** Once you have your account, set
  `DISABLE_REGISTRATION=true` in `.env` and run `docker compose up -d` again
  so nobody else can sign up.
- **Use HTTPS for the phone features.** Browsers only allow the barcode
  camera and installing the app on HTTPS or `localhost`, so on a plain
  `http://192.168.x.x` address they won't work. Put MyReads behind a reverse
  proxy with HTTPS (for example Caddy, nginx or Traefik). Barcode scanning
  works in Chrome and Edge, including Chrome on Android.
- **Make backups.** On the Account page, **Download backup** saves
  everything as a zip. **Restore backup** on the same page loads one into any
  MyReads server. Books you already have are skipped, so restoring twice is
  safe. The Backup card shows when you last downloaded one, and its
  **Remind me to back up** setting (not in Preferences) can put a note on
  the Library and Stats pages once a month.
- **Know where your data is.** The library lives in two Docker volumes:
  `pgdata` (the database) and `covers` (cover images).
- **Update.** Run `git pull`, then `docker compose up -d --build`. Database
  changes are applied automatically when the app starts.

## Server settings

These are the settings in `.env` you are most likely to change. The rest are
explained in [.env.example](.env.example). Personal choices are made in the
app instead: date formats, time zone and the rest under Preferences on the
Account page, and the theme with the palette button in the top bar.

| Setting | Needed? | What it does |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | **yes** | Password for the database. |
| `AUTH_SECRET` | **yes** | Secret that signs logins. Make one with `openssl rand -base64 32`. |
| `DISABLE_REGISTRATION` | no | `true` stops new accounts from being created. |
| `GOOGLE_BOOKS_API_KEY` | no | Adds Google Books to search, which often has better descriptions and page counts. |
| `APP_PORT` | no | Port MyReads runs on (default `3000`). |

## Cleaning up cover images

Cover images that no book uses any more, for example from an upload you
never saved, stay on disk. To see how many there are, then delete them:

```bash
docker compose exec app node scripts/prune-covers.mjs        # report only
docker compose exec app node scripts/prune-covers.mjs --yes  # delete
```

Files less than a day old are always kept. Old search results are cleaned up
automatically every time the app starts.

## Development

MyReads is a [Next.js](https://nextjs.org/) app with PostgreSQL and
[Prisma](https://www.prisma.io/). To run it without Docker you need Node 22+
and a Postgres database. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for
setup, tests, the project layout and the main design decisions.

## License

[MIT](LICENSE)
