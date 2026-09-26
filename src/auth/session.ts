import { headers } from "next/headers";
import { auth } from "./server";

/** Server-side session lookup for Server Components and Route Handlers. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const s = await getSession();
  if (!s?.user) throw new Error("UNAUTHENTICATED");
  return s.user;
}
