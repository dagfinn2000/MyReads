import { BookOpen } from "lucide-react";
import { ThemePicker } from "@/components/theme-picker";

/** Minimal centered layout for the login/register pages — no app nav. */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="absolute right-4 top-4">
        <ThemePicker />
      </div>
      <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <BookOpen className="size-7" />
        MyReads
      </div>
      {children}
    </main>
  );
}
