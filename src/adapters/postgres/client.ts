import { Pool, type PoolConfig } from "pg";
export interface SqlClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}
export interface Database extends SqlClient {
  transaction<T>(operation: (client: SqlClient) => Promise<T>): Promise<T>;
}
export function postgres(pool: Pool): Database {
  return {
    query: (sql, values) => pool.query(sql, values),
    async transaction(operation) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          "set local lock_timeout='5s'; set local statement_timeout='30s'",
        );
        const result = await operation(client);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
export function connectionConfig(url: string, ca?: string): PoolConfig {
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol))
    throw new Error("Invalid database URL");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (
    !local &&
    ["disable", "no-verify"].includes(parsed.searchParams.get("sslmode") ?? "")
  )
    throw new Error("Remote database connections require verified TLS");
  for (const key of ["ssl", "sslmode", "sslrootcert", "sslcert", "sslkey"])
    parsed.searchParams.delete(key);
  return {
    connectionString: parsed.toString(),
    ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    max: 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    statement_timeout: 10000,
  };
}
let pool: Pool | undefined;
export function database() {
  if (!pool) {
    const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    if (!url) throw new Error("Database is not configured");
    pool = new Pool(
      connectionConfig(
        url,
        process.env.DATABASE_CA_CERT || process.env.SUPABASE_DB_CA_CERT,
      ),
    );
    pool.on("error", () => console.error("Database connection unavailable"));
  }
  return postgres(pool);
}
export async function closeDatabase() {
  await pool?.end();
  pool = undefined;
}
