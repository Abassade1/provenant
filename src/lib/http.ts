/**
 * Polite HTTP for anything that touches a third-party site:
 * - identifies itself with FETCH_USER_AGENT
 * - honours robots.txt (cached per origin)
 * - rate-limits per key (usually the source key)
 * - times out
 */

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt disallows ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const userAgent = () => process.env.FETCH_USER_AGENT ?? "ProvenantBot/0.1";

// ── Rate limiting ───────────────────────────────────────────────────────────

const nextSlot = new Map<string, number>();

export async function rateLimit(key: string, perMinute: number): Promise<void> {
  const interval = 60_000 / Math.max(perMinute, 1);
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(key) ?? 0);
  nextSlot.set(key, slot + interval);
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

// ── robots.txt ──────────────────────────────────────────────────────────────

type Rules = { allow: string[]; disallow: string[] };
const robotsCache = new Map<string, { rules: Rules; fetchedAt: number }>();
const ROBOTS_TTL_MS = 6 * 60 * 60 * 1000;

/** Parse the rules that apply to our agent (or `*`). Longest match wins. */
export function parseRobots(body: string, agent: string): Rules {
  const groups: { agents: string[]; rules: Rules }[] = [];
  let current: { agents: string[]; rules: Rules } | null = null;
  let lastWasAgent = false;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const field = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: { allow: [], disallow: [] } };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!current) continue;
      if (field === "allow" && value) current.rules.allow.push(value);
      if (field === "disallow" && value) current.rules.disallow.push(value);
    }
  }
  const token = agent.split("/")[0]!.toLowerCase();
  const specific = groups.find((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const star = groups.find((g) => g.agents.includes("*"));
  return (specific ?? star)?.rules ?? { allow: [], disallow: [] };
}

function toRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp("^" + escaped + (anchored ? "$" : ""));
}

export function isAllowed(rules: Rules, pathAndQuery: string): boolean {
  let best: { len: number; allow: boolean } | null = null;
  for (const [list, allow] of [
    [rules.allow, true],
    [rules.disallow, false],
  ] as const) {
    for (const p of list) {
      if (toRegex(p).test(pathAndQuery) && (!best || p.length > best.len || (p.length === best.len && allow))) {
        best = { len: p.length, allow };
      }
    }
  }
  return best?.allow ?? true;
}

async function robotsFor(origin: string, doFetch: FetchLike): Promise<Rules> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) return cached.rules;
  let rules: Rules = { allow: [], disallow: [] };
  try {
    const res = await doFetch(`${origin}/robots.txt`, {
      headers: { "user-agent": userAgent() },
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) rules = parseRobots(await res.text(), userAgent());
    // 4xx → no restrictions (RFC 9309); 5xx → treat as fully disallowed
    else if (res.status >= 500) rules = { allow: [], disallow: ["/"] };
  } catch {
    rules = { allow: [], disallow: ["/"] };
  }
  robotsCache.set(origin, { rules, fetchedAt: Date.now() });
  return rules;
}

export function clearRobotsCache() {
  robotsCache.clear();
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface PoliteFetchOptions {
  rateKey: string;
  perMinute: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

export async function politeFetch(url: string, opts: PoliteFetchOptions): Promise<Response> {
  const doFetch = opts.fetchImpl ?? fetch;
  const u = new URL(url);
  const rules = await robotsFor(u.origin, doFetch);
  if (!isAllowed(rules, u.pathname + u.search)) throw new RobotsDisallowedError(url);
  await rateLimit(opts.rateKey, opts.perMinute);
  return doFetch(url, {
    headers: { "user-agent": userAgent(), accept: "application/json" },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
  });
}

export async function politeFetchJson<T>(url: string, opts: PoliteFetchOptions): Promise<T> {
  const res = await politeFetch(url, opts);
  if (!res.ok) throw new HttpError(res.status, url);
  return (await res.json()) as T;
}
