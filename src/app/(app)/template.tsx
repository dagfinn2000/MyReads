/**
 * Fades each page in. Next.js re-mounts a template whenever the segment
 * under it changes, which here means moving between the app's sections
 * (Library, Stats, Quotes, Account). Moving within one, like filtering the
 * library or opening a book, keeps the page mounted, so typing in the
 * search box never replays the fade. See `.page-in` in globals.css.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
