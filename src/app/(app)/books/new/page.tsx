import { AddBookClient } from "@/components/add-book-client";

export const metadata = { title: "Add book · Bibliotek" };

export default function NewBookPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Add book</h1>
      <AddBookClient />
    </div>
  );
}
