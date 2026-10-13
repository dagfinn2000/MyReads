import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { readBodyCapped, readZipEntryCapped } from "@/lib/capped-read";

/** A body sent in chunks with no Content-Length, as a chunked upload is. */
function streamed(chunks: Uint8Array[]): Request {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
  return new Request("http://x/", { method: "POST", body, duplex: "half" } as RequestInit);
}

describe("readBodyCapped", () => {
  it("reads a body up to the limit", async () => {
    const buf = await readBodyCapped(new Request("http://x/", { method: "POST", body: "hello" }), 5);
    expect(buf?.toString()).toBe("hello");
  });

  it("refuses a body whose declared length is over the limit", async () => {
    const req = new Request("http://x/", {
      method: "POST",
      body: "x".repeat(100),
      headers: { "content-length": "100" },
    });
    expect(await readBodyCapped(req, 10)).toBeNull();
  });

  it("stops reading a body sent without a length once it passes the limit", async () => {
    const chunk = new Uint8Array(1024);
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(chunk); // never ends
      },
    });
    const req = new Request("http://x/", { method: "POST", body, duplex: "half" } as RequestInit);
    expect(await readBodyCapped(req, 10 * 1024)).toBeNull();
    expect(pulled).toBeLessThan(20);
  });

  it("joins a chunked body in order", async () => {
    const enc = new TextEncoder();
    const buf = await readBodyCapped(streamed([enc.encode("ab"), enc.encode("cd")]), 4);
    expect(buf?.toString()).toBe("abcd");
  });

  it("reads no body as empty", async () => {
    expect((await readBodyCapped(new Request("http://x/"), 10))?.length).toBe(0);
  });
});

describe("readZipEntryCapped", () => {
  it("unpacks a file within the limit", async () => {
    const zip = await JSZip.loadAsync(
      await new JSZip().file("library.json", '{"ok":true}').generateAsync({ type: "uint8array" }),
    );
    const buf = await readZipEntryCapped(zip.file("library.json")!, 100);
    expect(buf?.toString()).toBe('{"ok":true}');
  });

  it("gives up on a file that unpacks past the limit, whatever the zip claims", async () => {
    // 64 MB of zeros deflates to about 64 KB: the shape of a zip bomb.
    const packed = await new JSZip()
      .file("library.json", new Uint8Array(64 * 1024 * 1024))
      .generateAsync({ type: "uint8array", compression: "DEFLATE" });
    expect(packed.length).toBeLessThan(1024 * 1024);

    const zip = await JSZip.loadAsync(packed);
    expect(await readZipEntryCapped(zip.file("library.json")!, 1024 * 1024)).toBeNull();
  });
});
