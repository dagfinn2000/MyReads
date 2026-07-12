import { redirect } from "next/navigation";

/** The root route is just an entry point — the library is the real home page. */
export default function Home() {
  redirect("/books");
}
