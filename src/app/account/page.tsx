import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AccountPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Account</h1>
      <p className="mt-1 text-sm text-muted">{session.user.email}</p>

      <div className="mt-8 space-y-4">
        <a href="/api/account/export" className="block rounded border border-line px-4 py-2 text-sm">
          Export my data (JSON)
        </a>
        <SignOutButton />
        <DeleteAccountButton />
      </div>
    </main>
  );
}
