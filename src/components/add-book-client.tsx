"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { createBook } from "@/lib/actions/books";
import { BookForm, type BookFormValues } from "@/components/book-form";
import { ImportSearch } from "@/components/import-search";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Add-book flow: either search-and-import (pick a result → review the
 * prefilled form → save) or straight manual entry.
 */
export function AddBookClient() {
  const [prefill, setPrefill] = useState<BookFormValues | null>(null);

  if (prefill) {
    return (
      <div className="grid gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setPrefill(null)}>
            <ArrowLeft data-slot="icon" />
            Back to search
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Review the imported details, adjust anything you like, then save.
        </p>
        <BookForm
          action={createBook}
          initial={prefill}
          submitLabel="Add to library"
          showStatus
        />
      </div>
    );
  }

  return (
    <Tabs defaultValue="search">
      <TabsList>
        <TabsTrigger value="search">Search &amp; import</TabsTrigger>
        <TabsTrigger value="manual">Manual entry</TabsTrigger>
      </TabsList>
      <TabsContent value="search" className="pt-4">
        <ImportSearch onPick={setPrefill} />
      </TabsContent>
      <TabsContent value="manual" className="pt-4">
        <BookForm action={createBook} submitLabel="Add to library" showStatus />
      </TabsContent>
    </Tabs>
  );
}
