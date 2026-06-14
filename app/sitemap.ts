import type { MetadataRoute } from "next";

const SITE = "https://legendsoftheshatteredrealm.com";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/create/`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/play/`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
