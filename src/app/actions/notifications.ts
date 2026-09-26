"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "@/auth/session";
import { getDb } from "@/db/client";
import { notification } from "@/db/schema";

export async function markNotificationRead(id: string): Promise<void> {
  const session = await getSession();
  if (!session?.user) return;
  await getDb()
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.id, id), eq(notification.userId, session.user.id)));
  try {
    revalidatePath("/notifications");
  } catch {
    // no request-scoped store outside a real Next.js request — safe to ignore
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await getSession();
  if (!session?.user) return;
  await getDb()
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, session.user.id), isNull(notification.readAt)));
  try {
    revalidatePath("/notifications");
  } catch {
    // no request-scoped store outside a real Next.js request — safe to ignore
  }
}
