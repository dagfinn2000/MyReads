"use client";

import { useEffect, useRef, useState } from "react";
import { ScanBarcode } from "lucide-react";
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

/**
 * "Scan" button + camera dialog. Watches the video feed for an EAN-13
 * barcode that looks like an ISBN and hands it to `onDetected` (the import
 * search then takes over). The camera is only held while the dialog is open.
 */
export function BarcodeScanner({
  onDetected,
}: {
  onDetected: (isbn: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
          if (hit) {
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

    setError(null);
    void start();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onDetected]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" title="Scan a book barcode">
          <ScanBarcode data-slot="icon" />
          Scan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan ISBN barcode</DialogTitle>
          <DialogDescription>
            Point the camera at the barcode on the back of the book.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-muted-foreground">{ERROR_MESSAGES[error]}</p>
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            className="aspect-video w-full rounded-md bg-black object-cover"
            muted
            playsInline
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
