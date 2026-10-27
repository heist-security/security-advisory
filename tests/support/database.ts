import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { Pool } from "pg";
import {
  postgres,
  connectionConfig,
  type Database,
} from "../../src/adapters/postgres/client";
const directory = new URL("../../supabase/migrations/", import.meta.url);
export const migrations = readdirSync(directory)
  .filter((n) => n.endsWith(".sql"))
  .sort();
export async function applyMigrations(db: Database, names = migrations) {
  for (const name of names)
    await db.transaction((client) =>
      client.query(readFileSync(new URL(name, directory), "utf8")),
    );
}
/** An isolated database, never a production connection. CI also runs this on PostgreSQL 17. */
export async function testDatabase(native = false) {
  let db: Database, url: string | undefined, close: () => Promise<void>;
  if (native || process.env.TEST_DATABASE_URL) {
    if (!process.env.TEST_DATABASE_URL)
      throw new Error(
        "Set TEST_DATABASE_URL to a disposable local PostgreSQL instance (see CONTRIBUTING.md)",
      );
    const admin = new Pool(connectionConfig(process.env.TEST_DATABASE_URL));
    const name =
      "heist_test_" + process.pid + "_" + Math.random().toString(36).slice(2);
    await admin.query(`create database ${name}`);
    const connection = new URL(process.env.TEST_DATABASE_URL);
    connection.pathname = "/" + name;
    url = connection.toString();
    const pool = new Pool(connectionConfig(url));
    db = postgres(pool);
    close = async () => {
      await pool.end();
      await admin.query(`drop database ${name}`);
      await admin.end();
    };
  } else {
    const pg = new PGlite({ extensions: { pg_trgm } });
    db = {
      query: async (text, values) =>
        (values
          ? await pg.query(text, values)
          : (await pg.exec(text)).at(-1)) as never,
      transaction: async (run) =>
        pg.transaction(async (tx) =>
          run({
            query: async (text, values) =>
              (values
                ? await tx.query(text, values)
                : (await tx.exec(text)).at(-1)) as never,
          }),
        ),
    };
    close = () => pg.close();
  }
  await db.query(
    "do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if; end$$;",
  );
  return { db, url, close };
}
