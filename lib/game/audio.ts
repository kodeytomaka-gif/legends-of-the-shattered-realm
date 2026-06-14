// Asset-free sound: all SFX and ambient music are synthesized with the WebAudio
// API, so nothing binary ships in the repo and it works offline. The AudioContext
// is created lazily on the first sound (after a user gesture) per browser policy.

type Win = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxOn = true;
let musicOn = false;
let musicNodes: { osc: OscillatorNode[]; gain: GainNode; lfo: OscillatorNode } | null = null;

function ensure(): boolean {
  if (typeof window === "undefined") return false;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as Win).webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return true;
}

export function setSfxEnabled(on: boolean): void {
  sfxOn = on;
}

function tone(opts: { freq: number; dur: number; type?: OscillatorType; gain?: number; slideTo?: number; delay?: number }): void {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + opts.dur);
  const peak = opts.gain ?? 0.5;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.02);
}

function noise(dur: number, gain = 0.4, hp = 800): void {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = "highpass";
  filt.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filt);
  filt.connect(g);
  g.connect(master);
  src.start(t0);
}

export type Sfx = "dice" | "diceland" | "hit" | "crit" | "miss" | "heal" | "levelup" | "loot" | "victory" | "defeat" | "ui";

export function sfx(name: Sfx): void {
  if (!sfxOn || !ensure()) return;
  switch (name) {
    case "dice": noise(0.18, 0.25, 1200); break;
    case "diceland": tone({ freq: 320, dur: 0.12, type: "triangle", gain: 0.4 }); noise(0.06, 0.15, 2000); break;
    case "hit": tone({ freq: 180, dur: 0.14, type: "square", gain: 0.35, slideTo: 90 }); break;
    case "crit": tone({ freq: 240, dur: 0.18, type: "sawtooth", gain: 0.4, slideTo: 120 }); tone({ freq: 480, dur: 0.2, type: "square", gain: 0.25, delay: 0.02 }); break;
    case "miss": noise(0.1, 0.12, 1500); break;
    case "heal": tone({ freq: 440, dur: 0.25, type: "sine", gain: 0.3, slideTo: 660 }); break;
    case "levelup": [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.3, type: "triangle", gain: 0.32, delay: i * 0.09 })); break;
    case "loot": tone({ freq: 880, dur: 0.16, type: "triangle", gain: 0.3 }); tone({ freq: 1175, dur: 0.18, type: "triangle", gain: 0.25, delay: 0.08 }); break;
    case "victory": [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.5, type: "triangle", gain: 0.34, delay: i * 0.13 })); break;
    case "defeat": [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.45, type: "sawtooth", gain: 0.3, delay: i * 0.16 })); break;
    case "ui": tone({ freq: 600, dur: 0.05, type: "square", gain: 0.15 }); break;
  }
}

// ── Ambient music: a slow detuned pad, tinted per campaign. ──

export function startMusic(campaignId: string): void {
  if (!musicOn || !ensure() || !ctx || !master || musicNodes) return;
  const base = campaignId === "crawl" ? 110 : 98; // crawl = brighter A, fantasy = G
  const gain = ctx.createGain();
  gain.gain.value = 0.0;
  gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 3);
  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 700;
  gain.connect(filt);
  filt.connect(master);
  const freqs = campaignId === "crawl" ? [base, base * 1.5, base * 2.02] : [base, base * 1.5, base * 1.335];
  const osc = freqs.map((f, i) => {
    const o = ctx!.createOscillator();
    o.type = i === 2 ? "triangle" : "sine";
    o.frequency.value = f + (i - 1) * 0.6; // slight detune
    o.connect(gain);
    o.start();
    return o;
  });
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.06;
  lfoGain.gain.value = 120;
  lfo.connect(lfoGain);
  lfoGain.connect(filt.frequency);
  lfo.start();
  musicNodes = { osc, gain, lfo };
}

export function stopMusic(): void {
  if (!musicNodes || !ctx) return;
  const { osc, gain, lfo } = musicNodes;
  gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1);
  const stopAt = ctx.currentTime + 1.1;
  osc.forEach((o) => o.stop(stopAt));
  lfo.stop(stopAt);
  musicNodes = null;
}

export function setMusicEnabled(on: boolean, campaignId?: string): void {
  musicOn = on;
  if (!on) stopMusic();
  else if (campaignId) startMusic(campaignId);
}
