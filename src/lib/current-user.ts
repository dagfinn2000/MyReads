import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * The signed-in user's id plus the bits the shell needs, fetched once per
 * request.
 *
 * Rendering any page previously resolved the session twice — once in the root
 * layout to look up the theme, once in the page itself — and issued a
 * separate query for the theme on top. React's `cache` memoizes per request,
 * so the layout and the page now share one session resolution and one row
 * read.
 *
 * That also absorbs the cost of session revocation: the `jwt` callback reads
 * the user row to check `tokenVersion`, and folding the theme into the same
 * request-scoped lookup keeps a page render at one user query rather than
 * three.
 */
export const getCurrentUser = cache(
  async (): Promise<{ id: string; theme: string | null } | null> => {
    const session = await auth();
    if (!session?.user?.id) return null;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, theme: true },
    });
    return user ?? null;
  },
);
