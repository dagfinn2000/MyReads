import { describe, expect, it } from "vitest";
import {
  BOOK_PAGE_CARDS,
  DEFAULT_PREFERENCES,
  MAX_FIND_LINKS,
  MAX_TAG_RULES,
  START_PAGES,
  START_PAGE_PATHS,
  cleanPreferencesPatch,
  findLinkError,
  isValidTimeZone,
  normalizeRuleTag,
  parsePreferences,
} from "@/lib/preferences";

describe("parsePreferences", () => {
  it("gives the defaults for nothing stored", () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences("nonsense")).toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps valid values and defaults the rest", () => {
    const prefs = parsePreferences({
      dateFormat: "iso",
      ratingStyle: "ten",
      weekStart: "fortnight", // not a value
      newBookStatus: "READING",
      importTagsMode: "some", // not a value
    });
    expect(prefs.dateFormat).toBe("iso");
    expect(prefs.ratingStyle).toBe("ten");
    expect(prefs.weekStart).toBe("monday");
    expect(prefs.newBookStatus).toBe("READING");
    expect(prefs.importTagsMode).toBe("all");
  });

  it("keeps known list entries once, in the order given", () => {
    const prefs = parsePreferences({
      catalogues: ["nb", "bogus", "openlibrary", "nb"],
      hiddenStats: ["quote", "quote", "goal", 7],
    });
    expect(prefs.catalogues).toEqual(["nb", "openlibrary"]);
    expect(prefs.hiddenStats).toEqual(["quote", "goal"]);
  });

  it("searches every catalogue rather than none", () => {
    expect(parsePreferences({ catalogues: [] }).catalogues).toEqual(
      DEFAULT_PREFERENCES.catalogues,
    );
  });

  it("keeps the appearance settings and defaults unknown ones", () => {
    expect(parsePreferences({ motion: "off" }).motion).toBe("off");
    expect(parsePreferences({ motion: "wobbly" }).motion).toBe("on");
    expect(parsePreferences({ coverArt: "plain" }).coverArt).toBe("plain");
    expect(parsePreferences({ coverArt: 3 }).coverArt).toBe("drawn");
    expect(parsePreferences({ accent: "teal" }).accent).toBe("teal");
    expect(parsePreferences({ accent: "#ff0000" }).accent).toBe("theme");
    expect(parsePreferences({ headingFont: "serif" }).headingFont).toBe("serif");
    expect(parsePreferences({ headingFont: "Comic Sans" }).headingFont).toBe("sans");
    expect(parsePreferences({ corners: "square" }).corners).toBe("square");
    expect(parsePreferences({ corners: "0px" }).corners).toBe("rounded");
    expect(parsePreferences({ background: "dots" }).background).toBe("dots");
    expect(parsePreferences({ background: "books" }).background).toBe("books");
    expect(parsePreferences({ background: "url(x)" }).background).toBe("plain");
    expect(parsePreferences({ background: "aurora" }).background).toBe("aurora");
    expect(parsePreferences({ background: "ripples" }).background).toBe("ripples");
    expect(parsePreferences({ background: "snow" }).background).toBe("snow");
    expect(parsePreferences({ background: "sky" }).background).toBe("sky");
    expect(parsePreferences({}).backgroundMotion).toBe("moving");
    expect(parsePreferences({ backgroundMotion: "still" }).backgroundMotion).toBe("still");
    expect(parsePreferences({ backgroundMotion: false }).backgroundMotion).toBe("moving");
    expect(parsePreferences({ cardStyle: "frosted" }).cardStyle).toBe("frosted");
    expect(parsePreferences({ cardStyle: "glass" }).cardStyle).toBe("raised");
    expect(parsePreferences({ bookBackdrop: "plain" }).bookBackdrop).toBe("plain");
    expect(parsePreferences({ bookBackdrop: true }).bookBackdrop).toBe("cover");
  });

  it("drops a time zone the runtime doesn't know", () => {
    expect(parsePreferences({ timeZone: "Europe/Oslo" }).timeZone).toBe("Europe/Oslo");
    expect(parsePreferences({ timeZone: "Mars/Olympus" }).timeZone).toBe("");
  });
});

describe("parsePreferences: the newer settings", () => {
  it("defaults each one", () => {
    const prefs = parsePreferences({});
    expect(prefs).toMatchObject({
      importTagsMode: "all",
      tagRenames: [],
      tagSkips: [],
      addedAsReadFinished: "today",
      afterAdd: "open",
      pickOnlyHave: false,
      pickNextInSeries: false,
      quickLogSteps: "10-25",
      ebookUnit: "page",
      audiobookUnit: "page",
      paceFrom: "read",
      bookPageCards: [...BOOK_PAGE_CARDS],
      hiddenBookPageCards: [],
      bookDescription: "full",
      shelvesCard: "all",
      findLinks: [],
      searchAlsoIn: [],
      shelfOrder: [],
      hiddenShelves: [],
      savedViewOrder: [],
      hiddenStatusTabs: [],
      statsPagesRead: "finished",
      statsStoppedBooks: "none",
      statsAudiobooks: "full",
      statsPeriod: "all",
      statsBreakdown: "library",
      quotesOrder: "newest",
      quotesGroupByBook: false,
      backupReminder: "off",
    });
  });

  it("keeps valid choices and defaults invalid ones", () => {
    const valid = parsePreferences({
      addedAsReadFinished: "undated",
      afterAdd: "another",
      quickLogSteps: "5pct",
      ebookUnit: "percent",
      audiobookUnit: "time",
      paceFrom: "14d",
      bookDescription: "clamp",
      shelvesCard: "mine",
      statsPagesRead: "logged",
      statsStoppedBooks: "pages",
      statsAudiobooks: "out",
      statsPeriod: "30d",
      statsBreakdown: "period",
      quotesOrder: "shuffle",
      backupReminder: "monthly",
      pickOnlyHave: true,
      pickNextInSeries: true,
      quotesGroupByBook: true,
    });
    expect(valid).toMatchObject({
      addedAsReadFinished: "undated",
      afterAdd: "another",
      quickLogSteps: "5pct",
      ebookUnit: "percent",
      audiobookUnit: "time",
      paceFrom: "14d",
      bookDescription: "clamp",
      shelvesCard: "mine",
      statsPagesRead: "logged",
      statsStoppedBooks: "pages",
      statsAudiobooks: "out",
      statsPeriod: "30d",
      statsBreakdown: "period",
      quotesOrder: "shuffle",
      backupReminder: "monthly",
      pickOnlyHave: true,
      pickNextInSeries: true,
      quotesGroupByBook: true,
    });

    const invalid = parsePreferences({
      ebookUnit: "time", // audiobooks only
      paceFrom: "30d",
      quotesOrder: "random",
      backupReminder: "weekly",
      pickOnlyHave: "yes",
      statsPeriod: 2024,
    });
    expect(invalid.ebookUnit).toBe("page");
    expect(invalid.paceFrom).toBe("read");
    expect(invalid.quotesOrder).toBe("newest");
    expect(invalid.backupReminder).toBe("off");
    expect(invalid.pickOnlyHave).toBe(false);
    expect(invalid.statsPeriod).toBe("all");
  });

  it("reads the old importTags switch", () => {
    expect(parsePreferences({ importTags: false }).importTagsMode).toBe("off");
    expect(parsePreferences({ importTags: true }).importTagsMode).toBe("all");
    expect(parsePreferences({ importTags: "no" }).importTagsMode).toBe("all");
    // The newer setting wins once it's saved.
    expect(parsePreferences({ importTags: false, importTagsMode: "known" }).importTagsMode).toBe(
      "known",
    );
  });

  it("offers Now reading as a start page and a top-bar link", () => {
    expect(START_PAGES).toContain("reading");
    expect(START_PAGE_PATHS.reading).toBe("/reading");
    expect(parsePreferences({ startPage: "reading" }).startPage).toBe("reading");
    expect(parsePreferences({ hiddenNav: ["reading", "quotes"] }).hiddenNav).toEqual([
      "reading",
      "quotes",
    ]);
  });

  it("always lists every book-page card once", () => {
    expect(parsePreferences({ bookPageCards: ["quotes", "bogus", "quotes"] }).bookPageCards).toEqual(
      ["quotes", "shelves", "reading", "history", "lending"],
    );
    expect(
      parsePreferences({ bookPageCards: ["lending", "history", "reading", "shelves", "quotes"] })
        .bookPageCards,
    ).toEqual(["lending", "history", "reading", "shelves", "quotes"]);
    expect(parsePreferences({ bookPageCards: "quotes" }).bookPageCards).toEqual([
      ...BOOK_PAGE_CARDS,
    ]);
    expect(parsePreferences({ hiddenBookPageCards: ["quotes", "nope"] }).hiddenBookPageCards).toEqual(
      ["quotes"],
    );
  });

  it("keeps known search fields", () => {
    expect(parsePreferences({ searchAlsoIn: ["review", "notes", "tags", "tags"] }).searchAlsoIn).toEqual(
      ["review", "tags"],
    );
    expect(parsePreferences({ searchAlsoIn: "tags" }).searchAlsoIn).toEqual([]);
  });

  it("keeps id lists to ids, once each, up to the cap", () => {
    const prefs = parsePreferences({
      shelfOrder: ["cma1", "cma2", "cma1", 7, "has space", "x".repeat(65), ""],
      hiddenShelves: "cma1",
      savedViewOrder: ["v_1", "v-2"],
    });
    expect(prefs.shelfOrder).toEqual(["cma1", "cma2"]);
    expect(prefs.hiddenShelves).toEqual([]);
    expect(prefs.savedViewOrder).toEqual(["v_1", "v-2"]);
    const many = Array.from({ length: 600 }, (_, i) => `id${i}`);
    expect(parsePreferences({ shelfOrder: many }).shelfOrder).toEqual(many.slice(0, 500));
  });

  it("never hides every status tab", () => {
    expect(parsePreferences({ hiddenStatusTabs: ["DNF", "BOGUS"] }).hiddenStatusTabs).toEqual([
      "DNF",
    ]);
    const all = ["WANT_TO_READ", "READING", "READ", "DNF"];
    expect(parsePreferences({ hiddenStatusTabs: all }).hiddenStatusTabs).toEqual([]);
    expect(cleanPreferencesPatch({ hiddenStatusTabs: all })).toEqual({ hiddenStatusTabs: [] });
  });

  it("keeps valid Find it at links, trimmed, up to the cap", () => {
    const good = { name: " Library ", url: " https://example.org/search?q={isbn} " };
    const prefs = parsePreferences({
      findLinks: [
        good,
        { name: "Plain", url: "http://example.org" },
        { name: "Script", url: "javascript:alert(1)" },
        { name: "Odd", url: "https://example.org/{publisher}" },
        { name: "Brace", url: "https://example.org/{isbn" },
        { name: "", url: "https://example.org" },
        { name: "x".repeat(41), url: "https://example.org" },
        { name: "Long", url: `https://example.org/${"a".repeat(500)}` },
        { name: 5, url: null },
        [["nested"]],
        "https://example.org",
      ],
    });
    expect(prefs.findLinks).toEqual([
      { name: "Library", url: "https://example.org/search?q={isbn}" },
    ]);
    const seven = Array.from({ length: 7 }, (_, i) => ({
      name: `Shop ${i}`,
      url: `https://shop${i}.example/{title}`,
    }));
    expect(parsePreferences({ findLinks: seven }).findLinks).toHaveLength(MAX_FIND_LINKS);
  });

  it("explains what's wrong with a Find it at link", () => {
    expect(findLinkError("", "https://a.example")).toBe("Give the link a name.");
    expect(findLinkError("A", "")).toBe("Add the link.");
    expect(findLinkError("A", "ftp://a.example")).toBe("Links must start with https://.");
    expect(findLinkError("A", "https://a.example/{year}")).toBe(
      "Only {isbn}, {title} and {author} can be filled in.",
    );
    expect(findLinkError("A", "https://user:pw@a.example")).toBe("That isn't a web address.");
    expect(findLinkError("A", "https://a.example/s?t={title}&a={author}")).toBeNull();
  });

  it("normalises tag rules, newest rule winning", () => {
    expect(normalizeRuleTag("  Science Fiction ")).toBe("science fiction");
    expect(normalizeRuleTag("a, b")).toBeNull();
    expect(normalizeRuleTag("x".repeat(51))).toBeNull();
    expect(normalizeRuleTag(3)).toBeNull();

    const prefs = parsePreferences({
      tagRenames: [
        { from: "Science Fiction", to: "sci-fi" },
        { from: "fantasy", to: "Fantasy" }, // same tag either way
        { from: "science fiction", to: "sf" },
        { from: "x", to: 4 },
        "nope",
      ],
      tagSkips: ["Fiction", "fiction", " ", "general"],
    });
    expect(prefs.tagRenames).toEqual([{ from: "science fiction", to: "sf" }]);
    expect(prefs.tagSkips).toEqual(["fiction", "general"]);

    const many = Array.from({ length: MAX_TAG_RULES + 5 }, (_, i) => `t${i}`);
    const capped = parsePreferences({ tagSkips: many }).tagSkips;
    expect(capped).toHaveLength(MAX_TAG_RULES);
    expect(capped.at(-1)).toBe(`t${MAX_TAG_RULES + 4}`);
  });
});

describe("parsePreferences: the reading room", () => {
  it("keeps a chosen style and colours, and defaults anything else", () => {
    const prefs = parsePreferences({
      roomStyle: "elven",
      roomWalls: "sage",
      roomWood: "plywood", // not a value
      roomFabric: "teal",
      roomHanging: "stag",
    });
    expect(prefs.roomStyle).toBe("elven");
    expect(prefs.roomWalls).toBe("sage");
    expect(prefs.roomWood).toBe("style");
    expect(prefs.roomFabric).toBe("teal");
    expect(prefs.roomHanging).toBe("stag");
    expect(parsePreferences({ roomStyle: "igloo" }).roomStyle).toBe("cottage");
  });

  it("keeps one sound place for each piece of furniture", () => {
    const prefs = parsePreferences({
      roomLayout: [
        { kind: "hearth", floor: 1, slot: 0 },
        { kind: "hearth", floor: 0, slot: 2 }, // a second place for it
        { kind: "case", floor: 0, slot: 1 }, // bookcases don't move
        { kind: "plant", floor: -1, slot: 0 },
        { kind: "clock", floor: 0, slot: 1.5 },
        { kind: "seat", floor: 2, slot: 3 },
        "junk",
      ],
      roomAway: ["plant", "hearth", "ladder", "ladder"],
    });
    expect(prefs.roomLayout).toEqual([
      { kind: "hearth", floor: 1, slot: 0 },
      { kind: "seat", floor: 2, slot: 3 },
    ]);
    expect(prefs.roomAway).toEqual(["plant", "ladder"]);
    expect(parsePreferences({ roomLayout: "nope" }).roomLayout).toEqual([]);
  });

  it("keeps the rooms added, in order, and furniture put in them", () => {
    const prefs = parsePreferences({
      roomRooms: ["music", "dungeon", "kitchen", "music"],
      roomLayout: [
        { kind: "piano", floor: 2, slot: 0, room: "kitchen" },
        { kind: "plant", floor: 1, slot: 1, room: "dungeon" },
      ],
      roomAway: ["harp"],
    });
    expect(prefs.roomRooms).toEqual(["music", "kitchen"]);
    expect(prefs.roomLayout).toEqual([
      { kind: "piano", floor: 2, slot: 0, room: "kitchen" },
      { kind: "plant", floor: 1, slot: 1 },
    ]);
    expect(prefs.roomAway).toEqual(["harp"]);
    expect(parsePreferences({}).roomRooms).toEqual([]);
  });

  it("keeps the furniture added from the catalogue, and where it was moved", () => {
    const prefs = parsePreferences({
      roomExtras: ["dog", "unicorn", "sofa", "dog"],
      roomLayout: [{ kind: "sofa", floor: 0, slot: 1, room: "spare" }],
    });
    expect(prefs.roomExtras).toEqual(["dog", "sofa"]);
    expect(prefs.roomLayout).toEqual([{ kind: "sofa", floor: 0, slot: 1, room: "spare" }]);
    expect(parsePreferences({}).roomExtras).toEqual([]);
  });

  it("keeps the wallpaper, floor and ceiling, and each added room's own", () => {
    const prefs = parsePreferences({
      roomPaper: "damask",
      roomFloor: "lino", // not a value
      roomCeiling: "fairylights",
      roomOwn: {
        bedroom: { walls: "rose", paper: "flowers", floor: "carpet" },
        music: { walls: "puce", paper: "trellis" }, // a colour that isn't one, and no floor
        kitchen: { walls: "style", paper: "style", floor: "style" }, // just like the house
        dungeon: { walls: "charcoal" }, // not a room
        studio: "sage",
      },
    });
    expect(prefs.roomPaper).toBe("damask");
    expect(prefs.roomFloor).toBe("style");
    expect(prefs.roomCeiling).toBe("fairylights");
    expect(prefs.roomOwn).toEqual({
      bedroom: { walls: "rose", paper: "flowers", floor: "carpet" },
      music: { walls: "style", paper: "trellis", floor: "style" },
    });
    expect(parsePreferences({ roomOwn: ["bedroom"] }).roomOwn).toEqual({});
    const plain = parsePreferences({});
    expect([plain.roomPaper, plain.roomFloor, plain.roomCeiling, plain.roomOwn]).toEqual(["style", "style", "none", {}]);
  });
});

describe("parsePreferences: the avatar", () => {
  it("keeps a chosen look and whether it's shown", () => {
    const prefs = parsePreferences({ avatarShown: false, avatar: { hair: "afro", hat: "crown", eyes: "nope" } });
    expect(prefs.avatarShown).toBe(false);
    expect(prefs.avatar).toEqual({ ...parsePreferences({}).avatar, hair: "afro", hat: "crown" });
  });

  it("starts everyone with the same little reader, shown", () => {
    const prefs = parsePreferences({ avatar: "junk" });
    expect(prefs.avatarShown).toBe(true);
    expect(prefs.avatar).toEqual(parsePreferences({}).avatar);
    expect(prefs.avatarLooks).toEqual([]);
  });

  it("keeps the pet and the coats, defaulting anything unknown", () => {
    const prefs = parsePreferences({ avatarPet: "dragon", roomCat: "calico", roomDog: "golden" });
    expect([prefs.avatarPet, prefs.roomCat, prefs.roomDog]).toEqual(["dragon", "calico", "golden"]);
    const odd = parsePreferences({ avatarPet: "unicorn", roomCat: "plaid", roomDog: 3 });
    expect([odd.avatarPet, odd.roomCat, odd.roomDog]).toEqual(["none", "ginger", "brown"]);
  });

  it("keeps saved looks, made whole", () => {
    const prefs = parsePreferences({ avatarLooks: [{ hair: "mullet", mobility: "wheelchair" }, 7] });
    expect(prefs.avatarLooks).toEqual([{ ...parsePreferences({}).avatar, hair: "mullet", mobility: "wheelchair" }]);
    expect(cleanPreferencesPatch({ avatarLooks: [{ held: "wand" }] }).avatarLooks).toEqual([
      { ...parsePreferences({}).avatar, held: "wand" },
    ]);
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and UTC", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects empty and unknown zones", () => {
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("Nowhere/Special")).toBe(false);
  });
});

describe("cleanPreferencesPatch", () => {
  it("keeps only the keys sent, made valid", () => {
    expect(cleanPreferencesPatch({ dateFormat: "iso", textSize: "huge" })).toEqual({
      dateFormat: "iso",
      textSize: "normal",
    });
  });

  it("drops keys that aren't preferences", () => {
    expect(cleanPreferencesPatch({ isAdmin: true, theme: "dark" })).toEqual({});
    // Replaced by importTagsMode; a stale tab sending it changes nothing.
    expect(cleanPreferencesPatch({ importTags: false })).toEqual({});
  });

  it("cleans the newer settings the same way", () => {
    expect(
      cleanPreferencesPatch({ quotesOrder: "book", paceFrom: "1y", findLinks: [{ name: "A" }] }),
    ).toEqual({ quotesOrder: "book", paceFrom: "read", findLinks: [] });
  });

  it("returns nothing for a non-object", () => {
    expect(cleanPreferencesPatch(null)).toEqual({});
    expect(cleanPreferencesPatch("dateFormat=iso")).toEqual({});
  });
});
