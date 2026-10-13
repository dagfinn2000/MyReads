"use client";

import { useActionState, useEffect, useEffectEvent, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { BookFormat, BookOwnership, ReadingStatus } from "@prisma/client";
import { BookOpen } from "lucide-react";
import type { ActionState } from "@/lib/actions/helpers";
import type { CatalogueDiffRow, CatalogueValues } from "@/lib/catalogue-values";
import { FORMAT_LABELS, OWNERSHIP_LABELS, STATUS_LABELS, toDateInputValue } from "@/lib/display";
import type { AfterAdd } from "@/lib/preferences";
import type { TagImportSettings } from "@/lib/tag-rules";
import { submitKeepingInput } from "@/lib/submit-form";
import { AudiobookLengthField } from "@/components/audiobook-length-field";
import { CoverPicker } from "@/components/cover-picker";
import { FinishedDateField } from "@/components/finished-date-field";
import { LookupDetails } from "@/components/lookup-details";
import { usePreferences } from "@/components/preferences-provider";
import { StarRatingInput } from "@/components/star-rating-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** String-typed initial values — everything a book form can prefill. */
export interface BookFormValues {
  title?: string;
  authors?: string; // comma-separated
  isbn?: string;
  description?: string;
  coverUrl?: string;
  pageCount?: string;
  lengthMinutes?: string; // audiobooks only
  publishedDate?: string;
  tags?: string; // comma-separated
  seriesName?: string;
  seriesNumber?: string;
  format?: BookFormat;
  ownership?: BookOwnership;
  status?: ReadingStatus;
  openLibraryId?: string;
}

/** The add form's submit buttons, by where each goes afterwards. */
const ADD_BUTTON_LABELS: Record<AfterAdd, string> = {
  open: "Add book",
  another: "Add and add another",
  library: "Add and go to the library",
};

/**
 * Shared add/edit book form. The caller supplies the server action —
 * `createBook` for the add flow, a bound `updateBook` for editing.
 * `showStatus` is on for creation only; after that, status is managed from
 * the reading panel on the detail page. It also brings the shelf's own
 * fields (a finish date and rating for Read, a start date and page for
 * Currently Reading) and the add buttons that follow "After adding a book"
 * in Preferences.
 */
export function BookForm({
  action,
  initial = {},
  submitLabel = "Save changes",
  showStatus = false,
  seriesNames = [],
  onAdded,
  autoFocusTitle = false,
  lookup,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: BookFormValues;
  /** The edit form's button. The add form's buttons follow Preferences. */
  submitLabel?: string;
  showStatus?: boolean;
  /** Existing series names, offered as autocomplete suggestions. */
  seriesNames?: string[];
  /** Called with the new book after "Add and add another". */
  onAdded?: (book: { id: string; title: string }) => void;
  autoFocusTitle?: boolean;
  /** Offers "Look up details" (the edit page), with the reader's settings
   *  for catalogue subjects. */
  lookup?: TagImportSettings;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  // Controlled so the cover picker and upload can set it programmatically.
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl ?? "");
  // Format, ownership and shelf are controlled, each with a plain hidden
  // input carrying it: the Radix Select's own hidden select reverts to its
  // mount-time value whenever the form is reset (see reading-card.tsx),
  // while the trigger keeps showing the reader's choice. Format also
  // decides whether the audiobook length shows (and is sent), and the shelf
  // which reading fields show.
  const [format, setFormat] = useState<BookFormat>(
    initial.format ?? BookFormat.PHYSICAL,
  );
  const [ownership, setOwnership] = useState<BookOwnership>(
    initial.ownership ?? BookOwnership.OWNED,
  );

  // Kept on every save (editing used to drop it), and filled in by Look up
  // details when the catalogue knows the work.
  const [openLibraryId, setOpenLibraryId] = useState(initial.openLibraryId ?? "");
  const [status, setStatus] = useState<ReadingStatus>(initial.status ?? ReadingStatus.WANT_TO_READ);

  // Each save returns a new state object, so this runs once per book added.
  const reportAdded = useEffectEvent((book: { id: string; title: string }) => onAdded?.(book));
  useEffect(() => {
    if (state.added) reportAdded(state.added);
  }, [state]);

  /** The form's fields as the catalogue lookup compares them. */
  function readForm(): CatalogueValues {
    const form = formRef.current;
    const value = (name: string) => {
      const el = form?.elements.namedItem(name);
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : "";
    };
    return {
      title: value("title"),
      authors: value("authors"),
      isbn: value("isbn"),
      description: value("description"),
      coverUrl,
      pageCount: value("pageCount"),
      publishedDate: value("publishedDate"),
      tags: value("tags"),
      openLibraryId,
    };
  }

  /** Puts ticked catalogue values into the form. The text fields are
   *  uncontrolled, so this sets them directly; saving reads whatever is in
   *  them then, edits after filling included. Tags are added to the
   *  reader's own, never replace them. */
  function fillFields(rows: CatalogueDiffRow[]) {
    const form = formRef.current;
    for (const { field, value } of rows) {
      if (field === "coverUrl") setCoverUrl(value);
      else if (field === "openLibraryId") setOpenLibraryId(value);
      else {
        const el = form?.elements.namedItem(field);
        if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;
        el.value = field === "tags" && el.value.trim() ? `${el.value.trim()}, ${value}` : value;
      }
    }
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={submitKeepingInput(formAction)}
      className="grid gap-6 md:grid-cols-[200px_1fr]"
    >
      {/* Cover preview + URL + picker */}
      <div className="grid content-start gap-2">
        {/* Capped below md so the stacked mobile layout doesn't blow the
            preview up to full width (and ~1.5x screen height). */}
        <div className="mx-auto aspect-[2/3] w-full max-w-52 overflow-hidden rounded-md border bg-muted md:mx-0 md:max-w-none">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt="Cover preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen className="size-10 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <Label htmlFor="coverUrl">Cover image URL</Label>
        <Input
          id="coverUrl"
          name="coverUrl"
          placeholder="https://…"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Remote images are downloaded and cached locally on save.
        </p>
        <CoverPicker selected={coverUrl} onSelect={setCoverUrl} />
      </div>

      {/* Bibliographic fields */}
      <div className="grid content-start gap-4">
        {lookup && <LookupDetails settings={lookup} read={readForm} onFill={fillFields} />}
        <div className="grid gap-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            name="title"
            required
            defaultValue={initial.title ?? ""}
            autoFocus={autoFocusTitle}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="authors">Author(s)</Label>
          <Input
            id="authors"
            name="authors"
            placeholder="Comma-separated"
            defaultValue={initial.authors ?? ""}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="isbn">ISBN</Label>
            <Input id="isbn" name="isbn" defaultValue={initial.isbn ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pageCount">Pages</Label>
            <Input
              id="pageCount"
              name="pageCount"
              type="number"
              min={1}
              defaultValue={initial.pageCount ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="publishedDate">Published</Label>
            <Input
              id="publishedDate"
              name="publishedDate"
              placeholder="1999"
              defaultValue={initial.publishedDate ?? ""}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tags">Genres / tags</Label>
          <Input
            id="tags"
            name="tags"
            placeholder="fantasy, sci-fi, …"
            defaultValue={initial.tags ?? ""}
          />
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-4">
          <div className="grid gap-2">
            <Label htmlFor="seriesName">Series</Label>
            <Input
              id="seriesName"
              name="seriesName"
              placeholder="e.g. Mistborn Era 1"
              defaultValue={initial.seriesName ?? ""}
              list="series-suggestions"
            />
            {seriesNames.length > 0 && (
              <datalist id="series-suggestions">
                {seriesNames.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="seriesNumber">No. in series</Label>
            <Input
              id="seriesNumber"
              name="seriesNumber"
              type="number"
              step="0.1"
              min={0}
              placeholder="1"
              defaultValue={initial.seriesNumber ?? ""}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={initial.description ?? ""}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-2">
            <Label htmlFor="format">Format</Label>
            <input type="hidden" name="format" value={format} />
            <Select value={format} onValueChange={(v) => setFormat(v as BookFormat)}>
              <SelectTrigger id="format" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(BookFormat).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FORMAT_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AudiobookLengthField
            initialMinutes={initial.lengthMinutes}
            hidden={format !== BookFormat.AUDIOBOOK}
          />
          {showStatus && (
            <div className="grid gap-2">
              <Label htmlFor="status">Shelf</Label>
              <input type="hidden" name="status" value={status} />
              <Select value={status} onValueChange={(v) => setStatus(v as ReadingStatus)}>
                <SelectTrigger id="status" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ReadingStatus).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="ownership">Ownership</Label>
            <input type="hidden" name="ownership" value={ownership} />
            <Select value={ownership} onValueChange={(v) => setOwnership(v as BookOwnership)}>
              <SelectTrigger id="ownership">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(BookOwnership).map((o) => (
                  <SelectItem key={o} value={o}>
                    {OWNERSHIP_LABELS[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Keyed on the shelf, so switching shelves starts its fields
            afresh. */}
        {showStatus && <ShelfFields key={status} status={status} />}

        <input type="hidden" name="openLibraryId" value={openLibraryId} />

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {showStatus ? (
          <AddButtons />
        ) : (
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}

/**
 * What a new book on this shelf brings with it. Read: when it was finished
 * (or "Don't remember") and a rating. Currently Reading: when it was
 * started and the page reached. Want to Read and Did Not Finish need
 * nothing more.
 */
function ShelfFields({ status }: { status: ReadingStatus }) {
  const { addedAsReadFinished, ratingStyle, timeZone } = usePreferences();
  const [today] = useState(() => toDateInputValue(new Date(), timeZone));

  if (status === ReadingStatus.READ) {
    return (
      <div className="flex flex-wrap items-end gap-4">
        <FinishedDateField
          defaultDate={addedAsReadFinished === "today" ? today : ""}
          defaultUnknown={addedAsReadFinished === "undated"}
        />
        {ratingStyle !== "off" && (
          <div className="grid gap-2">
            <Label>Rating</Label>
            <StarRatingInput name="rating" defaultValue={0} />
          </div>
        )}
      </div>
    );
  }
  if (status === ReadingStatus.READING) {
    return (
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-2">
          <Label htmlFor="dateStarted">Started</Label>
          <Input
            id="dateStarted"
            name="dateStarted"
            type="date"
            className="w-40"
            defaultValue={today}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="currentPage">Current page</Label>
          <Input
            id="currentPage"
            name="currentPage"
            type="number"
            min={0}
            max={100000}
            className="w-28"
            placeholder="0"
          />
        </div>
      </div>
    );
  }
  return null;
}

/**
 * The add form's buttons. The first does what "After adding a book" says
 * (so Enter in a field does that too); the second offers adding another,
 * or opening the book when adding another is already the first. The
 * pressed button's name and value travel with the form data.
 */
function AddButtons() {
  const { afterAdd } = usePreferences();
  const { pending, data } = useFormStatus();
  const second: AfterAdd = afterAdd === "another" ? "open" : "another";
  const pressed = pending ? data?.get("afterAdd") : null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" name="afterAdd" value={afterAdd} disabled={pending}>
        {pressed === afterAdd ? "Adding…" : ADD_BUTTON_LABELS[afterAdd]}
      </Button>
      <Button type="submit" name="afterAdd" value={second} variant="outline" disabled={pending}>
        {pressed === second ? "Adding…" : second === "open" ? "Add and open it" : ADD_BUTTON_LABELS.another}
      </Button>
    </div>
  );
}
