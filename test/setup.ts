import "dotenv/config";

// Tests always run against the dedicated test database.
if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.CHECK_ENCRYPTION_KEY ??= "test-only-key-test-only-key";
process.env.BETTER_AUTH_SECRET ??= "test-only-secret-test-only-secret";
process.env.BETTER_AUTH_URL ??= "http://localhost:3100";
