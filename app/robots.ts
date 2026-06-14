import type { MetadataRoute } from "next";

const SITE = "https://legendsoftheshatteredrealm.com";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
