import { ThemePicker } from "@/components/theme-picker";

/** A few books on a shelf, the last one leaning: the sign-in page's
 *  picture, drawn in the theme's accent so it suits every theme. */
function ShelfOfBooks() {
  return (
    <svg
      viewBox="0 0 88 64"
      className="h-16 w-22 text-primary"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="8" y="14" width="12" height="48" rx="1.5" fillOpacity="0.9" />
      <rect x="8" y="20" width="12" height="2" className="fill-background" fillOpacity="0.5" />
      <rect x="8" y="54" width="12" height="2" className="fill-background" fillOpacity="0.5" />
      <rect x="22" y="22" width="10" height="40" rx="1.5" fillOpacity="0.5" />
      <rect x="34" y="10" width="14" height="52" rx="1.5" fillOpacity="0.72" />
      <rect x="38" y="18" width="6" height="9" rx="1" className="fill-background" fillOpacity="0.45" />
      <rect
        x="50"
        y="18"
        width="11"
        height="44"
        rx="1.5"
        fillOpacity="0.38"
        transform="rotate(20 50 62)"
      />
      <rect x="2" y="62" width="84" height="2" rx="1" className="fill-foreground" fillOpacity="0.2" />
    </svg>
  );
}

/** Minimal centered layout for the login/register pages — no app nav. */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      {/* A soft wash of the accent colour from the top (globals.css). */}
      <div className="auth-backdrop" aria-hidden="true" />
      <div className="absolute right-4 top-4">
        <ThemePicker />
      </div>
      <div className="grid justify-items-center gap-3">
        <ShelfOfBooks />
        <p className="wordmark text-3xl">MyReads</p>
      </div>
      {children}
    </main>
  );
}
