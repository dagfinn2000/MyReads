# Everything MyReads can do

The [README](../README.md) has the short version. This is the full list,
page by page.

- [Adding books](#adding-books)
- [Reading](#reading)
- [Quotes](#quotes)
- [The library](#the-library)
- [Stats](#stats)
- [The reading room](#the-reading-room)
- [Look and feel](#look-and-feel)
- [Preferences](#preferences)
- [Backups](#backups)

## Adding books

- Search by title, author or ISBN and import the details from
  [Open Library](https://openlibrary.org/), with
  [Google Books](https://developers.google.com/books) (optional) and the
  [National Library of Norway](https://api.nb.no/) as extra sources. You
  choose which of them to search and in what order. Check and edit
  everything before saving, or type a book in by hand.
- Scan the barcode on a book with your phone's camera. Switch on Keep
  scanning to work through a whole shelf: each book is looked up and added
  as you scan it, with Undo, and books you already have are pointed out.
- "Add and add another" brings you straight back for the next book (with
  the camera open again if you scanned). In Preferences you choose what
  adding a book does: open it, add another, or go to the library.
- A book added as Read can say when you finished it, or that you don't
  remember, so years of old reading don't land in this year's stats. A book
  added as Currently Reading can say when you started and what page you're
  on.
- Subjects from the catalogues can be copied in as tags: all of them, only
  the tags you already use, or none. Renaming or removing a tag in Manage
  tags can apply to future imports too.
- "Look up details" on a book's edit page fills in what's missing, like a
  page count, from the catalogues.
- Choose a cover from the search results, paste an image link, or upload a
  photo. Covers are stored on your server.
- **Do I own this?** In a bookshop, scan a barcode on the Check page to see
  whether the book is already in your library.

## Reading

### Statuses and ratings

- Each book has a status (Want to Read, Currently Reading, Read, Did Not
  Finish), a rating, notes, and start and finish dates. Rate in half
  stars, whole stars or out of 10, or switch ratings off.
- Rename the four statuses, or add up to 12 of your own, each a kind of
  one of them: "Paused" under Currently Reading, say, or "On my shelf"
  under Want to Read. Each has its own colour, shows in every status
  menu and on the book's badge, and gets its own chip under its tab in
  the library. Stats, goals and challenges count a book on one of your
  own as the status it is a kind of. No two statuses can share a name.
- Re-reads are kept as history and count in your stats.

### Logging your reading

- **Now reading** lists the books you're reading. Log the page you're on,
  for today or an earlier day. Each book shows your pace and when you're
  likely to finish. A book you haven't logged for two weeks says when
  you last read it.
- In Preferences you can log ebooks in percent, and audiobooks in percent
  or in hours and minutes listened. Percent needs the book's page count,
  and time needs the audiobook's length too. Both go on the book's Edit
  page.

### Timer, daily goal and reminders

- **Reading timer.** Press Start timer when you sit down with a book, and
  the time goes with the next page you log (or type the minutes in). Once
  a book has some timed reading, it shows how many pages you read an hour
  and how long the rest will take, and Stats adds up your time read. The
  timer keeps going if you close the page or lock your phone, in the
  browser you started it in.
- **Daily goal.** Set one in pages or minutes in Preferences > Reading,
  and a ring on Now reading fills as you read through the day, with a
  little confetti when you reach it. Minutes come from the reading timer
  or the time you type in. The ring counts the days in a row you've met
  the goal, and the Reading days calendar on Stats says how many days you
  met it in the last year.
- **Reading reminders.** A notification on your phone or computer at the
  time you choose, on the days you choose, naming the book you read last
  and what's left of your daily goal. By default none comes on a day
  you've already read. Turn them on in each browser you want them in
  under Preferences > Reading reminders, which lists them all with a
  Test button. They need MyReads opened over https, and on an iPhone or
  iPad, MyReads added to the Home Screen.

### Up next and On this day

- **Up next.** Add Want to Read books to your own list, from their page or
  from Now reading, and put them in order. They come first in Up next on
  Now reading, before the suggestions (the next book of a series you're
  reading, then the books you added last). Starting or finishing a book
  takes it off, and you can take one off yourself on its page or in Edit
  list.
- **On this day.** Now reading remembers what you finished or started on
  today's date in earlier years, and a quote you saved on it.

![Now reading, with the daily goal met, a timer running and the Up next list](now-reading.png)

## Quotes

- Save favourite quotes with page numbers, and search all of them on the
  Quotes page.
- **Import from Kindle.** On the Quotes page, bring in your highlights.
  Connect your Kindle to a computer and pick `My Clippings.txt` from its
  documents folder. Before anything is saved, you check which book in
  your library each Kindle book's highlights go into. Notes you made on
  the Kindle come along too, and importing the same file again only adds
  new ones. The file stays on your device: only the highlights you import
  are saved.

## The library

- Custom shelves, tags, series in reading order, format (physical, ebook,
  audiobook) and ownership (owned, wishlist, borrowed from someone, no
  longer have it).
- **Your own fields.** Add up to 20 fields of your own to every book:
  text, a number, a date, yes or no, or a choice from your own list
  ("Where it lives", "Price paid", "Signed", "Edition"). Fill them in on
  the add and edit forms; they show with the book's details on its page.
  The library's search finds text and choices, and More filters finds
  books with or without a value, with a given choice or yes/no, or with a
  number or date in a range.
- Keep track of the books you've lent out, who has them and since when,
  on each book's Lending card. Give a loan a day it's due back (Preferences
  can fill one in, say a month after you lend it). Past that day the book
  turns red, shows under the Overdue filter, and a note on the Library and
  Now reading pages reminds you who has it.
- Search, filter, sort and group the library. Authors sort by surname, the
  way a bookshelf is filed.
- **The Series page** shows every series you have, the series you're in
  the middle of first: how much of each you've read, which book is next,
  and an empty place for each number you have no book for. Open it from a
  series heading in the library or "What's next in the series" on a
  book's page, or put it in the top bar from Preferences.
- "Pick for me" opens a random book from the ones on screen, keeping to
  your filters. On the All tab it picks from Want to Read first. In
  Preferences you can have it pick only books you have, or only the next
  book in a series.
- Show the library as cards, bare covers or a bookshelf, in three sizes, or
  as a list, and choose what each book shows. Covers can look like little
  hardbacks, and books without a cover get one drawn with their title.
- Save the searches and filters you use often as views, and open the
  library on one of them if you like.
- A book opened from the library has an X in its corner (or press Esc)
  that takes you back to the same spot in the library, with your filters
  still on.
- Edit many books at once: set their status, format or ownership, add or
  remove tags, put them on a shelf or take them off it, or delete them.
  Pick the books on screen, or every book that matches your filters.
- Rename, merge, reorder and hide shelves, and choose which status tabs the
  library shows. Saved views can be renamed and reordered too.

## Stats

- Books read per year, pages read, ratings, genres and formats, and a
  calendar of the days you read. Look at all time, this year, the last 12
  months or the last 30 days.
- **Reading habits:** which days of the week you read most, pages on an
  average reading day, how long a book takes you from start to finish, and
  with the timer your average sitting and pages an hour.
- Decide what counts in your stats. Pages read can mean a whole book's
  pages when you finish it, or the pages you log as you go. You also
  choose whether books you stop reading count, and how audiobooks count.
- A "year in review" page for every year.
- Yearly reading goals in books, pages or days you read, with or without
  re-reads. The goal shows whether you're on track, and next year's can be
  set ahead of time.
- **Monthly goals:** a goal for every month of the year, such as 2 books or
  reading on 20 days. Twelve month cells show which months made it, and
  this month says how to catch up.
- **Challenges:** a goal for part of your library, such as "6 classics in
  2026". Make one from a tag, a shelf or a saved view; it shows the covers
  of the books that count so far, and a medal once it's done.

## The reading room

The Room page draws your library as a cozy pixel-art house.

- Every book is a spine on a shelf, filed by author and coloured from its
  cover, with thick books on wide spines. Point at one to see its title,
  and click it to open the book. The book's X puts it back on its shelf.
- A ribbon marks the books you're reading. Books on your wishlist, lent
  out or given away keep their place as an outline.
- The house grows with your library: more bookcases, then more floors.
  Furniture moves in as you add books: a plant, a cat asleep in the
  armchair, a grandfather clock, a library ladder, a window seat, a
  writing desk and a gramophone.
- Light themes show it by day. Dark themes show it at night, with the
  lamps lit and the fire glowing.

Everything below is under **Decorate** on the Room page.

### The house

- Thirteen house styles, each with its own roof, walls, door and garden:
  a cottage, a castle (with a banner on the battlements), a wizard's
  house, an elven hall (fireflies among the birches at night), a cave in
  a hill, a space station (with a blinking beacon), a modern house, a log
  cabin, a tea house, a workshop (a gear turning on the gable), a
  lighthouse (its beam sweeping round at night), a windmill (its sails
  turning over the thatch) and an adobe house with cacti in the garden.
  Most have smoke rising from the chimney.
- The colour of the walls, the wood and the fabrics.
- Wallpaper (stripes, damask, flowers, trellis, stars, stone, tiles, Delft
  tiles, paper screens and more) and floors (boards, wide planks, parquet, flagstones,
  chequered tiles, carpet, tatami or a metal grate).
- Fairy lights, bunting, paper lanterns or ivy along the ceilings. At
  night the fairy lights twinkle.
- Windows (sash, arched, round, shuttered or leaded) wherever the wall
  above the furniture is clear, with the sky outside by day and the moon
  and stars at night.
- Pictures on the bare walls of every room, taking turns with the windows:
  paintings, portraits in oval frames (the cat of the house has one),
  botanical prints, maps and star charts, groups of old photographs, or a
  bit of each.

### By the fire

- The fireplace: stone, brick, marble, blue tiles, or modern, which burns
  along a bed of stones.
- The armchair: a wingback, club chair, Chesterfield, lounge chair or
  carved chair.
- The rug: fringed, Persian, braided, kilim, a sheepskin or none.
- The lamp: a standard lamp, a Tiffany lamp, an arc lamp, a candle stand
  or a paper lantern, all lit at night.
- Over the fireplace: a painting or one of five tapestries.
- The chair and the rug take the fabric colour.

### Bookcases

- Classic, open shelves with the wallpaper showing behind the books, a
  pediment, Gothic pinnacles, or a barrister's case with a glass door over
  each shelf.
- A few ornaments beside the books, plenty of them (a pile of books lying
  flat, a cactus in flower, a china bird, an inkwell and more), or none.

### Rooms and furniture

- Add rooms: a kitchen with the kettle on the range, a bedroom under a
  patchwork quilt, a music room, a conservatory with a songbird, a games
  room with a billiard table, a studio with an easel, a bathroom with a
  bubble bath, a dining room under a chandelier, a nursery with a mobile
  over the cot, a woodshop, a sauna with steam rising off the stove, or a
  spare room to fill yourself.
- Each room goes upstairs on a floor of its own, or next to the library
  (or the room before it) where the screen has space. The wall between
  has a door. When the room is on the same floor as the fireplace, the
  door opens as your little you walks through.
- Each added room can have its own wall colour, wallpaper and floor. The
  bathroom comes tiled and the sauna panelled in logs.
- Add furniture from a catalogue: a Chesterfield sofa, a rocking chair, an
  aquarium with fish swimming in it, a spaniel asleep in its basket, a suit
  of armour, a sea chest, a coat stand, a telescope, a rocking horse, a
  curio cabinet, a spinning wheel, a bean bag, a macaw on its perch, a
  monstera, a standing mirror, a wood stove, an old radio playing, a tea
  trolley and a dollhouse. Each goes wherever there's space.
- Press Move furniture, then drag a piece to where you like it, or select
  it and use the arrow keys. The bookcases stay in the order of your
  books. To put a piece away, untick it under Furniture in Decorate.

### Outside and the seasons

- Grow ivy, climbing roses or wisteria up the outside walls. Plant flower
  beds, bushes and trees round the house, and put up a picket fence if you
  like. (A cave is dug into its hill, so it has neither.)
- Pick the time of year, or follow the calendar (with northern seasons,
  so winter starts in December): blossom, tulips and
  daffodils in spring; gold and red leaves falling in autumn, with
  chrysanthemums in the beds and red ivy; in winter bare trees, snowdrops,
  snow on the roof and in the garden, icicles under the eaves and snow
  falling. The view from the windows changes with it.

### Holidays

- Decorate for Christmas, Halloween, Easter, Midsummer or New Year's Eve,
  all year round, or let "Follow the calendar" put each up in its own
  days: Christmas from 1 December to 6 January, Halloween from 24
  October, Easter from Palm Sunday to Easter Monday, Midsummer from 20 to
  24 June, and New Year's Eve and Day.
- **Christmas:** a tree with twinkling lights, a star, baubles and parcels
  beside the hearth, or on another floor with room (with no room
  anywhere, a little tree on the mantelpiece), a garland along the mantel,
  coloured lights along the eaves and a wreath on the doors between rooms.
- **Halloween:** carved pumpkins flickering on the mantel and by the
  house, and cobwebs in the corners of every room.
- **Easter:** birch twigs hung with eggs and feathers on the mantel, and
  painted eggs hidden in the grass.
- **Midsummer:** a garland of flowers along the eaves and a bonfire in the
  garden.
- **New Year's Eve:** streamers in every room and fireworks in the sky.

### Your avatar and pet

Make a little you who lives in the house. They potter about and stop by
the fire, and while you're reading a book they sit in the armchair reading
it (the cat moves to the rug). With animations off they stand still by the
fire.

- **Face:** ten skin tones (an elf or a spaceman too), eyes in seven
  colours, round or pointed ears, a mouth, blush, freckles or a beauty
  spot (or all three), and a beard.
- **Hair:** 23 hairstyles in 14 colours.
- **Body:** three heights, and four body shapes: slim, average, broad or
  round. Get about on foot, with a walking stick or in a wheelchair.
- **Clothes:** jumpers, T-shirts, shirts, cardigans, hoodies, a waistcoat,
  a long coat, a dress or a robe; trousers, jeans, shorts, skirts or
  dungarees, in colours of your choosing; and six kinds of shoes.
- **Hats and extras:** 24 hats from a beanie to a halo (a headscarf, a
  turban, a head wrap and a kippah among them), and as many extras as you
  like: glasses, sunglasses, a monocle, an eye patch, hearing aids,
  earrings, a necklace, a scarf, a bow tie, headphones, a backpack, a cape
  and fairy wings.
- **Something to carry:** a mug of tea, a book, a lantern, a magic wand, a
  teddy bear or a sunflower.
- **Saved looks:** keep up to six to switch between, or let Surprise me
  pick.
- **A pet:** a cat, a dog, a rabbit, a hedgehog, a fox or a little dragon
  trots at your avatar's heels and curls up at its feet while it reads.
- **Coats:** choose the coat of every cat in the house (ginger, tabby,
  black, white, grey, calico or Siamese) and of the dog.

### Not for you?

Turn the reading room off in Preferences, or from Decorate, and the Room
tab goes away. You can also keep the house and leave the avatar out.

## Look and feel

- 52 colour themes, or a light and a dark one that switch with your
  device, with an accent colour of your own on top if you like. Your
  choice follows you to every device you sign in on, unless you give one
  phone or computer a theme of its own ("Only on this device" in the
  palette menu). The palette menu shows each theme as a small round
  swatch, the page colour with the accent as a dot: point at one to see
  its name, or tap it to try it.
- Eleven of the themes put together colours you rarely see side by side:
  - Dark: Bordeaux (wine red and sea-glass green), Riviera (ultramarine
    and peach), Provence (olive and lavender), Terracotta (clay and sky
    blue), Dragonfruit (magenta and lime) and Iris (royal purple and
    saffron).
  - Light: Rhubarb (pink and green), Majorelle (lemon yellow and cobalt),
    Lido (aqua and red), Absinthe (chartreuse and aubergine) and Marigold
    (orange and magenta).
- Ten more are different kinds of theme rather than new colours:
  - Blueprint (white lines on blueprint blue) and Chalkboard (chalk and
    yellow on a green board), each in just two colours.
  - Terminal (green on black) and Art Deco (gold on black), each in one
    colour.
  - High Contrast Dark (white and yellow on black) and High Contrast Light
    (black and blue on white), with the strongest contrast of any theme.
  - Newsprint, all greys with one red; Macaron, mint, pink, lilac and
    lemon together; Kraft, brown parcel paper with red; and Notebook,
    ruled-paper white with the text in blue ink.
- The Silly set, listed apart at the bottom of the palette menu as "not
  recommended": Blue Screen, Glowstick, Hot Dog Stand, Toxic and
  Desktop 95. They are as easy to read as the rest, only nobody should
  want them. Hover over one in the menu for a word about it.
- A theme for each part of the app if you like: Stats in one theme, the
  reading room in another, the rest in your usual one (Preferences).
- Your own CSS, added after the app's styles on every page but the
  Account page, where you edit it. Each page says which part it is
  (`data-section` on the `html` element), so a rule can aim at one part.
  Add `?css=off` to any address to see that page without it.
- 26 background textures. Five of them move: rain falls on Rain, snow
  drifts on Snow, and stars twinkle on Starry night (on dark themes, a
  star now and then shoots across the sky). The light shifts on Aurora,
  and drops ripple the pond on Ripples. Sky changes colour with the time
  of day where you are.
- A little motion: pages fade in, a book's cover flies to its page and
  back into its place in the library when you close it, bars fill up,
  finishing a book or reaching your goal sets off confetti, and the
  reading room's fire flickers.
- Animations can be turned off, or only the backgrounds kept still. They
  stay off when your device asks for reduced motion.
- Sounds, if you turn them on: a rustle of paper when you log pages, a
  chime when you finish a book, a little flourish when you reach your
  daily goal, a soft thunk when you add a book and a tick when you rate
  one. Quiet, medium or loud. They only ever answer something you just
  did, and they are made in the browser, with nothing to download.
- Install MyReads on your phone's home screen like an app.

## Preferences

On the Account page:

- Date and number formats, your time zone and the first day of the week.
- How titles and authors sort, with Norwegian, Danish, Swedish and German
  alphabets.
- What new books start as, and which book catalogues to search.
- How you log reading: the step buttons, page or percent for ebooks, page,
  percent or time for audiobooks, where your pace comes from, and the
  daily goal.
- When reading reminders come, and the browsers they come to.
- The rating style, and what counts in your stats.
- Names for the statuses, and statuses of your own.
- Fields of your own on every book, and the choices a choice field offers.
- Which status tabs the library shows, what its search also looks in
  (tags, ISBN, your review), and what Pick for me leaves out.
- How long you usually lend books for, and whether overdue books remind
  you.
- The accent colour, text size, a serif font for reviews and quotes, the
  font for headings, how round the corners are, flat, raised or frosted
  cards, the background texture, and a wash of the cover's colours behind
  the top of each book's page.
- Animations on or off, and whether the moving backgrounds move.
- The book page: which cards show and in what order, long descriptions in
  full or cut short, and your own "Find it at" links.
- Which page opens first, and the top bar: its links in your own order,
  with Now reading, Check and Quotes left out or Series added if you like
  (phones get the same links, as icons). Also which cards show on the
  Stats page.
- The reading room and your avatar, on or off.
- Keyboard shortcuts on a computer, on unless you turn them off: `?` lists
  them, `/` searches the library, `n` adds a book, `g` and a letter goes to
  a page in your top bar, and `e` edits the book whose page you're on.

## Backups

- Download a backup from the Account page: a zip with everything, covers
  and settings included.
- Restore it on any MyReads server. Books you already have are skipped,
  so restoring twice is safe.
- The Backup card shows when you last made one. Set its "Remind me to
  back up" to Every month, and a note on the Library and Stats pages
  reminds you when your last backup is over a month old.
- The server saves a copy of every library each night too, and keeps the
  newest 7 of them (on with Docker; `BACKUP_DIR`, `BACKUP_HOUR` and
  `BACKUP_KEEP` in [.env.example](../.env.example)). The Backup card lists
  your copies, newest first, each with its own Download link.
