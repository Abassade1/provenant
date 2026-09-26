import { log } from "./log";

/**
 * Outbound email. No provider is connected in this environment, so the
 * default implementation logs the send and, outside production, keeps a
 * small in-memory outbox so magic links can actually be clicked during
 * development — this is a dev convenience, not a real delivery channel.
 * Swap `setEmailSender` for a real provider before launch.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  url?: string; // primary link, if any (magic link, reset link, …)
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

interface OutboxEntry extends EmailMessage {
  sentAt: string;
}

const outbox: OutboxEntry[] = [];
const OUTBOX_LIMIT = 20;

export class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    log("email (no provider configured — logged only)", { to: message.to, subject: message.subject });
    if (process.env.NODE_ENV !== "production") {
      outbox.unshift({ ...message, sentAt: new Date().toISOString() });
      outbox.length = Math.min(outbox.length, OUTBOX_LIMIT);
    }
  }
}

export function devOutbox(): OutboxEntry[] {
  return outbox;
}

let current: EmailSender = new ConsoleEmailSender();
export function getEmailSender(): EmailSender {
  return current;
}
export function setEmailSender(s: EmailSender): void {
  current = s;
}
