import { Nav } from "@/components/nav";

/** Shared shell for all authenticated pages: top nav + centered content. */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
