import { BookFormat, BookOwnership } from "@prisma/client";

/**
 * What "Do I own this?" says about a match, kept out of the page so every
 * match/ownership pairing is testable. An ISBN match is this exact edition;
 * a title match is the same book in another edition, which may be another
 * format altogether.
 *
 * Only an exact edition can be marked owned from here. On a title match the
 * library's copy may be the wishlisted ebook while you're holding a
 * paperback, so "I bought it" would record the wrong edition.
 */

export type VerdictTone = "success" | "info" | "warn";

export interface CheckVerdict {
  tone: VerdictTone;
  headline: string;
  detail: string | null;
  /** The button that marks the matched book owned, if one makes sense. */
  markOwned: "I bought it" | "I have it again" | null;
  /** Offer "Add this edition anyway". */
  addAnyway: boolean;
}

/** "The one in your library is …" for a title match. */
export const FORMAT_PHRASE: Record<BookFormat, string> = {
  PHYSICAL: "a different edition",
  EBOOK: "an ebook",
  AUDIOBOOK: "an audiobook",
};

export function checkVerdict(
  match: "isbn" | "title",
  book: { ownership: BookOwnership; format: BookFormat },
): CheckVerdict {
  if (match === "isbn") {
    switch (book.ownership) {
      case BookOwnership.WISHLIST:
        return {
          tone: "info",
          headline: "On your wishlist.",
          detail: "You don't own it yet.",
          markOwned: "I bought it",
          addAnyway: false,
        };
      case BookOwnership.BORROWED:
        return {
          tone: "warn",
          headline: "You borrowed this copy.",
          detail: "It's in your library, but not your own.",
          markOwned: null,
          addAnyway: false,
        };
      case BookOwnership.GIVEN_AWAY:
        return {
          tone: "warn",
          headline: "You gave this copy away.",
          detail: "It's in your library as a book you no longer have.",
          markOwned: "I have it again",
          addAnyway: false,
        };
      default:
        return {
          tone: "success",
          headline: "In your library: this exact edition.",
          detail: null,
          markOwned: null,
          addAnyway: false,
        };
    }
  }

  const theirs = `The one in your library is ${FORMAT_PHRASE[book.format]}.`;
  switch (book.ownership) {
    case BookOwnership.WISHLIST:
      return {
        tone: "info",
        headline: "This title is on your wishlist.",
        detail: `${theirs} You don't own it yet.`,
        markOwned: null,
        addAnyway: true,
      };
    case BookOwnership.BORROWED:
      return {
        tone: "warn",
        headline: "You borrowed a copy of this title.",
        detail: theirs,
        markOwned: null,
        addAnyway: true,
      };
    case BookOwnership.GIVEN_AWAY:
      return {
        tone: "warn",
        headline: "You gave a copy of this title away.",
        detail: theirs,
        markOwned: null,
        addAnyway: true,
      };
    default:
      return {
        tone: "warn",
        headline:
          book.format === BookFormat.EBOOK
            ? "You have this as an ebook."
            : book.format === BookFormat.AUDIOBOOK
              ? "You have this as an audiobook."
              : "You have this title, as a different edition.",
        detail: null,
        markOwned: null,
        addAnyway: true,
      };
  }
}

/**
 * The add page's "already in your library" notice, around the link to the
 * matched book. A wishlist or given-away match is usually the book you now
 * have, so it points there rather than at adding a second copy.
 */
export function duplicateNotice(
  match: "isbn" | "title",
  ownership: BookOwnership,
): { lead: string; tail: string } {
  const exact = match === "isbn";
  if (ownership === BookOwnership.OWNED) {
    return {
      lead: exact
        ? "This exact edition is already in your library: "
        : "You already have this title: ",
      tail: ". You can still add it, say as a second copy.",
    };
  }
  const lead = {
    WISHLIST: exact ? "This exact edition is on your wishlist: " : "This title is on your wishlist: ",
    BORROWED: exact ? "You borrowed this exact edition: " : "You borrowed a copy of this title: ",
    GIVEN_AWAY: exact ? "You gave this exact edition away: " : "You gave a copy of this title away: ",
  }[ownership];
  return {
    lead,
    tail: exact
      ? ". If it's yours now, set that book's Ownership to Owned instead of adding it twice."
      : ". You can still add this edition.",
  };
}

/**
 * A shelf-scan row's label for a book the library already has. A wishlist,
 * borrowed or given-away copy is worded as the check page words it (its
 * headline, without the full stop), not as a book you have; one you own
 * keeps the list's short wording.
 */
export function scanMatchLabel(match: "isbn" | "title", ownership: BookOwnership): string {
  if (ownership === BookOwnership.OWNED) {
    return match === "isbn" ? "Already in your library" : "Another edition in your library";
  }
  // The format only changes an owned title match's headline.
  return checkVerdict(match, { ownership, format: BookFormat.PHYSICAL }).headline.replace(/\.$/, "");
}

/**
 * `?ownership=` on the add page ("Add to wishlist"). Only an exact enum
 * value counts; anything else (lower case, unknown, repeated) is ignored so
 * the Preferences default applies.
 */
export function ownershipParam(value: unknown): BookOwnership | undefined {
  return Object.values(BookOwnership).find((o) => o === value);
}
