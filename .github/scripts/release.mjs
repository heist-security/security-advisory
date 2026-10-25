import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout } from "node:timers/promises";

class ReleaseError extends Error {}

export function configuration(env) {
  if (
    env.GITHUB_REPOSITORY !== "heist-security/security-advisory" ||
    env.GITHUB_REF !== "refs/heads/main" ||
    !["push", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME) ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "")
  )
    throw new ReleaseError(
      "Production releases require a main-branch push or dispatch.",
    );
  for (const key of [
    "GITHUB_TOKEN",
    "SUPABASE_DB_URL",
    "SUPABASE_DB_CA_CERT",
    "VERCEL_TOKEN",
    "VERCEL_PROJECT_ID",
    "VERCEL_TEAM_ID",
  ]) {
    if (!env[key]?.trim())
      throw new ReleaseError("Missing production setting: " + key);
  }
  let database;
  try {
    database = new URL(env.SUPABASE_DB_URL);
  } catch {
    throw new ReleaseError("Invalid database connection URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !database.hostname ||
    !database.username ||
    !database.password ||
    database.searchParams.getAll("sslmode").length !== 1 ||
    database.searchParams.get("sslmode") !== "verify-full"
  )
    throw new ReleaseError(
      "Database URL requires credentials and sslmode=verify-full.",
    );
  if (!env.SUPABASE_DB_CA_CERT.includes("-----BEGIN CERTIFICATE-----")) {
    throw new ReleaseError("Configure the Supabase database CA certificate.");
  }
  if (
    !/^prj_[a-zA-Z0-9]+$/.test(env.VERCEL_PROJECT_ID) ||
    !/^team_[a-zA-Z0-9]+$/.test(env.VERCEL_TEAM_ID)
  )
    throw new ReleaseError("Configure valid Vercel project and team IDs.");
  return database;
}

export function migrationFailure(result) {
  const states = {
    57014: "query timeout or cancellation",
    "55P03": "database lock timeout",
    "40P01": "database deadlock",
    42501: "database permission denied",
    42701: "column already exists",
    "42P01": "required table missing",
  };
  const code = String(result.stderr ?? "").match(
    /(?:SQLSTATE[ :]*|ERROR:\s*)([0-9A-Z]{5})\b/,
  )?.[1];
  if (result.error?.code === "ENOENT") return "database client not installed";
  if (
    /connection to server|could not translate host name/i.test(
      String(result.stderr ?? ""),
    )
  )
    return "database connection failed";
  return result.error?.code === "ETIMEDOUT"
    ? "client timeout"
    : (states[code] ?? "database command failed");
}
export async function migrate(
  database,
  env,
  execute = spawnSync,
  pause = setTimeout,
) {
  const directory = mkdtempSync(join(tmpdir(), "heist-migration-"));
  try {
    const certificate = join(directory, "root.crt");
    writeFileSync(certificate, env.SUPABASE_DB_CA_CERT, { mode: 0o600 });
    database.searchParams.set("sslrootcert", certificate);
    // Only the database credential reaches the CLI, never GitHub/Vercel tokens.
    const result = execute(
      "supabase",
      ["db", "push", "--db-url", database.toString(), "--yes"],
      {
        env: {
          PATH: env.PATH,
          HOME: env.HOME,
          PGSSLMODE: "verify-full",
          PGSSLROOTCERT: certificate,
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 8 * 60 * 1000,
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    // SQL/driver diagnostics may contain data or transformed credentials.
    if (result.error || result.status !== 0) {
      throw new ReleaseError(
        "Migration failed (" +
          migrationFailure(result) +
          "); deployment stopped. Inspect the database and migration history privately.",
      );
    }
    // Schema DDL has committed. Backfill separately so readers remain available
    // and interrupted releases resume from the last committed batch.
    // libpq does not expand connection URIs supplied through PGDATABASE.
    // Keep the password in a private file rather than process arguments/env.
    const connection = psqlEnvironment(database, env, certificate, directory);
    const deadline = Date.now() + 15 * 60 * 1000;
    for (let attempt = 0; attempt < 5000 && Date.now() < deadline; attempt++) {
      const batch = execute(
        "psql",
        [
          "--no-psqlrc",
          "--no-password",
          "--quiet",
          "--tuples-only",
          "--no-align",
          "--set=ON_ERROR_STOP=1",
          "--set=VERBOSITY=sqlstate",
          "--command",
          "set lock_timeout='5s'; set statement_timeout='30s'; select last_id,processed,done from public.backfill_event_priority(100);",
        ],
        {
          env: connection,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 45000,
          maxBuffer: 65536,
        },
      );
      if (batch.error || batch.status !== 0)
        throw new ReleaseError(
          "Priority backfill failed (" +
            migrationFailure(batch) +
            "); deployment stopped. Completed batches are retained for retry.",
        );
      const progress = String(batch.stdout ?? "")
        .trim()
        .match(/^(\d+)\|(\d+)\|([tf])$/);
      if (!progress)
        throw new ReleaseError(
          "Invalid backfill response; deployment stopped.",
        );
      if (progress[3] === "t") return;
      await pause(100);
    }
    throw new ReleaseError(
      "Priority backfill timed out; deployment stopped. Retry resumes completed batches.",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function psqlEnvironment(database, env, certificate, directory) {
  const host = database.hostname.replace(/^\[|\]$/g, "");
  const port = database.port || "5432";
  const name = decodeURIComponent(database.pathname.slice(1)) || "postgres";
  const user = decodeURIComponent(database.username);
  const password = decodeURIComponent(database.password);
  const fields = [host, port, name, user, password];
  if (fields.some((value) => /[\r\n\0]/.test(value)))
    throw new ReleaseError("Invalid database connection field.");
  const passfile = join(directory, "pgpass");
  writeFileSync(
    passfile,
    fields.map((value) => value.replace(/[\\:]/g, "\\$&")).join(":") + "\n",
    { mode: 0o600 },
  );
  return {
    PATH: env.PATH,
    HOME: env.HOME,
    PGHOST: host,
    PGPORT: port,
    PGDATABASE: name,
    PGUSER: user,
    PGPASSFILE: passfile,
    PGCONNECT_TIMEOUT: "10",
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: certificate,
  };
}

export async function release({
  env = process.env,
  request = fetch,
  apply = migrate,
  pause = setTimeout,
  log = console.log,
  attempts = 90,
} = {}) {
  const database = configuration(env);
  async function api(origin, path, token, method = "GET", body) {
    let response;
    try {
      response = await request(origin + path, {
        method,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ReleaseError(
        "Release API request failed; inspect provider state before retrying.",
      );
    }
    if (!response.ok)
      throw new ReleaseError(
        "Release API returned HTTP " +
          response.status +
          "; inspect provider settings privately.",
      );
    try {
      return await response.json();
    } catch {
      throw new ReleaseError("Invalid release API response.");
    }
  }
  const currentMain = async () => {
    const ref = await api(
      "https://api.github.com",
      "/repos/heist-security/security-advisory/git/ref/heads/main",
      env.GITHUB_TOKEN,
    );
    if (!/^[a-f0-9]{40}$/.test(ref.object?.sha ?? ""))
      throw new ReleaseError("Could not verify main.");
    return ref.object.sha === env.GITHUB_SHA;
  };
  const query = "?teamId=" + encodeURIComponent(env.VERCEL_TEAM_ID);
  const vercel = (path, method, body) =>
    api("https://api.vercel.com", path + query, env.VERCEL_TOKEN, method, body);
  if (!(await currentMain())) {
    log("A newer main commit exists; this release was skipped.");
    return "superseded";
  }
  const project = await vercel("/v9/projects/" + env.VERCEL_PROJECT_ID);
  if (
    project.id !== env.VERCEL_PROJECT_ID ||
    project.link?.type !== "github" ||
    project.link?.org !== "heist-security" ||
    project.link?.repo !== "security-advisory" ||
    project.link?.productionBranch !== "main" ||
    typeof project.name !== "string" ||
    !project.name
  )
    throw new ReleaseError(
      "Vercel must be linked to this repository with main as its production branch.",
    );
  await apply(database, env);
  log("Database migrations completed.");
  if (!(await currentMain())) {
    log(
      "A newer main commit exists; migrations completed, application deployment skipped.",
    );
    return "superseded";
  }
  let deployment;
  try {
    deployment = await vercel("/v13/deployments", "POST", {
      name: project.name,
      project: env.VERCEL_PROJECT_ID,
      target: "production",
      gitSource: {
        type: "github",
        org: "heist-security",
        repo: "security-advisory",
        ref: "main",
        sha: env.GITHUB_SHA,
      },
    });
    if (!/^dpl_[a-zA-Z0-9]+$/.test(deployment.id ?? ""))
      throw new ReleaseError("Vercel did not return a valid deployment ID.");
    const deadline = Date.now() + 15 * 60 * 1000;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (Date.now() >= deadline) break;
      const status = await vercel("/v13/deployments/" + deployment.id);
      if (
        ["ERROR", "CANCELED"].includes(status.readyState) ||
        status.aliasError
      ) {
        throw new ReleaseError(
          "Vercel deployment failed. Inspect its private deployment logs.",
        );
      }
      if (status.readyState === "READY" && status.aliasAssigned === true) {
        if (status.meta?.githubCommitSha !== env.GITHUB_SHA) {
          throw new ReleaseError(
            "Vercel deployed an unexpected commit; inspect production immediately.",
          );
        }
        log(
          "Production deployment is ready for commit " + env.GITHUB_SHA + ".",
        );
        return "ready";
      }
      await pause(10000);
    }
    throw new ReleaseError(
      "Vercel deployment timed out; inspect its state before retrying.",
    );
  } catch (error) {
    if (/^dpl_[a-zA-Z0-9]+$/.test(deployment?.id ?? "")) {
      try {
        await vercel("/v12/deployments/" + deployment.id + "/cancel", "PATCH");
      } catch {
        log(
          "Could not cancel the Vercel deployment; inspect its state before retrying.",
        );
      }
    }
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  release().catch((error) => {
    console.error(
      error instanceof ReleaseError
        ? error.message
        : "Release failed; inspect provider state privately before retrying.",
    );
    process.exitCode = 1;
  });
}
