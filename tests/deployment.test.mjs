import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { configuration, migrate, release } from "../.github/scripts/release.mjs";

const sha = "a".repeat(40);
function environment() {
  return {
    GITHUB_REPOSITORY: "heist-security/security-advisory",
    GITHUB_REF: "refs/heads/main",
    GITHUB_EVENT_NAME: "push",
    GITHUB_SHA: sha,
    GITHUB_TOKEN: "fixture-github-token",
    SUPABASE_DB_URL: "postgresql://postgres:fixture-password@db.example.com:5432/postgres?sslmode=verify-full",
    SUPABASE_DB_CA_CERT: "-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----",
    VERCEL_TOKEN: "fixture-vercel-token",
    VERCEL_PROJECT_ID: "prj_fixture",
    VERCEL_TEAM_ID: "team_fixture",
  };
}
function fixture(overrides = {}) {
  const calls = [], messages = [];
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
        body = { object: { sha: overrides.supersededAt === ++mainReads ? "b".repeat(40) : sha } };
      } else if (url.includes("/projects/")) {
        body = { id: "prj_fixture", name: "security-advisory", link: { type: "github", org: "heist-security", repo: "security-advisory", productionBranch: "main" }, ...overrides.project };
      } else if (init.method === "POST") {
        body = { id: "dpl_fixture" };
      } else if (init.method === "PATCH") {
        body = {};
      } else {
        body = { readyState: "READY", aliasAssigned: true, meta: { githubCommitSha: sha }, ...overrides.deployment };
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
  assert.equal(creation.url, "https://api.vercel.com/v13/deployments?teamId=team_fixture");
  assert.deepEqual(JSON.parse(creation.body).gitSource, {
    type: "github", org: "heist-security", repo: "security-advisory", ref: "main", sha,
  });
  assert.equal(JSON.parse(creation.body).target, "production");
  for (const call of f.calls.filter((call) => typeof call === "object")) {
    assert.equal(call.redirect, "error");
    assert.equal(call.headers.Authorization, "Bearer " + (call.url.includes("api.github.com") ? "fixture-github-token" : "fixture-vercel-token"));
  }
});
test("refuses PRs, fork repositories, tags and non-main manual dispatches before any API call", async () => {
  for (const patch of [
    { GITHUB_EVENT_NAME: "pull_request" },
    { GITHUB_EVENT_NAME: "pull_request_target" },
    { GITHUB_REPOSITORY: "someone/security-advisory" },
    { GITHUB_REF: "refs/tags/main" },
    { GITHUB_REF: "refs/heads/feature", GITHUB_EVENT_NAME: "workflow_dispatch" },
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
    { SUPABASE_DB_URL: "postgresql://postgres:fixture@db.example.com/postgres?sslmode=require" },
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
  const f = fixture({ project: { link: { type: "github", org: "other", repo: "other", productionBranch: "main" } } });
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
  f.options.apply = () => { throw new Error("Migration failed"); };
  await assert.rejects(release(f.options), /Migration failed/);
  assert.ok(!f.calls.some((call) => call.method === "POST"));
});
test("waits for domain assignment before reporting success", async () => {
  const f = fixture();
  const original = f.options.request;
  let reads = 0;
  f.options.request = async (url, init) => {
    if (url.includes("/v13/deployments/") && ++reads === 1) {
      return { ok: true, json: async () => ({ readyState: "READY", aliasAssigned: false }) };
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
    await assert.rejects(release(f.options), (error) => !error.message.includes("sensitive"));
    assert.ok(f.calls.some((call) => call.method === "PATCH"));
  }
});
test("times out and requests cancellation instead of reporting a queued build as deployed", async () => {
  const f = fixture({ deployment: { readyState: "BUILDING", aliasAssigned: false } });
  await assert.rejects(release(f.options), /timed out/);
  assert.ok(f.calls.some((call) => call.method === "PATCH"));
});
test("does not include provider error bodies or transport errors in failure messages", async () => {
  for (const request of [
    async () => ({ ok: false, status: 403, json: async () => ({ message: "sensitive-provider-body" }) }),
    async () => { throw new Error("sensitive-transport-error"); },
  ]) {
    const f = fixture();
    f.options.request = request;
    await assert.rejects(release(f.options), (error) => !error.message.includes("sensitive"));
    assert.ok(!f.calls.includes("migrate"));
  }
});
test("uses verified TLS, isolates CLI credentials, and removes the certificate", () => {
  const env = environment();
  let certificate;
  migrate(configuration(env), env, (command, args, options) => {
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
});
test("suppresses migration diagnostics and removes the certificate on failure", () => {
  const env = environment();
  let certificate;
  assert.throws(() => migrate(configuration(env), env, (_command, args) => {
    certificate = new URL(args[3]).searchParams.get("sslrootcert");
    return { status: 1, stderr: env.SUPABASE_DB_URL };
  }), (error) => error.message.includes("Migration failed") && !error.message.includes("fixture-password"));
  assert.equal(existsSync(certificate), false);
});
