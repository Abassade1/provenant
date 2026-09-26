"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/auth/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
      className="block w-full rounded border border-line px-4 py-2 text-left text-sm"
    >
      Sign out
    </button>
  );
}
