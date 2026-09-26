import { readFileSync } from "node:fs";
import { GreenhouseSource } from "@/sources/greenhouse";

export const board = readFileSync(new URL("./fixtures/greenhouse-board.json", import.meta.url), "utf8");

export function fakeGreenhouse(opts: { failTimes?: number } = {}) {
  let failures = 0;
  const calls: string[] = [];
  const fetchImpl = async (url: string) => {
    calls.push(url);
    if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
    if (url.includes("/jobs?")) {
      if (failures < (opts.failTimes ?? 0)) {
        failures++;
        return new Response("upstream error", { status: 503 });
      }
      return new Response(board, { headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/jobs/4000001")) return new Response("{}");
    return new Response("not found", { status: 404 });
  };
  return { fetchImpl, calls };
}

export const makeSource = (fetchImpl: ReturnType<typeof fakeGreenhouse>["fetchImpl"]) =>
  new GreenhouseSource({
    boardToken: "maplewoodfixture",
    employer: { name: "Maplewood Analytics", domain: "maplewood.example" },
    rateLimitPerMin: 100_000,
    fetchImpl,
  });

