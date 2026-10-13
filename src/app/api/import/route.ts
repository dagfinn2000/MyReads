import JSZip from "jszip";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readBodyCapped, readZipEntryCapped } from "@/lib/capped-read";
import { importLibrary, type CoverFileReader } from "@/lib/import";

// A library backup with a thousand bundled cover images lands comfortably
// under this. Lowered from 500 MB deliberately: the zip has to be held in
// memory to be read at all (JSZip needs the whole buffer), so this ceiling
// is really "how much RAM a restore may claim", and 500 MB is more than most
// self-hosted boxes can spare. Raising it means giving the container more
// memory to match.
const MAX_BYTES = 200 * 1024 * 1024;

/** A bundled cover is at most what an upload may be (downloads are less). */
const MAX_COVER_BYTES = 10 * 1024 * 1024;

/** Zip local-file-header magic: "PK\x03\x04". */
function isZip(bytes: Uint8Array): boolean {
  return (
    bytes.length > 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

/**
 * POST /api/import — restores a MyReads backup into the signed-in user's
 * library: either a zip export (library.json + bundled cover images) or a
 * legacy plain-JSON export, detected by content. Merge semantics with
 * duplicate skipping; see lib/import.ts.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Refused at the declared size, or as soon as the body passes it, rather
  // than after reading all of it into memory.
  const bytes = await readBodyCapped(req, MAX_BYTES);
  if (!bytes) {
    return NextResponse.json({ error: "File too large (max 200 MB)" }, { status: 413 });
  }

  let payload: unknown;
  let getCoverFile: CoverFileReader | undefined;

  if (isZip(bytes)) {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(bytes);
    } catch {
      return NextResponse.json({ error: "Not a readable zip file" }, { status: 400 });
    }
    const library = zip.file("library.json");
    if (!library) {
      return NextResponse.json(
        { error: "Zip contains no library.json — not a MyReads backup" },
        { status: 400 },
      );
    }
    // Unpacked with a ceiling: the sizes a zip declares can lie, and a
    // tiny zip can unpack to gigabytes. library.json may be as big as an
    // unzipped backup could have been sent; a cover as big as an upload.
    let text: Buffer | null;
    try {
      text = await readZipEntryCapped(library, MAX_BYTES);
    } catch {
      return NextResponse.json({ error: "Not a readable zip file" }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json(
        { error: "library.json is too large (max 200 MB unpacked)" },
        { status: 413 },
      );
    }
    try {
      payload = JSON.parse(text.toString("utf8"));
    } catch {
      return NextResponse.json({ error: "library.json is not valid JSON" }, { status: 400 });
    }
    getCoverFile = async (filename) => {
      const entry = zip.file(`covers/${filename}`);
      return entry ? await readZipEntryCapped(entry, MAX_COVER_BYTES) : null;
    };
  } else {
    try {
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return NextResponse.json({ error: "Not a valid JSON file" }, { status: 400 });
    }
  }

  const result = await importLibrary(session.user.id, payload, getCoverFile);
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
