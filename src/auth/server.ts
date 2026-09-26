import { hash, verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { getDb } from "@/db/client";
import { account, session, user, verification } from "@/db/schema";
import { getEmailSender } from "@/lib/email";

// argon2id, per OWASP's current recommendation.
const ARGON2 = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  // Postgres generates ids (uuid default); don't let Better Auth mint its own.
  advanced: { database: { generateId: false } },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "USER" },
      // Monetization field, exposed read-only here. Never read by src/verification.
      plan: { type: "string", input: false, defaultValue: "FREE" },
    },
  },
  emailAndPassword: {
    enabled: true,
    password: {
      hash: (password) => hash(password, ARGON2),
      verify: ({ hash: h, password }) => verify(h, password, ARGON2),
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await getEmailSender().send({
          to: email,
          subject: "Your Provenant sign-in link",
          text: `Sign in to Provenant: ${url}\n\nThis link expires in 5 minutes. If you didn't request it, ignore this email.`,
          url,
        });
      },
    }),
  ],
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },
});

export type Session = typeof auth.$Infer.Session;
