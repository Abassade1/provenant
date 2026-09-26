import { decodeEntities, htmlToText } from "@/lib/text";
import { HttpError, politeFetch, RobotsDisallowedError } from "@/lib/http";
import { isDisallowedHost } from "./denylist";

export type FetchOutcome =
  | { ok: true; text: string }
  | { ok: false; reason: "DISALLOWED_HOST" | "ROBOTS_DISALLOWED" | "FETCH_FAILED"; detail: string };

/**
 * Fetch a pasted URL's page text, for Check a Job. Never fetches a
 * disallowed site (§3/§12.5) — the caller falls back to asking for pasted
 * text. Everything else goes through the same polite-HTTP path as our
 * connectors (robots.txt, timeout, identifying User-Agent).
 */
export async function fetchPostingText(url: string): Promise<FetchOutcome> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { ok: false, reason: "FETCH_FAILED", detail: "That doesn't look like a valid URL." };
  }
  if (isDisallowedHost(host)) {
    return { ok: false, reason: "DISALLOWED_HOST", detail: `We don't fetch pages from ${host}. Paste the posting text instead.` };
  }
  try {
    const res = await politeFetch(url, { rateKey: `check:${host}`, perMinute: 20, accept: "text/html", timeoutMs: 8_000 });
    if (!res.ok) return { ok: false, reason: "FETCH_FAILED", detail: `The page returned HTTP ${res.status}.` };
    const html = await res.text();
    return { ok: true, text: htmlToText(decodeEntities(html)) };
  } catch (e) {
    if (e instanceof RobotsDisallowedError) return { ok: false, reason: "ROBOTS_DISALLOWED", detail: "This site's robots.txt doesn't allow us to fetch that page." };
    if (e instanceof HttpError) return { ok: false, reason: "FETCH_FAILED", detail: `The page returned HTTP ${e.status}.` };
    return { ok: false, reason: "FETCH_FAILED", detail: `Couldn't reach that page: ${(e as Error).message}` };
  }
}
