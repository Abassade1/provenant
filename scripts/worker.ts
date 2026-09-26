import "dotenv/config";
import { getDb } from "../src/db/client";
import { startWorker } from "../src/pipeline/worker";

const boss = await startWorker(
  getDb(),
  process.env.DATABASE_URL!,
  process.env.INGEST_CRON,
  process.env.RECHECK_CRON,
  process.env.PURGE_CRON,
  process.env.ALERTS_CRON,
);
const stop = async () => {
  await boss.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
