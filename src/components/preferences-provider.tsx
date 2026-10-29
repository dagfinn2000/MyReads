"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { savePreferences } from "@/lib/actions/preferences";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/preferences";

const PreferencesContext = createContext<Preferences>(DEFAULT_PREFERENCES);

/**
 * Hands the signed-in user's preferences to client components (date
 * formats, rating style and so on), so they don't each need them passed
 * down as props. Server components read them with getPreferences() instead.
 *
 * `detectTimeZone` is set while the account has no time zone yet. The
 * browser knows the reader's zone and the server doesn't, so the first page
 * that loads saves it — reading days then count in the reader's own day
 * instead of the server's.
 */
export function PreferencesProvider({
  value,
  detectTimeZone,
  children,
}: {
  value: Preferences;
  detectTimeZone: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!detectTimeZone) return;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;
    savePreferences({ timeZone: zone })
      .then(() => router.refresh())
      .catch(() => {});
  }, [detectTimeZone, router]);

  // A refresh, or a save that draws the page again, sends the preferences
  // as a new object, almost always equal to the last. Handing on the same
  // one keeps the memoised cards and rows that read them (stars, status
  // badges, the library's cards) from all drawing again for nothing.
  const json = JSON.stringify(value);
  const [kept, setKept] = useState({ json, value });
  if (kept.json !== json) setKept({ json, value });
  const shown = kept.json === json ? kept.value : value;

  return <PreferencesContext.Provider value={shown}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Preferences {
  return useContext(PreferencesContext);
}
