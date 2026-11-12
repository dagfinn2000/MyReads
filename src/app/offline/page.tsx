import { OfflineScreen } from "@/components/offline-screen";

export const metadata = { title: "Offline · MyReads" };

/**
 * What the installed app shows for a page it hasn't saved, without a
 * connection (public/sw.js keeps a copy of this page when it installs).
 * The same for everyone: it takes its theme from the device, and lists
 * the pages saved here from the browser's own storage.
 */
export default function OfflinePage() {
  return <OfflineScreen />;
}
