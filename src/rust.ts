import * as THREE from 'three';

// Procedural rusted steel: dark mill-scale steel eaten by orange-brown rust blooms, flaking edges,
// vertical rust runs and pitting. `amount` 0..1 is how far the rust has spread.

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const cache = new Map<string, { map: THREE.CanvasTexture; rough: THREE.CanvasTexture }>();
function rustTextures(amount: number, seed: number) {
  const key = `${amount}-${seed}`;
  if (cache.has(key)) return cache.get(key)!;
  const S = 1024, r = rng(seed);
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d')!;
  const cr = document.createElement('canvas'); cr.width = cr.height = S; const gr = cr.getContext('2d')!;
  g.fillStyle = '#3b3d3c'; g.fillRect(0, 0, S, S);
  gr.fillStyle = '#7a7a7a'; gr.fillRect(0, 0, S, S);
  // tonal variation of the bare steel
  for (let i = 0; i < 60; i++) {
    const x = r() * S, y = r() * S, s = 40 + r() * 160;
    const p = g.createRadialGradient(x, y, 0, x, y, s);
    const v = 45 + r() * 30; p.addColorStop(0, `rgba(${v},${v + 2},${v},0.35)`); p.addColorStop(1, 'rgba(60,60,60,0)');
    g.fillStyle = p; g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  const cols = [[107, 58, 30], [138, 74, 34], [74, 42, 24], [160, 88, 42], [92, 50, 28]];
  // rust blooms (drawn wrapped so the texture tiles)
  const blooms = Math.round(40 + amount * 260);
  for (let i = 0; i < blooms; i++) {
    const x = r() * S, y = r() * S, s = 8 + r() * (30 + amount * 120);
    const [R, G, B] = cols[Math.floor(r() * cols.length)];
    const a = 0.35 + r() * 0.6;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const cx = x + ox, cy = y + oy;
      if (cx < -s || cx > S + s || cy < -s || cy > S + s) continue;
      const p = g.createRadialGradient(cx, cy, 0, cx, cy, s);
      p.addColorStop(0, `rgba(${R},${G},${B},${a})`); p.addColorStop(0.6, `rgba(${R},${G},${B},${a * 0.6})`); p.addColorStop(1, `rgba(${R},${G},${B},0)`);
      g.fillStyle = p; g.fillRect(cx - s, cy - s, s * 2, s * 2);
      const q = gr.createRadialGradient(cx, cy, 0, cx, cy, s);
      q.addColorStop(0, 'rgba(240,240,240,0.8)'); q.addColorStop(1, 'rgba(240,240,240,0)');
      gr.fillStyle = q; gr.fillRect(cx - s, cy - s, s * 2, s * 2);
    }
  }
  // rust runs: long vertical streaks
  for (let i = 0; i < 40 + amount * 120; i++) {
    const x = r() * S, y = r() * S, len = 40 + r() * 400, w = 1 + r() * 5;
    const [R, G, B] = cols[Math.floor(r() * cols.length)];
    const p = g.createLinearGradient(0, y, 0, y + len);
    p.addColorStop(0, `rgba(${R},${G},${B},${0.5 + r() * 0.4})`); p.addColorStop(1, `rgba(${R},${G},${B},0)`);
    g.fillStyle = p; g.fillRect(x, y, w, len); if (y + len > S) g.fillRect(x, y - S, w, len);
  }
  // flakes and pits
  for (let i = 0; i < 2500 * (0.3 + amount); i++) {
    const x = r() * S, y = r() * S, s = 1 + r() * 3;
    g.fillStyle = r() < 0.5 ? `rgba(30,20,14,${0.3 + r() * 0.5})` : `rgba(170,95,45,${0.3 + r() * 0.4})`;
    g.fillRect(x, y, s, s);
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const rough = new THREE.CanvasTexture(cr);
  for (const t of [map, rough]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  const out = { map, rough }; cache.set(key, out); return out;
}

export function rustMaterial(o: { amount?: number; seed?: number; envMap?: THREE.Texture; tint?: number; repeat?: number } = {}) {
  const { map, rough } = rustTextures(o.amount ?? 0.6, o.seed ?? 7);
  const m = new THREE.MeshStandardMaterial({
    map, roughnessMap: rough, color: o.tint ?? 0xffffff, roughness: 1, metalness: 0.55,
    envMap: o.envMap, envMapIntensity: 0.35,
  });
  if (o.repeat && o.repeat !== 1) {
    const mm = map.clone(), rr = rough.clone();
    mm.repeat.set(o.repeat, o.repeat); rr.repeat.set(o.repeat, o.repeat); mm.needsUpdate = rr.needsUpdate = true;
    m.map = mm; m.roughnessMap = rr;
  }
  return m;
}

// A transparent decal of rust and water runs, for hanging below steel on concrete faces.
let streakTex: THREE.CanvasTexture | null = null;
export function streakMaterial() {
  if (!streakTex) {
    const W = 512, H = 1024, r = rng(99);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
    for (let i = 0; i < 70; i++) {
      const x = r() * W, w = 2 + r() * 16, len = H * (0.2 + r() * 0.8);
      const rust = r() < 0.45;
      const p = g.createLinearGradient(0, 0, 0, len);
      const col = rust ? `${110 + r() * 30},${55 + r() * 15},${22}` : `${38},${38},${33}`;
      p.addColorStop(0, `rgba(${col},${0.35 + r() * 0.45})`); p.addColorStop(0.7, `rgba(${col},${0.15 + r() * 0.2})`); p.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = p; g.fillRect(x, 0, w, len);
    }
    streakTex = new THREE.CanvasTexture(c); streakTex.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.MeshStandardMaterial({ map: streakTex, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
}
