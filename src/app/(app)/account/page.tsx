import { HardDriveDownload } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/display";
import { ChangePasswordForm } from "@/components/change-password-form";
import { DeleteAccount } from "@/components/delete-account";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account · MyReads" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) return null; // middleware already guards this
  const userId = session.user.id;

  const [user, bookCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, createdAt: true },
    }),
    prisma.book.count({ where: { userId } }),
  ]);
  if (!user) return null;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

      <Card>
        <CardHeader>
          <CardTitle>{user.username}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Member since {formatDate(user.createdAt)} ·{" "}
            {bookCount.toLocaleString("en")} book{bookCount === 1 ? "" : "s"} in
            the library
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Deleting your account removes your entire library from this
            instance — permanently. A backup zip restores into any MyReads
            instance, so grab one first if there&apos;s any doubt.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href="/api/export">
                <HardDriveDownload data-slot="icon" />
                Download backup
              </a>
            </Button>
            <DeleteAccount bookCount={bookCount} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
