/**
 * Text patterns common in job scams. Each match returns the literal sentence
 * so the Passport can quote exactly what triggered it.
 */

const NEGATION = /\b(never|not|n't|no one|will not|won't|don't|do not|reimburse[sd]?|we (will )?provide|provided by us|at our cost|we cover|covered by)\b/i;

const OFF_PLATFORM: RegExp[] = [
  /\bwhats\s?app\b/i,
  /\btelegram\b/i,
  /\bwechat\b/i,
  /\bsignal (app|messenger)\b/i,
  /\b(text|sms|message) (me|us)\b/i,
  /\bsend (me |us )?a text\b/i,
  /\b(google )?hangouts?\b/i,
];

const PERSONAL_EMAIL = /[A-Z0-9._%+-]+@(gmail|yahoo|hotmail|outlook|live|icloud|aol|proton(mail)?|gmx)\.[a-z.]+/i;

const PAYMENT: RegExp[] = [
  /\b(pay|paying|payment|fee|fees|deposit|purchase|buy)\b.{0,50}\b(training|equipment|starter kit|kit|background check|application|registration|onboarding|laptop|software|certification|visa|work permit)\b/i,
  /\b(training|equipment|starter kit|background check|application|registration|onboarding)\b.{0,30}\b(fee|cost|payment)\b/i,
  /\b(bitcoin|btc|crypto(currency)?|usdt|ethereum|gift ?cards?)\b/i,
  /\b(deposit|cash|mobile deposit)\b.{0,30}\b(cheque|check)\b/i,
  /\b(cheque|check)\b.{0,40}\b(deposit|send (back|the difference)|refund the (difference|excess))\b/i,
  /\be-?transfer\b.{0,40}\b(fee|deposit|payment)\b/i,
];

export interface PatternMatch {
  sentence: string;
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+|•/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function clip(s: string, max = 180): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

function scan(text: string, patterns: RegExp[]): PatternMatch[] {
  const out: PatternMatch[] = [];
  for (const s of sentences(text)) {
    if (NEGATION.test(s)) continue;
    if (patterns.some((p) => p.test(s))) out.push({ sentence: clip(s) });
  }
  return out;
}

export function findOffPlatformContact(text: string): PatternMatch[] {
  return scan(text, [...OFF_PLATFORM, PERSONAL_EMAIL]);
}

export function findUpfrontPayment(text: string): PatternMatch[] {
  return scan(text, PAYMENT);
}
