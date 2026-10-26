import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
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
    assert.equal(batches, 64);
    assert.equal(lastProgress, "0|0|t");
    await migrate(new URL(database), env, execute, async () => {});
    assert.equal(batches, 68);
    assert.equal(lastProgress, "0|0|t");

    // Hold the real publication lock in another database session. Completed
    // backfills must return without waiting for it; unfinished work must retry.
    const holder = spawn(
      "psql",
      ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
      {
        env: { ...process.env, PGSSLMODE: "disable" },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const closed = new Promise((resolve) => holder.once("close", resolve));
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("lock holder did not become ready")),
          5000,
        );
        let output = "";
        holder.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        holder.stdout.on("data", (chunk) => {
          output += chunk;
          if (output.includes("LOCK_HELD")) {
            clearTimeout(timer);
            resolve();
          }
        });
        holder.stdin.write(
          "select pg_advisory_lock(719432001);\n\\echo LOCK_HELD\n",
        );
      });
      await migrate(new URL(database), env, execute, async () => {
        assert.fail("completed backfills must not wait for publication");
      });
      assert.equal(batches, 72);
      const reset = spawnSync(
        "psql",
        [
          "-X",
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          "update technology_backfill set completed_at=null where singleton",
        ],
        { encoding: "utf8" },
      );
      assert.equal(reset.status, 0);
      let retries = 0;
      await migrate(
        new URL(database),
        env,
        (command, args, options) => {
          if (command === "supabase") return { status: 0 };
          const result = spawnSync(command, args, {
            ...options,
            env: { ...options.env, PGSSLMODE: "disable" },
          });
          if (result.status !== 0) assert.match(result.stderr, /55P03/);
          return result;
        },
        async () => {
          retries++;
          holder.stdin.end("\\q\n");
          await closed;
        },
      );
      assert.equal(retries, 1);
      const counts = spawnSync(
        "psql",
        [
          "-X",
          "-t",
          "-A",
          "-c",
          "select (select count(*) from events),last_id,completed_at is not null from technology_backfill",
        ],
        { encoding: "utf8" },
      );
      assert.equal(counts.status, 0);
      assert.equal(counts.stdout.trim(), "2000|2000|t");
    } finally {
      holder.kill();
      await closed;
    }
    for (const path of files) assert.equal(existsSync(path), false);
  },
);
