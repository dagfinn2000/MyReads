"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus } from "lucide-react";
import { saveView } from "@/lib/actions/saved-views";
import { createSmartShelf } from "@/lib/actions/smart-shelves";
import { SAVED_VIEW_NAME_MAX } from "@/lib/saved-views";
import { smartRulesQuery } from "@/lib/smart-shelves";
import { ShelfKindChoice } from "@/components/shelf-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * "Save view": names the filters, sort and grouping on screen so they come
 * back with one click (a chip above the library). Saving under an existing
 * name updates that view. Or keeps the filters as a smart shelf, which
 * fills itself with every book they match (lib/smart-shelves.ts).
 */
export function SaveViewDialog({ query }: { query: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"view" | "smart">("view");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const filtered = smartRulesQuery(query) !== "";
  const smart = kind === "smart" && filtered;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (smart) {
        const res = await createSmartShelf(name, query);
        if (res.error || !res.id) {
          setError(res.error ?? "Couldn't make that shelf.");
          return;
        }
        setOpen(false);
        setName("");
        // Opened on its own chip, laid out as now.
        const view = new URLSearchParams(query);
        const params = new URLSearchParams({ shelfId: res.id });
        for (const key of ["group", "sort", "dir"]) {
          const v = view.get(key);
          if (v) params.set(key, v);
        }
        router.push(`/books?${params}`);
        return;
      }
      const res = await saveView(name, query);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setName("");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
        if (next) setKind("view");
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          title="Save this view"
        >
          <BookmarkPlus />
          <span className="sr-only">Save this view</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{smart ? "Save as a smart shelf" : "Save this view"}</DialogTitle>
            <DialogDescription>
              {smart
                ? "A shelf that holds every book these filters match, now and later. It sits with your shelves, and shows on the books it holds."
                : "Keeps the filters, sort and grouping you have now as a chip above the library. Using a name you already have updates that view."}
            </DialogDescription>
          </DialogHeader>
          <ShelfKindChoice
            kind={smart ? "smart" : "shelf"}
            onChange={(k) => {
              setKind(k === "smart" ? "smart" : "view");
              setError(null);
            }}
            smartDisabled={!filtered}
            labels={{ shelf: "View", smart: "Smart shelf" }}
            notes={{
              shelf: "Filters, sort and grouping",
              smart: filtered ? "Fills itself from the filters" : "Pick some filters first",
            }}
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={smart ? "Short sci-fi" : "Unread fantasy"}
            maxLength={smart ? 50 : SAVED_VIEW_NAME_MAX}
            autoFocus
            aria-label={smart ? "Shelf name" : "View name"}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Saving…" : smart ? "Create smart shelf" : "Save view"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
