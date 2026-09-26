/**
 * Structured JSON logs. Never pass raw posting text or user-pasted content here
 * (brief §16) — log identifiers and counts only.
 */
export function log(msg: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...data }));
}
