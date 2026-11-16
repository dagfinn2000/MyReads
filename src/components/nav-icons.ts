import {
  Armchair,
  BookCopy,
  BookOpenText,
  ChartColumn,
  Feather,
  LibraryBig,
  Plus,
  Quote,
  ScanSearch,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/preferences";

/** Each top-bar link's icon: the top bar's (components/nav.tsx), and quick
 *  find's for the same pages. */
export const NAV_ICONS: Record<NavItem, LucideIcon> = {
  library: LibraryBig,
  reading: BookOpenText,
  add: Plus,
  check: ScanSearch,
  quotes: Quote,
  stats: ChartColumn,
  room: Armchair,
  series: BookCopy,
  authors: Feather,
};
