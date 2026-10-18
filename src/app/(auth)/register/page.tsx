import { redirect } from "next/navigation";
import { getSession } from "@/lib/current-user";
import { RegisterForm } from "@/components/register-form";

export const dynamic = "force-dynamic";

/** Same reasoning as the login page: only the full auth config can tell a
 *  live session from a revoked one, so the "already signed in" redirect
 *  belongs here and not in the middleware. */
export default async function RegisterPage() {
  const session = await getSession();
  if (session?.user?.id) redirect("/");

  return <RegisterForm />;
}
