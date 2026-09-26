"use server";

import { getSession } from "@/auth/session";
import { track } from "@/lib/analytics";

export async function recordPassportExpanded(context: string): Promise<void> {
  const session = await getSession();
  track("passport_expanded", { userId: session?.user?.id, properties: { context } });
}
