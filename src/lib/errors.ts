// Persist only known categories. Never store provider responses, source text, keys or arbitrary error messages.
export function databaseFailureReason(error: unknown) {
  const e = error as { code?: string; name?: string };
  switch (e?.code) {
    case "57014":
      return "query_canceled";
    case "55P03":
      return "lock_timeout";
    case "40P01":
      return "deadlock";
    case "53300":
      return "connection_limit";
    case "PGRST003":
      return "connection_timeout";
    case "PGRST000":
    case "PGRST001":
    case "PGRST002":
      return "database_unavailable";
    case "42P01":
    case "42883":
    case "PGRST202":
      return "schema_mismatch";
  }
  if (e?.name === "AbortError" || e?.name === "TimeoutError") return "timeout";
  return "database_query_failed";
}

export function failureReason(error: unknown) {
  const e = error as { status?: number; name?: string; message?: string };
  if (/checkpoint outside|backfill required/.test(e?.message ?? ""))
    return "structured_backfill_required";
  if (/Source not selected/.test(e?.message ?? ""))
    return "source_not_selected";
  if (
    /Structured|Invalid OSV|CVE upstream|identity mismatch/.test(
      e?.message ?? "",
    )
  )
    return "structured_validation";
  if (e?.status === 429) return "provider_rate_limit";
  if (e?.status === 401 || e?.status === 403) return "provider_authentication";
  if (e?.status === 400 || e?.status === 404) return "provider_configuration";
  if (
    e?.name === "AbortError" ||
    e?.name === "TimeoutError" ||
    e?.name === "APIConnectionTimeoutError"
  )
    return "timeout";
  if (e?.name === "ZodError") return "schema_validation";
  if (
    /Evidence|Fact|Severity|CVE|Patch|Incomplete|extraction/i.test(
      e?.message ?? "",
    )
  )
    return "extraction_validation";
  if (/allowlist|source path/i.test(e?.message ?? ""))
    return "source_url_rejected";
  if (/oversized|byte limit|Entry limit/i.test(e?.message ?? ""))
    return "source_size_limit";
  if (/lease/i.test(e?.message ?? "")) return "lease_replaced";
  return "collection_or_processing_failed";
}
