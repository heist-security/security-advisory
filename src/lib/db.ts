import { createClient } from "@supabase/supabase-js";
export function configured() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
export function db() {
  if (!configured()) throw new Error("Database is not configured");
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            // Database state must not enter Next's persistent fetch cache.
            cache: "no-store",
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)])
              : AbortSignal.timeout(10000),
          }),
      },
    },
  );
}
export function baseUrl() {
  return (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}
