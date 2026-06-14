"use client";

import { useMemo } from "react";

// Atmospheric animated background, themed by campaign + region.
// Pure CSS particles/gradients (deterministic positions = SSR-safe, light DOM).

function tintFor(campaignId: string, region: string): string {
  const r = region.toLowerCase();
  if (campaignId === "crawl") {
    if (r.includes("floor 2") || r.includes("brand")) return "radial-gradient(900px 500px at 50% 0%, rgba(224,83,43,0.12), transparent 60%)";
    if (r.includes("studio") || r.includes("green room")) return "radial-gradient(900px 600px at 50% 30%, rgba(212,175,55,0.16), transparent 60%)";
    return "radial-gradient(900px 500px at 50% 0%, rgba(122,85,194,0.14), transparent 60%)";
  }
  if (r.includes("wood")) return "radial-gradient(900px 600px at 50% 10%, rgba(127,170,95,0.12), transparent 60%)";
  if (r.includes("waste")) return "radial-gradient(900px 600px at 50% 0%, rgba(224,83,43,0.12), transparent 60%)";
  if (r.includes("keep")) return "radial-gradient(900px 600px at 50% 10%, rgba(122,85,194,0.14), transparent 60%)";
  if (r.includes("throne")) return "radial-gradient(1000px 700px at 50% 20%, rgba(212,175,55,0.18), transparent 60%)";
  return "radial-gradient(1000px 600px at 50% -5%, rgba(212,175,55,0.08), transparent 60%)";
}

export default function SceneBackground({ campaignId, region }: { campaignId: string; region: string }) {
  const tint = tintFor(campaignId, region);
  const crawl = campaignId === "crawl";

  // Deterministic particle layout so server and client render identically.
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const left = (i * 37) % 100;
        const dur = 7 + ((i * 13) % 11);
        const delay = (i * 17) % 12;
        const size = 2 + (i % 3);
        return { left, dur, delay, size, key: i };
      }),
    []
  );

  return (
    <div className="bg-layer" aria-hidden>
      <div className="absolute inset-0" style={{ background: tint }} />
      {crawl ? (
        <>
          <div className="absolute inset-x-0 bottom-0 h-1/2 opacity-60">
            <div className="neon-grid" />
          </div>
          <div className="absolute inset-0 scanlines opacity-40" />
          {particles.slice(0, 12).map((p) => (
            <span
              key={p.key}
              className="mote"
              style={{
                left: `${p.left}%`,
                top: `${(p.key * 29) % 90}%`,
                width: p.size,
                height: p.size,
                background: p.key % 2 ? "rgba(224,83,43,0.6)" : "rgba(122,85,194,0.7)",
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </>
      ) : (
        particles.map((p) => (
          <span
            key={p.key}
            className="ember"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))
      )}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55))]" />
    </div>
  );
}
