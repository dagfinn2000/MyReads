"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { saveLibraryView } from "@/lib/actions/library-view";
import type { LibraryDisplay } from "@/lib/library-view";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The library's View menu: grid or list, cover size, card style, 3D covers,
 * and which details the cards show (list rows can add a date and the page
 * count). Saved on the account like the sort, and applied by the server on
 * the next render — so the menu only saves and refreshes. 3D covers also
 * show at once, since they live on <html>.
 */
export function LibraryViewMenu({
  display,
  ratings,
}: {
  display: LibraryDisplay;
  /** False when ratings are switched off in Preferences: no rating toggle. */
  ratings: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Covers only and Bookshelf draw no details, so there is nothing to show.
  const showsDetails = display.layout === "list" || display.cardStyle === "cards";

  function save(patch: Partial<LibraryDisplay>) {
    if (patch.cover3d !== undefined) {
      document.documentElement.toggleAttribute("data-cover-3d", patch.cover3d);
    }
    startTransition(async () => {
      await saveLibraryView(patch);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0"
          title="View: layout, cover size, card style, card details"
          disabled={pending}
        >
          <LayoutGrid />
          <span className="sr-only">View options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Layout</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={display.layout}
          onValueChange={(v) => save({ layout: v as LibraryDisplay["layout"] })}
        >
          <DropdownMenuRadioItem value="grid">Grid</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        {display.layout === "grid" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Cover size</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={display.cardSize}
              onValueChange={(v) => save({ cardSize: v as LibraryDisplay["cardSize"] })}
            >
              <DropdownMenuRadioItem value="small">Small</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="medium">Medium</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="large">Large</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Style</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={display.cardStyle}
              onValueChange={(v) => save({ cardStyle: v as LibraryDisplay["cardStyle"] })}
            >
              <DropdownMenuRadioItem value="cards">Cards</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="covers">Covers only</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="shelf">Bookshelf</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={display.cover3d}
          onCheckedChange={(c) => save({ cover3d: c === true })}
          onSelect={(e) => e.preventDefault()}
        >
          3D covers
        </DropdownMenuCheckboxItem>

        {showsDetails && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Show</DropdownMenuLabel>
            {ratings && (
              <DropdownMenuCheckboxItem
                checked={display.showRating}
                onCheckedChange={(c) => save({ showRating: c === true })}
                onSelect={(e) => e.preventDefault()}
              >
                Rating
              </DropdownMenuCheckboxItem>
            )}
            <DropdownMenuCheckboxItem
              checked={display.showStatus}
              onCheckedChange={(c) => save({ showStatus: c === true })}
              onSelect={(e) => e.preventDefault()}
            >
              Reading status
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={display.showSeries}
              onCheckedChange={(c) => save({ showSeries: c === true })}
              onSelect={(e) => e.preventDefault()}
            >
              Series
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={display.showOwnership}
              onCheckedChange={(c) => save({ showOwnership: c === true })}
              onSelect={(e) => e.preventDefault()}
            >
              Ownership
            </DropdownMenuCheckboxItem>
            {display.layout === "list" && (
              <DropdownMenuCheckboxItem
                checked={display.showPageCount}
                onCheckedChange={(c) => save({ showPageCount: c === true })}
                onSelect={(e) => e.preventDefault()}
              >
                Page count
              </DropdownMenuCheckboxItem>
            )}
          </>
        )}

        {/* List rows only: a date under the author. */}
        {display.layout === "list" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Date</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={display.rowDate}
              onValueChange={(v) => save({ rowDate: v as LibraryDisplay["rowDate"] })}
            >
              <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="added">Date added</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="finished">Date finished</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
