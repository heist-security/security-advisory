import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { migrate } from "../.github/scripts/release.mjs";

// Only the ephemeral CI PostgreSQL service is used. Never supply production
// credentials: this fixture intentionally has no TLS server certificate.
test(
  "real psql connects, drains populated backfill, and retries without replay",
  {
    skip: !process.env.BACKFILL_CLI_TEST,
  },
  async () => {
    const database = new URL(
      "postgresql://postgres:ci-only-password@localhost:5432/postgres?sslmode=verify-full",
    );
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      SUPABASE_DB_CA_CERT: "ci-placeholder",
    };
    const legacy = spawnSync(
      "psql",
      ["--no-psqlrc", "--no-password", "--command", "select 1"],
      {
        env: {
          PATH: env.PATH,
          PGDATABASE: database.toString(),
          PGCONNECT_TIMEOUT: "2",
        },
        encoding: "utf8",
        timeout: 5000,
      },
    );
    assert.notEqual(
      legacy.status,
      0,
      "a URL in PGDATABASE must reproduce the old connection failure",
    );
    let batches = 0;
    let lastProgress;
    const files = [];
    const execute = (command, args, options) => {
      // The workflow has already applied the real migrations to populated data.
      if (command === "supabase") return { status: 0 };
      assert.equal(command, "psql");
      assert.equal(options.env.PGSSLMODE, "verify-full");
      assert.equal(options.env.PGPASSWORD, undefined);
      files.push(options.env.PGPASSFILE, options.env.PGSSLROOTCERT);
      const result = spawnSync(command, args, {
        ...options,
        // Only this local test's transport is plaintext; production always uses
        // verify-full. Keep all real connection/authentication/SQL code intact.
        env: { ...options.env, PGSSLMODE: "disable" },
      });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, "real psql backfill command must succeed");
      lastProgress = result.stdout.trim();
      batches++;
      return result;
    };
    await migrate(new URL(database), env, execute, async () => {});
    assert.equal(batches, 21);
    assert.equal(lastProgress, "2000|0|t");
    await migrate(new URL(database), env, execute, async () => {});
    assert.equal(batches, 22);
    assert.equal(lastProgress, "2000|0|t");
    for (const path of files) assert.equal(existsSync(path), false);
  },
);
