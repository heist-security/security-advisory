// Persist only known categories. Never store provider responses, source text, keys or arbitrary error messages.
export function failureReason(error: unknown) {
  const e = error as { status?: number; name?: string; message?: string };
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
