"use client";

import { useActionState, useState } from "react";
import { BookFormat, BookOwnership, ReadingStatus } from "@prisma/client";
import { BookOpen } from "lucide-react";
import type { ActionState } from "@/lib/actions/helpers";
import { FORMAT_LABELS, OWNERSHIP_LABELS, STATUS_LABELS } from "@/lib/display";
import { AudiobookLengthField } from "@/components/audiobook-length-field";
import { CoverPicker } from "@/components/cover-picker";
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

/**
 * Shared add/edit book form. The caller supplies the server action —
 * `createBook` for the add flow, a bound `updateBook` for editing.
 * `showStatus` is on for creation only; after that, status is managed from
 * the reading panel on the detail page.
 */
export function BookForm({
  action,
  initial = {},
  submitLabel,
  showStatus = false,
  seriesNames = [],
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: BookFormValues;
  submitLabel: string;
  showStatus?: boolean;
  /** Existing series names, offered as autocomplete suggestions. */
  seriesNames?: string[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // Controlled so the cover picker and upload can set it programmatically.
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl ?? "");
  // Tracked so the audiobook length shows only for audiobooks.
  const [format, setFormat] = useState<BookFormat>(
    initial.format ?? BookFormat.PHYSICAL,
  );

  return (
    <form action={formAction} className="grid gap-6 md:grid-cols-[200px_1fr]">
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
        <div className="grid gap-2">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" name="title" required defaultValue={initial.title ?? ""} />
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
            <Select
              name="format"
              defaultValue={initial.format ?? BookFormat.PHYSICAL}
              onValueChange={(v) => setFormat(v as BookFormat)}
            >
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
              <Select
                name="status"
                defaultValue={initial.status ?? ReadingStatus.WANT_TO_READ}
              >
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
            <Select name="ownership" defaultValue={initial.ownership ?? "OWNED"}>
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

        {initial.openLibraryId && (
          <input type="hidden" name="openLibraryId" value={initial.openLibraryId} />
        )}

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
