import { auth } from "@/auth";

/** Result shape shared by every form-backed server action. */
export interface ActionState {
  error?: string;
  success?: boolean;
}

/** All actions require a session; returns the user id or throws. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}
