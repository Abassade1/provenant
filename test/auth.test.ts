import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auth } from "@/auth/server";
import { closeDb, getDb } from "@/db/client";
import { account, user } from "@/db/schema";
import { devOutbox } from "@/lib/email";
import { resetDb } from "./db";

const EMAIL = "jordan@example.com";
const PASSWORD = "correct horse battery staple";

async function signUp(email = EMAIL, password = PASSWORD) {
  return auth.api.signUpEmail({ body: { email, password, name: "Jordan" }, asResponse: true });
}

function cookieFrom(res: Response) {
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

beforeEach(async () => {
  await resetDb();
});

describe("email + password", () => {
  it("signs up, hashes the password with argon2, and never stores it in plain text", async () => {
    const res = await signUp();
    expect(res.status).toBe(200);
    const [row] = await getDb().select().from(account).where(eq(account.providerId, "credential"));
    expect(row!.password).toMatch(/^\$argon2id\$/);
    expect(row!.password).not.toContain(PASSWORD);
  });

  it("rejects the wrong password and accepts the right one", async () => {
    await signUp();
    await expect(auth.api.signInEmail({ body: { email: EMAIL, password: "wrong password entirely" } })).rejects.toThrow();
    const res = await auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD }, asResponse: true });
    expect(res.status).toBe(200);
  });

  it("issues a session whose user carries role and plan, defaulting to USER/FREE", async () => {
    await signUp();
    const signIn = await auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD }, asResponse: true });
    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookieFrom(signIn) }) });
    expect(session?.user.email).toBe(EMAIL);
    expect((session?.user as { role: string }).role).toBe("USER");
    expect((session?.user as { plan: string }).plan).toBe("FREE");
  });

  it("rejects a duplicate email", async () => {
    await signUp();
    const second = await signUp();
    expect(second.status).not.toBe(200);
    expect(await getDb().select().from(user)).toHaveLength(1);
  });

  it("a request with no session cookie is unauthenticated", async () => {
    const session = await auth.api.getSession({ headers: new Headers() });
    expect(session).toBeNull();
  });
});

describe("magic link", () => {
  it("sends a working sign-in link through the configured email sender", async () => {
    const before = devOutbox().length;
    await auth.api.signInMagicLink({ body: { email: "magic@example.com" }, headers: new Headers() });
    const sent = devOutbox();
    expect(sent.length).toBe(before + 1);
    expect(sent[0]).toMatchObject({ to: "magic@example.com", subject: expect.stringContaining("sign-in") });
    expect(sent[0]!.url).toMatch(/^http/);
  });
});
