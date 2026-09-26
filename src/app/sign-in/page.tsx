"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/auth/client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold">Sign in</h1>

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const { error: err } = await authClient.signIn.email({ email, password });
            if (err) setError(err.message ?? "Couldn't sign in.");
            else router.push("/");
          });
        }}
      >
        <div>
          <label htmlFor="email" className="text-sm text-muted">
            Email
          </label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded border border-line bg-transparent px-3 py-2" />
        </div>
        <div>
          <label htmlFor="password" className="text-sm text-muted">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-line bg-transparent px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-[var(--warn-fg)]">{error}</p>}
        <button type="submit" disabled={pending} className="w-full rounded bg-[var(--accent)] px-4 py-2 font-medium text-[var(--bg)] disabled:opacity-50">
          Sign in
        </button>
      </form>

      <div className="mt-6 border-t border-line pt-6">
        <p className="text-sm text-muted">Or get a one-time link by email:</p>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              await authClient.signIn.magicLink({ email });
              setMagicSent(true);
            });
          }}
        >
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="flex-1 rounded border border-line bg-transparent px-3 py-2 text-sm" />
          <button type="submit" disabled={pending} className="rounded border border-line px-3 py-2 text-sm disabled:opacity-50">
            Send link
          </button>
        </form>
        {magicSent && <p className="mt-2 text-sm text-muted">Check your email for a sign-in link.</p>}
      </div>

      <p className="mt-6 text-sm text-muted">
        New here?{" "}
        <Link href="/sign-up" className="text-accent underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
