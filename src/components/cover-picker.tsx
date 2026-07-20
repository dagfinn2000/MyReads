"use client";

import { useRef, useState } from "react";
import { ImageDown, Loader2, Upload } from "lucide-react";
import { SOURCE_LABELS, type CoverCandidate } from "@/lib/metadata/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Cover picker: searches every metadata source for candidate covers of the
 * book currently in the form (exact ISBN matches first, so the edition you
 * own wins), or uploads your own image — e.g. a photo of the actual book.
 *
 * Lives inside the book form and reads title/authors/ISBN straight from the
 * surrounding form's inputs, so whatever the user has typed (not just the
 * imported values) drives the search.
 */
export function CoverPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (url: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [covers, setCovers] = useState<CoverCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function findCovers() {
    const form = rootRef.current?.closest("form");
    const val = (name: string) =>
      (form?.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() ?? "";
    const title = val("title");
    const isbn = val("isbn");
    const author = val("authors").split(",")[0]?.trim() ?? "";

    if (!title && !isbn) {
      setError("Fill in a title or ISBN first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (isbn) params.set("isbn", isbn);
      if (title) params.set("title", title);
      if (author) params.set("author", author);
      const res = await fetch(`/api/metadata/covers?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCovers(data.covers ?? []);
    } catch {
      setError("Cover search failed — try again.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/covers/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onSelect(data.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      // Allow re-selecting the same file after an error.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div ref={rootRef} className="grid gap-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={findCovers}
          disabled={loading}
        >
          {loading ? (
            <Loader2 data-slot="icon" className="animate-spin" />
          ) : (
            <ImageDown data-slot="icon" />
          )}
          Find covers
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Upload your own cover image"
        >
          {uploading ? (
            <Loader2 data-slot="icon" className="animate-spin" />
          ) : (
            <Upload data-slot="icon" />
          )}
          <span className="sr-only">Upload cover</span>
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f);
          }}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {covers !== null && covers.length === 0 && !error && (
        <p className="text-xs text-muted-foreground">
          No covers found. Try the upload button, or paste an image URL above.
        </p>
      )}

      {covers !== null && covers.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {covers.map((c) => (
            <button
              key={c.url}
              type="button"
              onClick={() => onSelect(c.url)}
              title={SOURCE_LABELS[c.source]}
              className={cn(
                "aspect-[2/3] overflow-hidden rounded border bg-muted transition-shadow hover:ring-2 hover:ring-ring/60",
                selected === c.url && "ring-2 ring-primary",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.url}
                alt={`Cover option from ${SOURCE_LABELS[c.source]}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
