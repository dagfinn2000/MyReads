"use client";

import { useEffect, useState } from "react";

/**
 * What the pictures made in the browser share: the quote pictures
 * (components/quote-card-dialog.tsx) and the picture of a year
 * (components/year-story.tsx). They're drawn on a canvas, then downloaded
 * or handed to another app; nothing is sent to the server.
 */

/** The app's book face as a canvas must name it (next/font gives it a name
 *  of its own), and a typewriter face. */
export function pictureFonts(): { serif: string; mono: string } {
  const literata = getComputedStyle(document.documentElement).getPropertyValue("--font-literata").trim();
  return {
    serif: `${literata ? `${literata}, ` : ""}Georgia, serif`,
    mono: `"SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, "Courier New", monospace`,
  };
}

/** Whether this device can hand a picture to another app (phones, mostly). */
export function canSharePictures(): boolean {
  try {
    const probe = new File([new Uint8Array(1)], "picture.png", { type: "image/png" });
    return !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

/** The canvas as a PNG. */
export function canvasPicture(canvas: HTMLCanvasElement | null): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!canvas) return resolve(null);
    canvas.toBlob(resolve, "image/png");
  });
}

/** Saves the picture as a download named `name`. */
export function downloadPicture(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Hands the picture to another app through the device's share sheet. */
export async function sharePicture(blob: Blob, name: string, title: string): Promise<void> {
  const file = new File([blob], name, { type: "image/png" });
  try {
    await navigator.share({ files: [file], title });
  } catch {
    // Cancelled, or the other app said no: nothing to do.
  }
}

/** The cover image, if it can be drawn: covers on this server always can,
 *  another site's only when it allows it. */
export function useCoverImage(url: string | null): HTMLImageElement | null {
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

/** Several covers at once, for the picture of a year: each address's image
 *  once it has loaded and can be drawn. */
export function useCoverImages(urls: readonly string[]): Record<string, HTMLImageElement> {
  const key = urls.join("\n");
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  useEffect(() => {
    let live = true;
    for (const url of key ? key.split("\n") : []) {
      const img = new Image();
      if (!url.startsWith("/")) img.crossOrigin = "anonymous";
      img.onload = () => live && setImages((had) => ({ ...had, [url]: img }));
      img.src = url;
    }
    return () => {
      live = false;
    };
  }, [key]);
  return images;
}
