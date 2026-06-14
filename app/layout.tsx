import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://legendsoftheshatteredrealm.com"),
  title: "Legends of the Shattered Realm",
  description:
    "A browser-based dark-fantasy RPG with an AI Dungeon Master. Forge a hero, gather the Shards of Aethyr, and decide the fate of a broken world.",
  applicationName: "Legends of the Shattered Realm",
  authors: [{ name: "Legends of the Shattered Realm" }],
  keywords: [
    "fantasy RPG",
    "browser game",
    "AI Dungeon Master",
    "text adventure",
    "roleplaying game",
    "Legends of the Shattered Realm",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Legends of the Shattered Realm",
    description:
      "Forge a hero, gather the Shards of Aethyr, and mend (or claim) a broken world.",
    url: "https://legendsoftheshatteredrealm.com",
    siteName: "Legends of the Shattered Realm",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Legends of the Shattered Realm",
    description:
      "Forge a hero, gather the Shards of Aethyr, and mend (or claim) a broken world.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0a07",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-900 text-parchment-100 antialiased">
        {children}
      </body>
    </html>
  );
}
