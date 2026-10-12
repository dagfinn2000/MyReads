import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/current-user";
import { START_PAGE_PATHS } from "@/lib/preferences";

/** The root route is just an entry point: it opens the start page chosen in
 *  Preferences — the library unless the reader picked Stats, Add book or
 *  Now reading. The installed app and signing in both land here. */
export default async function Home() {
  const { startPage } = await getPreferences();
  redirect(START_PAGE_PATHS[startPage]);
}
