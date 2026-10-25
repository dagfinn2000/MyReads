"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImageDown, Share2 } from "lucide-react";
import { drawnSpineHex } from "@/lib/book-spine";
import { useCoverColours } from "@/lib/cover-colours";
import {
  QUOTE_CARD_SHAPES,
  QUOTE_CARD_STYLES,
  QUOTE_CARD_STYLE_LABELS,
  drawQuoteCard,
  quoteCardFileName,
  type CardFonts,
  type QuoteCardShape,
  type QuoteCardStyle,
} from "@/lib/quote-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** The look and shape last used, kept in this browser only. */
const CHOICE_KEY = "myreads:quote-card";

const SHAPE_LABELS: Record<QuoteCardShape, string> = { square: "Square", tall: "Tall" };

/** A hint of each look for its button. */
const STYLE_SWATCHES: Record<QuoteCardStyle, string> = {
  paper: "linear-gradient(135deg, #f5efe2, #e6dac2)",
  night: "linear-gradient(135deg, #1f2547, #0a0d1c)",
  cover: "linear-gradient(135deg, var(--quote-cover), color-mix(in oklab, var(--quote-cover) 70%, black))",
  index:
    "linear-gradient(#c8423b 0 0) 0 26% / 100% 1px no-repeat, repeating-linear-gradient(#fbfaf4 0 5px, rgb(90 140 210 / 0.5) 5px 6px)",
};

interface CardQuote {
  text: string;
  page: number | null;
}

interface CardBook {
  title: string;
  authors: string[];
  coverUrl: string | null;
}

/**
 * The button by a quote that makes a picture of it: the quote set large in
 * one of four looks (lib/quote-card.ts), square or tall, to download or,
 * where the device can, share straight to another app.
 */
export function QuoteCardButton({ quote, book }: { quote: CardQuote; book: CardBook }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Make a picture of this quote"
          title="Make a picture of this quote"
        >
          <ImageDown className="size-3.5" />
        </Button>
      </DialogTrigger>
      {open && <QuoteCardDialog quote={quote} book={book} />}
    </Dialog>
  );
}

function loadChoice(): { style: QuoteCardStyle; shape: QuoteCardShape } {
  const fallback = { style: "paper" as QuoteCardStyle, shape: "square" as QuoteCardShape };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? "{}");
    if (!saved || typeof saved !== "object") return fallback;
    const { style, shape } = saved as Record<string, unknown>;
    return {
      style: QUOTE_CARD_STYLES.includes(style as QuoteCardStyle) ? (style as QuoteCardStyle) : fallback.style,
      shape: QUOTE_CARD_SHAPES.includes(shape as QuoteCardShape) ? (shape as QuoteCardShape) : fallback.shape,
    };
  } catch {
    return fallback;
  }
}

/** The app's book face as the canvas must name it (next/font gives it a
 *  name of its own), and a typewriter face. */
function cardFonts(): CardFonts {
  const literata = getComputedStyle(document.documentElement).getPropertyValue("--font-literata").trim();
  return {
    serif: `${literata ? `${literata}, ` : ""}Georgia, serif`,
    mono: `"SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, "Courier New", monospace`,
  };
}

/** Whether this device can hand a picture to another app (phones, mostly). */
function canSharePictures(): boolean {
  try {
    const probe = new File([new Uint8Array(1)], "quote.png", { type: "image/png" });
    return !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

/** The cover image, if it can be drawn: covers on this server always can,
 *  another site's only when it allows it. */
function useCoverImage(url: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    const img = new Image();
    if (!url.startsWith("/")) img.crossOrigin = "anonymous";
    img.onload = () => live && setImage(img);
    img.src = url;
    return () => {
      live = false;
    };
  }, [url]);
  return url ? image : null;
}

function QuoteCardDialog({ quote, book }: { quote: CardQuote; book: CardBook }) {
  const [choice, setChoice] = useState(loadChoice);
  const [fonts, setFonts] = useState<CardFonts | null>(null);
  // Only ever rendered in the browser, once the dialog opens.
  const [canShare] = useState(canSharePictures);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const known = useCoverColours(book.coverUrl ? [book.coverUrl] : []);
  const colour = (book.coverUrl && known[book.coverUrl]) || drawnSpineHex(book.title);
  const cover = useCoverImage(book.coverUrl);

  // The faces load before the first drawing, or the canvas would use a
  // stand-in and never redraw.
  useEffect(() => {
    const f = cardFonts();
    const ready = Promise.all(
      ["italic 400 40px", "400 40px", "600 40px"].map((weight) =>
        document.fonts.load(`${weight} ${f.serif}`).catch(() => []),
      ),
    );
    let live = true;
    void ready.then(() => live && setFonts(f));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!fonts || !canvasRef.current) return;
    drawQuoteCard(
      canvasRef.current,
      { text: quote.text, title: book.title, authors: book.authors, page: quote.page, colour, cover },
      choice.style,
      choice.shape,
      fonts,
    );
  }, [fonts, choice, quote, book, colour, cover]);

  function choose(next: Partial<typeof choice>) {
    const value = { ...choice, ...next };
    setChoice(value);
    try {
      localStorage.setItem(CHOICE_KEY, JSON.stringify(value));
    } catch {
      // Not kept: it starts on Paper next time.
    }
  }

  function picture(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob(resolve, "image/png");
    });
  }

  async function download() {
    setBusy(true);
    const blob = await picture();
    setBusy(false);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = quoteCardFileName(book.title);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function share() {
    setBusy(true);
    const blob = await picture();
    setBusy(false);
    if (!blob) return;
    const file = new File([blob], quoteCardFileName(book.title), { type: "image/png" });
    try {
      await navigator.share({ files: [file], title: book.title });
    } catch {
      // Cancelled, or the other app said no: nothing to do.
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>A picture of this quote</DialogTitle>
        <DialogDescription>To save or share. It is made here, on your device.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid place-items-center rounded-lg bg-muted/60 p-3">
          <canvas
            ref={canvasRef}
            width={1080}
            height={1080}
            role="img"
            aria-label={`“${quote.text}” from ${book.title}`}
            className={cn(
              "h-auto max-h-[46vh] w-auto max-w-full rounded-sm shadow-md",
              !fonts && "invisible",
            )}
          />
        </div>
        <div
          role="radiogroup"
          aria-label="Look"
          className="flex flex-wrap gap-2"
          style={{ "--quote-cover": colour } as React.CSSProperties}
        >
          {QUOTE_CARD_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={choice.style === s}
              onClick={() => choose({ style: s })}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors hover:border-ring/60",
                choice.style === s && "border-foreground font-medium",
              )}
            >
              <span
                aria-hidden="true"
                className="size-5 shrink-0 rounded-sm border"
                style={{ background: STYLE_SWATCHES[s] }}
              />
              {QUOTE_CARD_STYLE_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="radiogroup" aria-label="Shape" className="flex gap-1 rounded-md border p-0.5">
            {QUOTE_CARD_SHAPES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={choice.shape === s}
                onClick={() => choose({ shape: s })}
                className={cn(
                  "rounded px-2.5 py-1 text-xs text-muted-foreground",
                  choice.shape === s && "bg-muted font-medium text-foreground",
                )}
              >
                {SHAPE_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {canShare && (
              <Button type="button" variant="outline" onClick={share} disabled={!fonts || busy}>
                <Share2 data-slot="icon" />
                Share
              </Button>
            )}
            <Button type="button" onClick={download} disabled={!fonts || busy}>
              <Download data-slot="icon" />
              Download
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  );
}
