"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { fillFindLink } from "@/lib/find-links";
import {
  BOOK_PAGE_CARD_LABELS,
  FIND_LINK_NAME_MAX,
  FIND_LINK_URL_MAX,
  MAX_FIND_LINKS,
  findLinkError,
  type FindLink,
  type Preferences,
} from "@/lib/preferences";
import { OrderList, useRefocus } from "@/components/order-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The Preferences form's update(): saves just the keys in the patch. */
type Update = (patch: Partial<Preferences>) => void;

/** The book page's cards in order, each with a Show checkbox and arrows. */
export function BookPageCardList({ prefs, update }: { prefs: Preferences; update: Update }) {
  const hidden = prefs.hiddenBookPageCards;
  return (
    <OrderList
      heading="Cards, in order"
      order={prefs.bookPageCards}
      labels={BOOK_PAGE_CARD_LABELS}
      shown={(card) => !hidden.includes(card)}
      onShow={(card, shown) =>
        update({
          hiddenBookPageCards: shown ? hidden.filter((c) => c !== card) : [...hidden, card],
        })
      }
      onReorder={(bookPageCards) => update({ bookPageCards })}
    >
      <p className="text-xs text-muted-foreground">
        A hidden card still shows on a book when it has something in it: your
        review or a read in progress, past reads, an open loan or saved quotes.
        Hiding Read history also hides Read it again, and hiding My reading
        hides the status menu (Select in the library can still change it).
      </p>
    </OrderList>
  );
}

/** What the live example under the Link field fills in. */
const SAMPLE_BOOK = {
  isbn: "9780099448822",
  title: "Norwegian Wood",
  authors: ["Haruki Murakami"],
};

/**
 * The reader's "Find it at" links: a list to reorder, edit and remove, and
 * a form that adds one or saves the one being edited. findLinkError checks
 * the form here and the same rules clean what the server stores, so a bad
 * link can't be saved either way.
 */
export function FindLinksEditor({ prefs, update }: { prefs: Preferences; update: Update }) {
  const links = prefs.findLinks;
  const headingId = useId();
  const hintId = useId();
  const nameId = useId();
  const urlId = useId();
  const errorId = useId();
  const refocus = useRefocus();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  /** Index of the link in the form, or null when adding. */
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<{ field: "name" | "url"; message: string } | null>(null);

  function save(next: FindLink[]) {
    update({ findLinks: next });
  }

  function clearForm() {
    setName("");
    setUrl("");
    setEditing(null);
    setError(null);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const message = findLinkError(name, url);
    if (message) {
      // The name is checked first, so a name that fails on its own is
      // what the message is about.
      const trimmed = name.trim();
      const field = !trimmed || trimmed.length > FIND_LINK_NAME_MAX ? "name" : "url";
      setError({ field, message });
      refocus.focusAfter(field);
      return;
    }
    const link = { name: name.trim(), url: url.trim() };
    const index = editing ?? links.length;
    save(editing === null ? [...links, link] : links.map((l, i) => (i === editing ? link : l)));
    clearForm();
    // At the most links the form gives way to a note, so fall back to the
    // link's own Edit button.
    refocus.focusAfter("name", `${index}-edit`);
  }

  function edit(i: number) {
    setName(links[i].name);
    setUrl(links[i].url);
    setEditing(i);
    setError(null);
    refocus.focusAfter("name");
  }

  function cancel() {
    const i = editing;
    clearForm();
    refocus.focusAfter(`${i}-edit`, "name");
  }

  function remove(i: number) {
    save(links.filter((_, j) => j !== i));
    if (editing === i) clearForm();
    else if (editing !== null && editing > i) setEditing(editing - 1);
    refocus.focusAfter("name");
  }

  function move(i: number, dir: "up" | "down") {
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= links.length) return;
    const next = [...links];
    [next[i], next[j]] = [next[j], next[i]];
    if (editing === i) setEditing(j);
    else if (editing === j) setEditing(i);
    refocus.focusAfter(`${j}-${dir}`, `${j}-${dir === "up" ? "down" : "up"}`);
    save(next);
  }

  const showForm = editing !== null || links.length < MAX_FIND_LINKS;
  const example =
    url.trim() && findLinkError("x", url) === null ? fillFindLink(url.trim(), SAMPLE_BOOK) : null;

  return (
    <div className="grid gap-2">
      <div>
        <p id={headingId} className="text-sm font-medium">
          Find it at links
        </p>
        <p id={hintId} className="text-xs text-muted-foreground">
          Links to your library or a shop, shown on each book. Put {"{isbn}"}, {"{title}"} or{" "}
          {"{author}"} where the book&apos;s details go. Links that use {"{isbn}"} are hidden on
          books without one.
        </p>
      </div>

      {links.length > 0 && (
        <ul aria-labelledby={headingId} className="grid gap-1">
          {links.map((link, i) => (
            // The order is the identity: two links may share a name.
            <li key={i} className="flex items-center gap-2">
              <div className="grid min-w-0 flex-1">
                <span className="truncate text-sm font-medium">{link.name}</span>
                <span className="truncate text-xs text-muted-foreground" title={link.url}>
                  {link.url}
                </span>
              </div>
              <span className="flex shrink-0 gap-1">
                <Button
                  ref={refocus.ref(`${i}-up`)}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move “${link.name}” up`}
                  disabled={i === 0}
                  onClick={() => move(i, "up")}
                >
                  <ArrowUp data-slot="icon" />
                </Button>
                <Button
                  ref={refocus.ref(`${i}-down`)}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move “${link.name}” down`}
                  disabled={i === links.length - 1}
                  onClick={() => move(i, "down")}
                >
                  <ArrowDown data-slot="icon" />
                </Button>
                <Button
                  ref={refocus.ref(`${i}-edit`)}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit “${link.name}”`}
                  onClick={() => edit(i)}
                >
                  <Pencil data-slot="icon" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove “${link.name}”`}
                  onClick={() => remove(i)}
                >
                  <Trash2 data-slot="icon" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        // noValidate: findLinkError gives every message, not the browser's
        // own bubble for the url field.
        <form noValidate onSubmit={submit} className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            <div className="grid gap-1">
              <Label htmlFor={nameId}>Name</Label>
              <Input
                ref={refocus.ref("name")}
                id={nameId}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                maxLength={FIND_LINK_NAME_MAX}
                placeholder="My library"
                autoComplete="off"
                aria-describedby={error?.field === "name" ? errorId : undefined}
                aria-invalid={error?.field === "name" || undefined}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={urlId}>Link</Label>
              <Input
                ref={refocus.ref("url")}
                id={urlId}
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                maxLength={FIND_LINK_URL_MAX}
                placeholder="https://my-library.example/search?q={isbn}"
                autoComplete="off"
                aria-describedby={error?.field === "url" ? errorId : hintId}
                aria-invalid={error?.field === "url" || undefined}
              />
            </div>
          </div>
          {example && (
            <p className="text-xs text-muted-foreground">
              On “{SAMPLE_BOOK.title}” this opens: <span className="break-all">{example}</span>
            </p>
          )}
          {error && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="outline" size="sm">
              {editing === null ? "Add link" : "Save link"}
            </Button>
            {editing !== null && (
              <Button type="button" variant="ghost" size="sm" onClick={cancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          That&apos;s the most links ({MAX_FIND_LINKS}). Remove one to add another.
        </p>
      )}
    </div>
  );
}
