"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";
import { savePreferences } from "@/lib/actions/preferences";
import type { HideableNav } from "@/lib/preferences";
import { Button } from "@/components/ui/button";

/**
 * Turns the reading room on or off. Off, the Room tab goes from the top bar
 * and the Room page offers to bring it back; the same switch is in
 * Preferences.
 */
export function RoomSwitch({
  hiddenNav,
  on,
  className,
}: {
  hiddenNav: HideableNav[];
  /** What pressing it does. */
  on: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const flip = () =>
    startTransition(async () => {
      try {
        const rest = hiddenNav.filter((n) => n !== "room");
        await savePreferences({ hiddenNav: on ? rest : [...rest, "room"] });
        setFailed(false);
        router.refresh();
      } catch {
        setFailed(true);
      }
    });
  return (
    <>
      <Button size="sm" variant={on ? "default" : "ghost"} className={className} disabled={pending} onClick={flip}>
        <Power aria-hidden="true" />
        {on ? "Turn the reading room on" : "Turn off the reading room"}
      </Button>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          That didn&apos;t save. Try again.
        </p>
      )}
    </>
  );
}
