/**
 * Set for a couple of minutes when a book is deleted from its page, so the
 * library it lands on can say where the book went and offer Undo
 * (components/just-deleted-notice.tsx clears it once shown). Holds the
 * book's id. Not httpOnly: the notice clears it from the browser.
 */
export const JUST_DELETED_COOKIE = "myreads-just-deleted";
