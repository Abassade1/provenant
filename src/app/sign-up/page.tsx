"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/auth/client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <p className="mt-1 text-sm text-muted">Only an email and password. Everything else is optional.</p>

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const { error: err } = await authClient.signUp.email({ name: name || email.split("@")[0]!, email, password });
            if (err) setError(err.message ?? "Couldn't create your account.");
            else router.push("/");
          });
        }}
      >
        <div>
          <label htmlFor="name" className="text-sm text-muted">
            Name (optional)
          </label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-line bg-transparent px-3 py-2" />
        </div>
        <div>
          <label htmlFor="email" className="text-sm text-muted">
            Email
          </label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded border border-line bg-transparent px-3 py-2" />
        </div>
        <div>
          <label htmlFor="password" className="text-sm text-muted">
            Password (8+ characters)
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-line bg-transparent px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-[var(--warn-fg)]">{error}</p>}
        <button type="submit" disabled={pending} className="w-full rounded bg-[var(--accent)] px-4 py-2 font-medium text-[var(--bg)] disabled:opacity-50">
          Create account
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-accent underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
