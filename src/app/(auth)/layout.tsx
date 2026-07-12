import { BookOpen } from "lucide-react";

/** Minimal centered layout for the login/register pages — no app nav. */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <BookOpen className="size-7" />
        Bibliotek
      </div>
      {children}
    </main>
  );
}
