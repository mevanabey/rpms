import Link from "next/link";
import { getAccountAccess } from "@/lib/auth/identity";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordForm } from "./password-form";

export default async function UpdatePasswordPage() {
  const access = await getAccountAccess();
  return <main className="flex min-h-screen items-center justify-center bg-background p-6">
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{access?.row.passwordSetupRequired ? "Set your first password" : "Reset your password"}</CardTitle>
        <CardDescription>{access?.row.isActive ? `Choose a password for ${access.authUser.email}.` : "Return to sign in and verify your email code to continue."}</CardDescription>
      </CardHeader>
      <CardContent>{access?.row.isActive ? <PasswordForm /> : <Button asChild><Link href="/login">Return to sign in</Link></Button>}</CardContent>
    </Card>
  </main>;
}
