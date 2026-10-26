import { spawn } from "node:child_process";
import { testDatabase, applyMigrations } from "../support/database";
import { migrateFeed } from "../../scripts/migrate-feed";
import { configureSources } from "../../scripts/configure-sources";
import { feedRepository } from "../../src/adapters/postgres/feed-repository";
import { ingestionQueue } from "../../src/adapters/postgres/ingestion-queue";
import { publisher } from "../../src/application/publish";
import { payload, record, at } from "../support/fixtures";
const test = await testDatabase(true);
try {
  await applyMigrations(test.db);
  await migrateFeed(test.db);
  const source = "github-containerd-containerd";
  await configureSources(test.db, [source], at);
  const queue = ingestionQueue(test.db),
    publish = publisher(feedRepository(test.db), () => new Date(at));
  for (const [version, p] of [
    ...Array.from(
      { length: 25 },
      (_, i) =>
        [
          "old-" + i,
          {
            ...payload("1.0." + i, ["CVE-2026-" + (10000 + i)]),
            kind: "advisory" as const,
            title: "Older advisory " + i,
            severity: "high" as const,
          },
        ] as const,
    ),
    ["3.0.0", payload("3.0.0", ["CVE-2026-99999"])],
    ["2.4.1", payload("2.4.1")],
    ["2.0.14", payload("2.0.14")],
  ] as const) {
    await test.db.query("select enqueue_document($1,$2,$3,$3,$4)", [
      source,
      record(version).url,
      version,
      at,
    ]);
    const job = await queue.claimDocument([source], 10000);
    await publish(job!, { payload: p, method: "llm", model: "fixture" });
  }
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3039",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: test.url!,
        DATABASE_CA_CERT: "",
        PUBLIC_BASE_URL: "http://127.0.0.1:3039",
        CRON_SECRET: "browser-test-placeholder",
        VENDOR_SOURCE_IDS: source,
        OPENAI_API_KEY: "",
        OPENAI_MODEL: "",
      },
    },
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => child.kill(signal));
  await new Promise<void>((resolve, reject) => {
    child.on("exit", (code) => {
      if (code) process.exitCode = code;
      resolve();
    });
    child.on("error", reject);
  });
} finally {
  await test.close();
}
