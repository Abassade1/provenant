"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getSession } from "@/auth/session";
import { getDb } from "@/db/client";
import { jobCheck } from "@/db/schema";
import { rateLimit } from "@/lib/http";
import { encryptText } from "@/lib/crypto";
import { track } from "@/lib/analytics";
import { runCheck, type CheckOutcome } from "@/checker/run-check";

const inputSchema = z
  .object({
    url: z.string().trim().max(2000).optional(),
    text: z.string().trim().max(20_000).optional(),
    employerHint: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.url || v.text, { message: "Paste a job URL or the posting/message text." });

const RETENTION_DAYS = Number(process.env.CHECK_RETENTION_DAYS ?? 30);

async function anonymousSessionId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get("provenant_anon")?.value;
  if (existing) return existing;
  const id = randomUUID();
  jar.set("provenant_anon", id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return id;
}

export async function submitCheck(raw: { url?: string; text?: string; employerHint?: string }): Promise<
  | { ok: true; checkId: string; result: CheckOutcome }
  | { ok: false; error: string }
> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  await rateLimit(`check:${ip}`, 6); // 6/min per IP — generous for a real user, throttles abuse

  const session = await getSession();
  const sessionId = session?.user ? null : await anonymousSessionId();
  const db = getDb();

  const result = await runCheck(db, {
    url: parsed.data.url || null,
    text: parsed.data.text || null,
    employerHint: parsed.data.employerHint || null,
  });

  const expiresAt = new Date(Date.now() + RETENTION_DAYS * 86_400_000);
  const [row] = await db
    .insert(jobCheck)
    .values({
      userId: session?.user?.id,
      sessionId,
      inputUrl: parsed.data.url || null,
      // Never store or log raw pasted text unencrypted (brief §16).
      inputTextEncrypted: result.rawTextForStorage ? encryptText(result.rawTextForStorage) : null,
      extracted: result.ok ? { ...result.extracted, salary: result.extracted.salary ?? null } : null,
      matchedCanonicalJobId: result.matchedCanonicalJobId,
      status: result.ok ? "COMPLETE" : "FAILED",
      expiresAt,
    })
    .returning({ id: jobCheck.id });

  track("check_submitted", {
    userId: session?.user?.id,
    sessionId: sessionId ?? undefined,
    properties: { ok: result.ok, matched: !!result.matchedCanonicalJobId, status: result.verification?.status },
  });

  return { ok: true, checkId: row!.id, result };
}
