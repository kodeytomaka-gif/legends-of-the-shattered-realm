import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Legends of the Shattered Realm",
  description:
    "A browser-based dark-fantasy RPG with an AI Dungeon Master. Forge a hero, gather the Shards of Aethyr, and decide the fate of a broken world.",
  applicationName: "Legends of the Shattered Realm",
  authors: [{ name: "Legends of the Shattered Realm" }],
  openGraph: {
    title: "Legends of the Shattered Realm",
    description:
      "Forge a hero, gather the Shards of Aethyr, and mend (or claim) a broken world.",
    type: "website",
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
