import "dotenv/config";

// Tests always run against the dedicated test database.
if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
