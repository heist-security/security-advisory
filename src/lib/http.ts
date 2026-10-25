export const cacheHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};
// Event feeds (including empty cursor pages) must reflect the current database.
// Layering CDN SWR over Next's data cache can re-cache an already stale result.
export const eventHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};
export function unavailable() {
  return Response.json(
    { error: "Feed temporarily unavailable" },
    {
      status: 503,
      headers: {
        "Retry-After": "60",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    },
  );
}
export function allowedUrl(value: string, origins: string[], prefix?: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !origins.includes(url.origin)
  )
    throw new Error("URL outside source allowlist");
  if (prefix && !url.toString().toLowerCase().startsWith(prefix.toLowerCase()))
    throw new Error("URL outside source path");
  return url.toString();
}
export async function fetchText(
  value: string,
  origins: string[],
  maxBytes = 2_000_000,
  prefix?: string,
): Promise<string> {
  const resource = await fetchResource(value, origins, {
    max_bytes: maxBytes,
    url_prefix: prefix,
  });
  if (resource.text === null)
    throw new Error("Unexpected not-modified response");
  return resource.text;
}
export async function fetchResource(
  value: string,
  origins: string[],
  validators: {
    etag?: string | null;
    last_modified?: string | null;
    max_bytes?: number;
    url_prefix?: string;
  } = {},
) {
  let url = allowedUrl(value, origins, validators.url_prefix);
  const signal = AbortSignal.timeout(12000);
  for (let hop = 0; hop < 4; hop++) {
    const headers: Record<string, string> = {
      "User-Agent": "HeistFeed/0.2 (+https://feed.heist.security)",
    };
    if (validators.etag) headers["If-None-Match"] = validators.etag;
    if (validators.last_modified)
      headers["If-Modified-Since"] = validators.last_modified;
    const response = await fetch(url, { redirect: "manual", signal, headers });
    const metadata = {
      etag: response.headers.get("etag"),
      last_modified: response.headers.get("last-modified"),
    };
    if (response.status === 304) {
      void response.body?.cancel().catch(() => {});
      return { ...metadata, text: null, status: 304 };
    }
    if (response.status >= 300 && response.status < 400) {
      void response.body?.cancel().catch(() => {});
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect missing location");
      url = allowedUrl(
        new URL(location, url).toString(),
        origins,
        validators.url_prefix,
      );
      continue;
    }
    if (!response.ok || !response.body)
      throw new Error(`Source HTTP ${response.status}`);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      size += chunk.length;
      if (size > (validators.max_bytes ?? 2_000_000)) {
        void reader.cancel().catch(() => {});
        throw new Error("Source exceeds configured byte limit");
      }
      chunks.push(chunk);
    }
    return {
      ...metadata,
      text: Buffer.concat(chunks).toString("utf8"),
      status: response.status,
    };
  }
  throw new Error("Too many redirects");
}
