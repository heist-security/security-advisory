import type { MetadataRoute } from "next";
import { baseUrl } from "@/server/services";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: baseUrl() + "/sitemap.xml",
  };
}
