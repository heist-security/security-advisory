import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import {
  configuration,
  migrate,
  migrationFailure,
  release,
} from "../.github/scripts/release.mjs";

const sha = "a".repeat(40);
function environment() {
  return {
    GITHUB_REPOSITORY: "heist-security/security-advisory",
    GITHUB_REF: "refs/heads/main",
    GITHUB_EVENT_NAME: "push",
    GITHUB_SHA: sha,
    GITHUB_TOKEN: "fixture-github-token",
    SUPABASE_DB_URL:
      "postgresql://postgres:fixture-password@db.example.com:5432/postgres?sslmode=verify-full",
    SUPABASE_DB_CA_CERT:
      "-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----",
    VERCEL_TOKEN: "fixture-vercel-token",
    VERCEL_PROJECT_ID: "prj_fixture",
    VERCEL_TEAM_ID: "team_fixture",
  };
}
function fixture(overrides = {}) {
  const calls = [],
    messages = [];
  let mainReads = 0;
  const options = {
    env: environment(),
    apply: () => calls.push("migrate"),
    pause: async () => {},
    attempts: 2,
    log: (message) => messages.push(message),
    request: async (url, init) => {
      calls.push({ url, ...init });
      let body;
      if (url.includes("api.github.com")) {
        body = {
          object: {
            sha: overrides.supersededAt === ++mainReads ? "b".repeat(40) : sha,
          },
        };
      } else if (url.includes("/projects/")) {
        body = {
          id: "prj_fixture",
          name: "security-advisory",
          link: {
            type: "github",
            org: "heist-security",
            repo: "security-advisory",
            productionBranch: "main",
          },
          ...overrides.project,
        };
      } else if (init.method === "POST") {
        body = { id: "dpl_fixture" };
      } else if (init.method === "PATCH") {
        body = {};
      } else {
        body = {
          readyState: "READY",
          aliasAssigned: true,
          meta: { githubCommitSha: sha },
          ...overrides.deployment,
        };
      }
      return { ok: true, json: async () => body };
    },
  };
  return { calls, messages, options };
}

test("migrates before creating an exact-commit production deployment", async () => {
  const f = fixture();
  assert.equal(await release(f.options), "ready");
  const creation = f.calls.find((call) => call.method === "POST");
  assert.ok(f.calls.indexOf("migrate") < f.calls.indexOf(creation));
  assert.equal(
    creation.url,
    "https://api.vercel.com/v13/deployments?teamId=team_fixture",
  );
  assert.deepEqual(JSON.parse(creation.body).gitSource, {
    type: "github",
    org: "heist-security",
    repo: "security-advisory",
    ref: "main",
    sha,
  });
  assert.equal(JSON.parse(creation.body).target, "production");
  for (const call of f.calls.filter((call) => typeof call === "object")) {
    assert.equal(call.redirect, "error");
    assert.equal(
      call.headers.Authorization,
      "Bearer " +
        (call.url.includes("api.github.com")
          ? "fixture-github-token"
          : "fixture-vercel-token"),
    );
  }
});
test("refuses PRs, fork repositories, tags and non-main manual dispatches before any API call", async () => {
  for (const patch of [
    { GITHUB_EVENT_NAME: "pull_request" },
    { GITHUB_EVENT_NAME: "pull_request_target" },
    { GITHUB_REPOSITORY: "someone/security-advisory" },
    { GITHUB_REF: "refs/tags/main" },
    {
      GITHUB_REF: "refs/heads/feature",
      GITHUB_EVENT_NAME: "workflow_dispatch",
    },
  ]) {
    const f = fixture();
    Object.assign(f.options.env, patch);
    await assert.rejects(release(f.options), /main-branch/);
    assert.deepEqual(f.calls, []);
  }
});
test("allows a main-branch manual retry", async () => {
  const f = fixture();
  f.options.env.GITHUB_EVENT_NAME = "workflow_dispatch";
  assert.equal(await release(f.options), "ready");
});
test("fails closed when credentials or verification settings are missing", async () => {
  for (const patch of [
    { VERCEL_TOKEN: "" },
    { SUPABASE_DB_CA_CERT: "" },
    {
      SUPABASE_DB_URL:
        "postgresql://postgres:fixture@db.example.com/postgres?sslmode=require",
    },
    {
      SUPABASE_DB_URL:
        "postgresql://postgres:fixture@db.example.com/postgres?sslmode=verify-full&sslmode=disable",
    },
    { SUPABASE_DB_URL: "invalid-and-sensitive" },
    { VERCEL_PROJECT_ID: "../another-project" },
  ]) {
    const f = fixture();
    Object.assign(f.options.env, patch);
    await assert.rejects(release(f.options));
    assert.deepEqual(f.calls, []);
  }
});
test("refuses a Vercel project connected to a different repository before migrating", async () => {
  const f = fixture({
    project: {
      link: {
        type: "github",
        org: "other",
        repo: "other",
        productionBranch: "main",
      },
    },
  });
  await assert.rejects(release(f.options), /linked to this repository/);
  assert.ok(!f.calls.includes("migrate"));
});
test("skips an outdated run before migration", async () => {
  const f = fixture({ supersededAt: 1 });
  assert.equal(await release(f.options), "superseded");
  assert.ok(!f.calls.includes("migrate"));
});
test("does not deploy if main advances while migrations are running", async () => {
  const f = fixture({ supersededAt: 2 });
  assert.equal(await release(f.options), "superseded");
  assert.ok(f.calls.includes("migrate"));
  assert.ok(!f.calls.some((call) => call.method === "POST"));
});
test("a failed migration cannot trigger a deployment", async () => {
  const f = fixture();
  f.options.apply = () => {
    throw new Error("Migration failed");
  };
  await assert.rejects(release(f.options), /Migration failed/);
  assert.ok(!f.calls.some((call) => call.method === "POST"));
});
test("waits for domain assignment before reporting success", async () => {
  const f = fixture();
  const original = f.options.request;
  let reads = 0;
  f.options.request = async (url, init) => {
    if (url.includes("/v13/deployments/") && ++reads === 1) {
      return {
        ok: true,
        json: async () => ({ readyState: "READY", aliasAssigned: false }),
      };
    }
    return original(url, init);
  };
  assert.equal(await release(f.options), "ready");
  assert.equal(reads, 2);
});
test("fails on unsuccessful or mismatched deployments", async () => {
  for (const deployment of [
    { readyState: "ERROR", errorMessage: "sensitive provider details" },
    { readyState: "CANCELED" },
    { aliasError: { message: "sensitive provider details" } },
    { meta: { githubCommitSha: "b".repeat(40) } },
  ]) {
    const f = fixture({ deployment });
    await assert.rejects(
      release(f.options),
      (error) => !error.message.includes("sensitive"),
    );
    assert.ok(f.calls.some((call) => call.method === "PATCH"));
  }
});
test("times out and requests cancellation instead of reporting a queued build as deployed", async () => {
  const f = fixture({
    deployment: { readyState: "BUILDING", aliasAssigned: false },
  });
  await assert.rejects(release(f.options), /timed out/);
  assert.ok(f.calls.some((call) => call.method === "PATCH"));
});
test("does not include provider error bodies or transport errors in failure messages", async () => {
  for (const request of [
    async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: "sensitive-provider-body" }),
    }),
    async () => {
      throw new Error("sensitive-transport-error");
    },
  ]) {
    const f = fixture();
    f.options.request = request;
    await assert.rejects(
      release(f.options),
      (error) => !error.message.includes("sensitive"),
    );
    assert.ok(!f.calls.includes("migrate"));
  }
});
test("uses verified TLS, isolates CLI credentials, and removes the certificate", async () => {
  const env = environment();
  let certificate, passfile;
  await migrate(configuration(env), env, (command, args, options) => {
    if (command === "psql") {
      assert.equal(options.env.VERCEL_TOKEN, undefined);
      assert.equal(options.env.GITHUB_TOKEN, undefined);
      assert.ok(!args.some((a) => a.includes("fixture-password")));
      assert.equal(options.env.PGDATABASE, "postgres");
      assert.equal(options.env.PGHOST, "db.example.com");
      assert.equal(options.env.PGPORT, "5432");
      assert.equal(options.env.PGUSER, "postgres");
      assert.equal(options.env.PGSSLMODE, "verify-full");
      assert.equal(options.env.PGSSLROOTCERT, certificate);
      assert.equal(options.env.PGPASSWORD, undefined);
      passfile = options.env.PGPASSFILE;
      assert.equal(statSync(passfile).mode & 0o777, 0o600);
      assert.equal(
        readFileSync(passfile, "utf8"),
        "db.example.com:5432:postgres:postgres:fixture-password\n",
      );
      return { status: 0, stdout: "0|0|t" };
    }
    assert.equal(command, "supabase");
    assert.deepEqual(args.slice(0, 3), ["db", "push", "--db-url"]);
    const url = new URL(args[3]);
    certificate = url.searchParams.get("sslrootcert");
    assert.equal(url.searchParams.get("sslmode"), "verify-full");
    assert.equal(readFileSync(certificate, "utf8"), env.SUPABASE_DB_CA_CERT);
    assert.equal(options.env.VERCEL_TOKEN, undefined);
    assert.equal(options.env.GITHUB_TOKEN, undefined);
    assert.deepEqual(options.stdio, ["ignore", "pipe", "pipe"]);
    assert.ok(!args.includes("--include-seed"));
    assert.ok(!args.includes("--include-all"));
    return { status: 0 };
  });
  assert.equal(existsSync(certificate), false);
  assert.equal(existsSync(passfile), false);
});
test("decodes connection fields, escapes password-file delimiters, and cleans up after backfill failure", async () => {
  const env = environment();
  env.SUPABASE_DB_URL =
    "postgresql://postgres.project:p%3Aa%5Css@db.example.com:6543/feed%20db?sslmode=verify-full";
  let passfile;
  await assert.rejects(
    migrate(configuration(env), env, (command, _args, options) => {
      if (command === "supabase") return { status: 0 };
      assert.equal(options.env.PGPORT, "6543");
      assert.equal(options.env.PGDATABASE, "feed db");
      assert.equal(options.env.PGUSER, "postgres.project");
      passfile = options.env.PGPASSFILE;
      assert.equal(
        readFileSync(passfile, "utf8"),
        "db.example.com:6543:feed db:postgres.project:p\\:a\\\\ss\n",
      );
      return { status: 1, stderr: "private details" };
    }),
    /Priority backfill failed/,
  );
  assert.equal(existsSync(passfile), false);
  assert.equal(
    migrationFailure({ error: { code: "ENOENT" } }),
    "database client not installed",
  );
  assert.equal(
    migrationFailure({
      stderr: "connection to server on socket private-location failed",
    }),
    "database connection failed",
  );
});
test("suppresses migration diagnostics and removes the certificate on failure", async () => {
  const env = environment();
  let certificate;
  await assert.rejects(
    () =>
      migrate(configuration(env), env, (_command, args) => {
        certificate = new URL(args[3]).searchParams.get("sslrootcert");
        return { status: 1, stderr: env.SUPABASE_DB_URL };
      }),
    (error) =>
      error.message.includes("Migration failed") &&
      !error.message.includes("fixture-password"),
  );
  assert.equal(existsSync(certificate), false);
});

test("backfill batches finish before deployment and retain safe failure categories", async () => {
  const env = environment();
  let calls = 0;
  await migrate(
    configuration(env),
    env,
    (cmd) => {
      if (cmd === "supabase") return { status: 0 };
      calls++;
      return { status: 0, stdout: calls === 1 ? "100|100|f" : "101|1|t" };
    },
    async () => {},
  );
  assert.equal(calls, 4);
  await assert.rejects(
    migrate(configuration(env), env, (cmd) =>
      cmd === "supabase"
        ? { status: 0 }
        : { status: 1, stderr: "ERROR: 57014 secret data" },
    ),
    /query timeout or cancellation/,
  );
  assert.equal(
    migrationFailure({ stderr: "ERROR: private database text and password" }),
    "database command failed",
  );
  assert.equal(
    migrationFailure({ stderr: "error (SQLSTATE 55P03) private data" }),
    "database lock timeout",
  );
  assert.equal(
    migrationFailure({ error: { code: "ETIMEDOUT" } }),
    "client timeout",
  );
  await assert.rejects(
    migrate(configuration(env), env, (cmd) =>
      cmd === "supabase"
        ? { status: 0 }
        : { status: 0, stdout: "secret-invalid-response" },
    ),
    /Invalid backfill response/,
  );
});

test("both backfills must complete; a technology failure blocks release", async () => {
  const env = environment();
  const procedures = [];
  await assert.rejects(
    migrate(configuration(env), env, (cmd, args) => {
      if (cmd === "supabase") return { status: 0 };
      const sql = args.at(-1);
      procedures.push(sql);
      return sql.includes("backfill_event_priority")
        ? { status: 0, stdout: "100|0|t" }
        : { status: 1, stderr: "ERROR: 57014 private data" };
    }),
    /Technology backfill failed \(query timeout or cancellation\)/,
  );
  assert.equal(procedures.length, 2);
  assert.match(procedures[1], /backfill_event_technologies/);
});

test("an advisory grouping backfill failure prevents deployment", async () => {
  const env = environment();
  await assert.rejects(
    migrate(configuration(env), env, (cmd, args) => {
      if (cmd === "supabase") return { status: 0 };
      return args.at(-1).includes("backfill_advisory_groups")
        ? { status: 1, stderr: "ERROR: 57014 private data" }
        : { status: 0, stdout: "100|0|t" };
    }),
    /Advisory grouping backfill failed \(query timeout or cancellation\)/,
  );
});

test("retries rolled-back contention on the same batch, with bounded backoff", async () => {
  for (const code of ["55P03", "40P01"]) {
    const env = environment();
    const commands = [],
      delays = [];
    let calls = 0;
    await migrate(
      configuration(env),
      env,
      (cmd, args) => {
        if (cmd === "supabase") return { status: 0 };
        commands.push(args.at(-1));
        if (++calls <= 2)
          return { status: 1, stderr: `ERROR: ${code} private details` };
        return { status: 0, stdout: "100|0|t" };
      },
      async (ms) => {
        delays.push(ms);
      },
    );
    assert.equal(calls, 5);
    assert.equal(commands[0], commands[1]);
    assert.equal(commands[1], commands[2]);
    assert.deepEqual(delays, [1000, 2000]);
  }
});

test("persistent contention stops before deployment and cleans up credentials", async () => {
  const f = fixture();
  let calls = 0,
    passfile;
  const delays = [];
  f.options.apply = (database, env) =>
    migrate(
      database,
      env,
      (cmd, _args, options) => {
        if (cmd === "supabase") return { status: 0 };
        passfile = options.env.PGPASSFILE;
        calls++;
        return { status: 1, stderr: "ERROR: 55P03 private details" };
      },
      async (ms) => {
        delays.push(ms);
      },
    );
  await assert.rejects(
    release(f.options),
    /Priority backfill failed \(database lock timeout\)/,
  );
  assert.equal(calls, 6);
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 10000]);
  assert.equal(existsSync(passfile), false);
  assert.ok(!f.calls.some((call) => call.method === "POST"));
});

test("does not retry ambiguous transport failures, query timeouts, or permanent SQL errors", async () => {
  for (const failure of [
    { status: 1, stderr: "ERROR: 57014 private details" },
    { status: 1, stderr: "ERROR: 42501 private details" },
    { status: 1, stderr: "ERROR: 42P01 private details" },
    { status: 1, stderr: "connection to server failed" },
    { error: { code: "ETIMEDOUT" }, stderr: "ERROR: 55P03 private details" },
  ]) {
    const env = environment();
    let calls = 0;
    await assert.rejects(
      migrate(
        configuration(env),
        env,
        (cmd) => {
          if (cmd === "supabase") return { status: 0 };
          calls++;
          return failure;
        },
        async () => {
          assert.fail("must not retry");
        },
      ),
      /backfill failed/,
    );
    assert.equal(calls, 1);
  }
});
