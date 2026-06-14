/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export so the whole game ships as plain files to Cloudflare Pages.
  output: "export",
  // Pages serves a CDN; Next's image optimizer isn't available there.
  images: { unoptimized: true },
  // Emit /play/index.html instead of /play.html so Pages routes cleanly.
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
