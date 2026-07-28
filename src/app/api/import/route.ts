import JSZip from "jszip";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { importLibrary, type CoverFileReader } from "@/lib/import";

// A library backup with a thousand bundled cover images lands comfortably
// under this. Lowered from 500 MB deliberately: the zip has to be held in
// memory to be read at all (JSZip needs the whole buffer), so this ceiling
// is really "how much RAM a restore may claim", and 500 MB is more than most
// self-hosted boxes can spare. Raising it means giving the container more
// memory to match.
const MAX_BYTES = 200 * 1024 * 1024;

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

  // Declared size first, so an oversized upload is refused before its body is
  // read into memory rather than after.
  const length = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (length > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 200 MB)" }, { status: 413 });
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  // Second check catches a body that lied about (or omitted) its length.
  if (bytes.length > MAX_BYTES) {
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
    try {
      payload = JSON.parse(await library.async("text"));
    } catch {
      return NextResponse.json({ error: "library.json is not valid JSON" }, { status: 400 });
    }
    getCoverFile = async (filename) => {
      const entry = zip.file(`covers/${filename}`);
      return entry ? await entry.async("uint8array") : null;
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
