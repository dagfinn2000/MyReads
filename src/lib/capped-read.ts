import type JSZip from "jszip";

/**
 * Reads at most `limit` bytes of a request's or response's body, giving up
 * (null) as soon as that is exceeded. `arrayBuffer()` would buffer whatever
 * the other side chooses to send, a deliberately endless body included,
 * and a Content-Length check alone misses a body sent without one. No body
 * reads as empty.
 */
export async function readBodyCapped(
  message: Request | Response,
  limit: number,
): Promise<Buffer | null> {
  // Trust Content-Length when it's present and already too big: no point
  // streaming megabytes to discover what the header said up front.
  const declared = Number.parseInt(message.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > limit) {
    await message.body?.cancel().catch(() => {});
    return null;
  }
  if (!message.body) return Buffer.alloc(0);

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = message.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) return null;
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks, total);
}

/**
 * Unpacks one file from a zip, giving up (null) once it passes `limit`
 * bytes. A zip states each file's size, but that is the zip's word against
 * itself, and JSZip only checks it after inflating everything, so a few
 * kilobytes of deflated zeros (a "zip bomb") would otherwise take
 * gigabytes of memory before anything noticed.
 */
export function readZipEntryCapped(
  entry: JSZip.JSZipObject,
  limit: number,
): Promise<Buffer | null> {
  // JSZip's own stream, which every runtime has (its Node stream is an old
  // kind that can't be read with for-await). Pausing it stops the inflating.
  const stream = (
    entry as unknown as { internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array> }
  ).internalStream("uint8array");
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    let settled = false;
    stream
      .on("data", (chunk) => {
        if (settled) return;
        total += chunk.length;
        if (total > limit) {
          settled = true;
          stream.pause();
          resolve(null);
          return;
        }
        chunks.push(chunk);
      })
      .on("error", (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      })
      .on("end", () => {
        if (settled) return;
        settled = true;
        resolve(Buffer.concat(chunks, total));
      })
      .resume();
  });
}
