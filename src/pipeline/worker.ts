import { PgBoss } from "pg-boss";
import type { DB } from "@/db/client";
import { log } from "@/lib/log";
import { configuredSources } from "@/sources/registry";
import { jobsNeedingTimeBasedReverify, recheckDue } from "@/evidence/freshness";
import { knownDomains, verifyJob } from "@/evidence/verify-job";
import { runSource } from "./run";

export const QUEUES = {
  ingestAll: "ingest-all",
  ingestSource: "ingest-source",
  ingestDead: "ingest-dead-letter",
  recheck: "freshness-recheck",
} as const;

/** Recheck due postings, then re-verify every job whose time-based signals may have changed. */
export async function recheckAndReverify(db: DB, now = new Date()) {
  const rechecked = await recheckDue(db, configuredSources(), now);
  const ids = new Set([...rechecked, ...(await jobsNeedingTimeBasedReverify(db, now))]);
  const domains = await knownDomains(db);
  for (const id of ids) await verifyJob(db, id, now, domains);
  return { rechecked: rechecked.length, reverified: ids.size };
}

/**
 * Background worker. `ingest-all` runs on a cron and fans out one
 * `ingest-source` job per configured source. pg-boss retries a whole source
 * run up to 3 times with exponential backoff, then moves it to the
 * dead-letter queue. (Per-posting retries happen inside runSource.)
 */
export async function startWorker(db: DB, connectionString: string, cron = "0 */6 * * *", recheckCron = "15 * * * *") {
  const boss = new PgBoss(connectionString);
  boss.on("error", (e) => log("pg-boss error", { error: (e as Error).message }));
  await boss.start();

  await boss.createQueue(QUEUES.ingestDead);
  await boss.createQueue(QUEUES.ingestAll);
  await boss.createQueue(QUEUES.ingestSource, {
    retryLimit: 3,
    retryBackoff: true,
    retryDelay: 30,
    deadLetter: QUEUES.ingestDead,
  });
  await boss.createQueue(QUEUES.recheck, { retryLimit: 3, retryBackoff: true, retryDelay: 60 });
  await boss.schedule(QUEUES.ingestAll, cron);
  await boss.schedule(QUEUES.recheck, recheckCron);

  await boss.work(QUEUES.recheck, async () => {
    log("freshness recheck finished", await recheckAndReverify(db));
  });

  await boss.work(QUEUES.ingestAll, async () => {
    for (const s of configuredSources()) {
      await boss.send(QUEUES.ingestSource, { key: s.descriptor.key }, { singletonKey: s.descriptor.key });
    }
  });

  await boss.work<{ key: string }>(QUEUES.ingestSource, async ([job]) => {
    const src = configuredSources().find((s) => s.descriptor.key === job!.data.key);
    if (!src) return log("source no longer configured", { key: job!.data.key });
    const result = await runSource(db, src, { log });
    if (result.status === "FAILED") throw new Error(`run ${result.runId} failed`);
  });

  await boss.work<{ key: string }>(QUEUES.ingestDead, async ([job]) => {
    log("source run dead-lettered", { key: job!.data.key });
  });

  log("worker started", { cron, recheckCron });
  return boss;
}
