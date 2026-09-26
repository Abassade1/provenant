import { describe, expect, it, beforeEach } from "vitest";
import { clearRobotsCache, isAllowed, parseRobots, politeFetch, RobotsDisallowedError } from "@/lib/http";

const ROBOTS = `
User-agent: *
Disallow: /private
Allow: /private/ok

User-agent: ProvenantBot
Disallow: /jobs/internal
Disallow: /*.pdf$
`;

describe("robots.txt", () => {
  it("uses the group for our agent when present", () => {
    const rules = parseRobots(ROBOTS, "ProvenantBot/0.1");
    expect(isAllowed(rules, "/private")).toBe(true);
    expect(isAllowed(rules, "/jobs/internal/1")).toBe(false);
    expect(isAllowed(rules, "/files/a.pdf")).toBe(false);
    expect(isAllowed(rules, "/files/a.pdf?x=1")).toBe(true);
  });
  it("falls back to * with longest-match precedence", () => {
    const rules = parseRobots(ROBOTS, "OtherBot");
    expect(isAllowed(rules, "/private/x")).toBe(false);
    expect(isAllowed(rules, "/private/ok")).toBe(true);
    expect(isAllowed(rules, "/")).toBe(true);
  });
});

describe("politeFetch", () => {
  beforeEach(() => clearRobotsCache());

  it("refuses URLs robots.txt disallows", async () => {
    const fake = async (url: string) =>
      url.endsWith("/robots.txt") ? new Response("User-agent: *\nDisallow: /") : new Response("{}");
    await expect(politeFetch("https://x.test/a", { rateKey: "t", perMinute: 1000, fetchImpl: fake })).rejects.toBeInstanceOf(
      RobotsDisallowedError,
    );
  });

  it("treats a missing robots.txt as allow-all", async () => {
    const fake = async (url: string) =>
      url.endsWith("/robots.txt") ? new Response("", { status: 404 }) : new Response("ok");
    const res = await politeFetch("https://y.test/a", { rateKey: "t2", perMinute: 1000, fetchImpl: fake });
    expect(await res.text()).toBe("ok");
  });
});
