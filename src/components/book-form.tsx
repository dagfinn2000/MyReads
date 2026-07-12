"use client";

import { useActionState, useState } from "react";
import { BookFormat, ReadingStatus } from "@prisma/client";
import { BookOpen } from "lucide-react";
import type { ActionState } from "@/lib/actions/books";
import { FORMAT_LABELS, STATUS_LABELS } from "@/lib/display";
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
  publishedDate?: string;
  tags?: string; // comma-separated
  seriesName?: string;
  seriesNumber?: string;
  format?: BookFormat;
  owned?: boolean;
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
  const [coverPreview, setCoverPreview] = useState(initial.coverUrl ?? "");

  return (
    <form action={formAction} className="grid gap-6 md:grid-cols-[200px_1fr]">
      {/* Cover preview + URL */}
      <div className="grid content-start gap-2">
        <div className="aspect-[2/3] w-full overflow-hidden rounded-md border bg-muted">
          {coverPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreview}
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
          defaultValue={initial.coverUrl ?? ""}
          onChange={(e) => setCoverPreview(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Remote images are downloaded and cached locally on save.
        </p>
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
            <Label>Format</Label>
            <Select name="format" defaultValue={initial.format ?? BookFormat.PHYSICAL}>
              <SelectTrigger className="w-36">
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
          {showStatus && (
            <div className="grid gap-2">
              <Label>Shelf</Label>
              <Select
                name="status"
                defaultValue={initial.status ?? ReadingStatus.WANT_TO_READ}
              >
                <SelectTrigger className="w-44">
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
          <label className="flex h-8 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="owned"
              value="true"
              defaultChecked={initial.owned ?? true}
              className="size-4 accent-primary"
            />
            I own this book
          </label>
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
