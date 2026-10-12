"use client";

import { useEffect, useRef, useState } from "react";
import { ScanBarcode } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShelfScanPanel, type ShelfScan } from "@/components/shelf-scan";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Minimal typings for the native BarcodeDetector API — it isn't in the TS
 * DOM lib yet. Supported in Chrome/Edge and Chrome on Android; we feature-
 * detect and degrade to a helpful message elsewhere rather than shipping a
 * WASM decoder for a personal app.
 */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

function getDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
    return null;
  }
  return (window as unknown as { BarcodeDetector: BarcodeDetectorCtor })
    .BarcodeDetector;
}

/** EAN-13 barcodes starting 978/979 are ISBN-13s — i.e. book barcodes. */
function isIsbn13(code: string): boolean {
  return /^97[89]\d{10}$/.test(code);
}

const ERROR_MESSAGES: Record<string, string> = {
  unsupported:
    "This browser can't detect barcodes yet (works in Chrome and Edge, including Chrome on Android). You can type the ISBN into the search box instead.",
  insecure:
    "Camera access only works over HTTPS (or on localhost). Open the app through your reverse proxy / an https:// address and try again.",
  denied:
    "Couldn't access the camera. Check this site's camera permission in the browser.",
};

/** Where the "Keep scanning" switch is remembered, per device. */
const KEEP_SCANNING_KEY = "myreads:keep-scanning";

function readKeepScanning(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(KEEP_SCANNING_KEY) === "on";
  } catch {
    return false; // storage blocked (private mode): just off
  }
}

function writeKeepScanning(on: boolean) {
  try {
    localStorage.setItem(KEEP_SCANNING_KEY, on ? "on" : "off");
  } catch {
    // not remembered, which is fine
  }
}

/**
 * "Scan" button + camera dialog. Watches the video feed for an EAN-13
 * barcode that looks like an ISBN and hands it to `onDetected` (the import
 * search then takes over). The camera is only held while the dialog is open.
 *
 * With `shelfScan`, the dialog also has a "Keep scanning" switch. While it
 * is on, the camera stays open and every barcode goes to the shelf-scan
 * session instead, which looks it up and adds it, with the list of results
 * under the camera.
 */
export function BarcodeScanner({
  onDetected,
  defaultOpen = false,
  shelfScan,
}: {
  onDetected: (isbn: string) => void;
  /** Open the camera straight away (adding another book after a scan). */
  defaultOpen?: boolean;
  shelfScan?: {
    scan: ShelfScan;
    /** "Add by hand" on a code no catalogue knows. */
    onAddByHand: (isbn: string) => void;
    /** Done: the reader is finished scanning. */
    onDone: () => void;
  };
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [keep, setKeep] = useState(() => Boolean(shelfScan) && readKeepScanning());
  // Read by the detection loop, so flipping the switch never restarts the
  // camera.
  const keepRef = useRef(keep);
  const [flash, setFlash] = useState(false);
  const handleCode = shelfScan?.scan.handleCode;

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function start() {
      const Ctor = getDetectorCtor();
      if (!Ctor) {
        setError("unsupported");
        return;
      }
      if (!window.isSecureContext) {
        setError("insecure");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        setError("denied");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const detector = new Ctor({ formats: ["ean_13"] });
      let busy = false; // don't stack detect() calls if one runs long
      timer = setInterval(async () => {
        if (busy || !videoRef.current) return;
        busy = true;
        try {
          const codes = await detector.detect(videoRef.current);
          const hit = codes.find((c) => isIsbn13(c.rawValue));
          if (hit && keepRef.current && handleCode) {
            // A short ring round the picture says the code was taken.
            if (handleCode(hit.rawValue)) {
              setFlash(true);
              setTimeout(() => setFlash(false), 600);
            }
          } else if (hit) {
            setOpen(false); // effect cleanup stops the camera
            onDetected(hit.rawValue);
          }
        } catch {
          // per-frame detection errors are transient — keep scanning
        } finally {
          busy = false;
        }
      }, 350);
    }

    void start();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onDetected, handleCode]);

  return (
    // Clearing a previous failure belongs to the act of reopening, not to a
    // pass through the effect: retrying after denying camera permission
    // should start from a clean slate, and doing it here keeps the effect to
    // starting and stopping the camera.
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setError(null);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" title="Scan a book barcode">
          <ScanBarcode data-slot="icon" />
          Scan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{keep ? "Scan a shelf" : "Scan ISBN barcode"}</DialogTitle>
          <DialogDescription>
            {keep
              ? "Adds each book with your New books settings."
              : "Point the camera at the barcode on the back of the book."}
          </DialogDescription>
        </DialogHeader>
        {shelfScan && !error && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              role="switch"
              checked={keep}
              onChange={(e) => {
                keepRef.current = e.target.checked;
                setKeep(e.target.checked);
                writeKeepScanning(e.target.checked);
              }}
              className="size-4 accent-primary"
            />
            Keep scanning
          </label>
        )}
        {error ? (
          <p className="text-sm text-muted-foreground">{ERROR_MESSAGES[error]}</p>
        ) : (
          // No captions: this is a live camera feed for barcode scanning,
          // not media with an audio track.
          <video
            ref={videoRef}
            className={cn(
              "aspect-video w-full rounded-md bg-black object-cover ring-offset-2 ring-offset-background transition-shadow",
              flash && "ring-2 ring-primary",
            )}
            muted
            playsInline
          />
        )}
        {shelfScan && !error && (keep || shelfScan.scan.snapshot.rows.length > 0) && (
          <ShelfScanPanel
            scan={shelfScan.scan}
            onAddByHand={(isbn) => {
              setOpen(false);
              shelfScan.onAddByHand(isbn);
            }}
            onDone={() => {
              setOpen(false);
              shelfScan.onDone();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
