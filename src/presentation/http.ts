export const cacheHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};
// Event feeds (including empty cursor pages) must reflect the current database.
// Layering CDN SWR over Next's data cache can re-cache an already stale result.
export const feedHeaders = {
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
