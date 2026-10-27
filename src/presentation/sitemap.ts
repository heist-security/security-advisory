export const validSitemapPart = (part: string) =>
  /^(0|[1-9]\d{0,9})$/.test(part) && Number.isSafeInteger(Number(part) * 1000);
export function sitemapXml(kind: "sitemapindex" | "urlset", urls: string[]) {
  const tag = kind === "sitemapindex" ? "sitemap" : "url";
  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return `<?xml version="1.0" encoding="UTF-8"?><${kind} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<${tag}><loc>${escape(url)}</loc></${tag}>`).join("")}</${kind}>`;
}
