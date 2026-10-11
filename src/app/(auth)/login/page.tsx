import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * Sends an already-signed-in visitor to the library.
 *
 * This check lives here rather than in the middleware because only the full
 * auth config resolves a session against the database. The middleware sees
 * just the decoded JWT, so it cannot tell a live session from one revoked by
 * a password change or a deleted account — and when it made this decision, a
 * revoked session bounced between /login and /books forever.
 */
export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/");

  // useSearchParams needs a Suspense boundary to keep this page
  // prerenderable; the fallback is the same card without the notice.
  return (
    <Suspense fallback={<Card className="w-full max-w-sm" />}>
      <LoginForm />
    </Suspense>
  );
}
