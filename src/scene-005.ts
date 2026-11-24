import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Batch, detailed, aoComposer } from './kit';
import { Decay } from './decay';
import { rustMaterial } from './rust';
import { buildStatue, chain } from './statue';
import './style.css';

// Scene 005: THE DRY HARBOUR.
// You stand on an old tiled footbridge over a drained canal. Grounded ships rust in the mud between
// rows of 1990s tiled apartment blocks with air-conditioners and faded signs. Above the basin floats
// a colossal stone bust with its eyes closed. A stair tower climbs from a wreck toward it and stops
// in mid-air; a train crosses a far viaduct; a dead Ferris wheel turns in the fog.
// References: the drained, ship-strewn lake in Divergent; Monument Valley's impossible stairs; the
// colossal-statue cityscapes of the Bilibili artist 独鸟木lx. Everything here is an original design.

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root was not found.');
app.innerHTML = `
  <div id="scene" aria-label="Drained canal beneath a floating stone bust"></div>
  <header><div class="eyebrow">CONCRETE WORLD / 005</div><h1>THE DRY HARBOUR</h1></header>
  <aside aria-label="Scene controls">
    <button id="prev" type="button">SCENE 004</button>
    <button id="first" type="button">SCENE 001</button>
    <button id="hide" type="button">HIDE UI</button>
  </aside>
  <button id="show" type="button" hidden>SHOW UI</button>`;

// ---------------------------------------------------------------- renderer: overcast grey-green
const SKY = new THREE.Color(0x9da79f);
const scene = new THREE.Scene();
scene.background = SKY;
scene.fog = new THREE.FogExp2(SKY, 0.0021);
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.3, 3500);
camera.position.set(0, 13.7, 40);
camera.rotation.order = 'YXZ';
let yaw = 0, pitch = 0.42;
camera.rotation.set(pitch, yaw, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.querySelector('#scene')!.appendChild(renderer.domElement);
const envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// ---------------------------------------------------------------- textures
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// One 4 m x 4 m facade bay: small wall tiles, an aluminium window with blue or dark glass, an
// air-conditioner box and the rust/damp it leaves, a darker floor slab line.
function facadeTex(tile: string, joint: string, glassA: string, glassB: string, ac: boolean, bars: boolean) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = tile; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = joint; g.lineWidth = 1;
    for (let i = 0; i <= 256; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '60,60,55'},${0.05 + rnd() * 0.08})`; g.fillRect(Math.floor(rnd() * 32) * 8, Math.floor(rnd() * 32) * 8, 8, 8); }
    g.fillStyle = 'rgba(70,72,68,0.55)'; g.fillRect(0, 0, 256, 14);                                   // floor slab
    const gl = g.createLinearGradient(0, 70, 0, 190); gl.addColorStop(0, glassA); gl.addColorStop(1, glassB);
    g.fillStyle = '#b9bcbc'; g.fillRect(36, 62, 184, 132);                                           // frame
    g.fillStyle = gl; g.fillRect(42, 68, 172, 120);
    g.fillStyle = '#b9bcbc'; g.fillRect(126, 68, 4, 120); g.fillRect(42, 104, 172, 4);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(50, 186); g.lineTo(110, 70); g.lineTo(130, 70); g.lineTo(70, 186); g.fill();
    if (bars) { g.fillStyle = 'rgba(60,58,52,0.85)'; for (let x = 44; x < 214; x += 12) g.fillRect(x, 120, 3, 70); g.fillRect(38, 120, 180, 4); g.fillRect(38, 186, 180, 4); }
    if (ac) {
      g.fillStyle = '#c9cac4'; g.fillRect(150, 198, 70, 42); g.strokeStyle = '#8a8b86'; g.lineWidth = 2; g.strokeRect(150, 198, 70, 42);
      g.beginPath(); g.arc(197, 219, 15, 0, Math.PI * 2); g.stroke();
      for (let k = 0; k < 5; k++) { g.fillStyle = '#9a9b96'; g.fillRect(156, 204 + k * 7, 26, 2); }
      const dr = g.createLinearGradient(0, 240, 0, 256); dr.addColorStop(0, 'rgba(90,60,40,0.55)'); dr.addColorStop(1, 'rgba(90,60,40,0.1)');
      g.fillStyle = dr; g.fillRect(180, 240, 10, 16);
    }
    for (let i = 0; i < 8; i++) { const x = rnd() * 256, l = 40 + rnd() * 200; const gr = g.createLinearGradient(0, 190, 0, 190 + l);
      gr.addColorStop(0, 'rgba(50,48,40,0.35)'); gr.addColorStop(1, 'rgba(50,48,40,0)'); g.fillStyle = gr; g.fillRect(x, 190, 2 + rnd() * 4, l); }
  });
}
// Prefab concrete panels with small square windows.
function panelTex(tone: string) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = tone; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(40,40,38,0.6)'; g.lineWidth = 3; g.strokeRect(1, 1, 254, 254); g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.stroke();
    for (const x of [28, 156]) { g.fillStyle = '#8c8f8c'; g.fillRect(x, 70, 72, 92); g.fillStyle = rnd() < 0.3 ? '#3a3022' : '#222a2e'; g.fillRect(x + 5, 75, 62, 82); }
    for (let i = 0; i < 10; i++) { const x = rnd() * 256, l = 60 + rnd() * 190, gr = g.createLinearGradient(0, 165, 0, 165 + l);
      gr.addColorStop(0, 'rgba(40,38,32,0.4)'); gr.addColorStop(1, 'rgba(40,38,32,0)'); g.fillStyle = gr; g.fillRect(x, 165, 2 + rnd() * 5, l); }
  });
}
// Ground-floor shops: rolling shutters (some open onto dark interiors) under a painted sign band.
function shopTex() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#5d5f5b'; g.fillRect(0, 0, 256, 256);
    const cols = ['#9c2a22', '#2b4f86', '#d8c27a', '#2f6b52', '#e8e4da', '#7a2f5c'];
    g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.fillRect(0, 20, 256, 50);
    g.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 4; i++) g.fillRect(30 + i * 52, 34, 30, 22);
    if (rnd() < 0.6) { g.fillStyle = '#8d908b'; g.fillRect(12, 80, 232, 176); g.fillStyle = 'rgba(40,40,38,0.35)'; for (let y = 84; y < 256; y += 6) g.fillRect(12, y, 232, 2); }
    else { g.fillStyle = '#1b1d1c'; g.fillRect(12, 80, 232, 176); g.fillStyle = 'rgba(255,214,150,0.25)'; g.fillRect(40, 120, 70, 50); }
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(30,30,28,${0.2 + rnd() * 0.3})`; g.fillRect(rnd() * 256, 70, 2 + rnd() * 5, 80 + rnd() * 100); }
  });
}
// A 1990s blue curtain wall: reflective panes in a grid of light mullions.
function curtainTex() {
  return canvasTex(256, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#3d6f8e'); gr.addColorStop(0.5, '#29516b'); gr.addColorStop(1, '#33627f');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#a9b3b6'; g.fillRect(0, 0, 256, 10); g.fillRect(0, 0, 8, 256); g.fillRect(124, 0, 6, 256);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(20, 250); g.lineTo(110, 20); g.lineTo(140, 20); g.lineTo(50, 250); g.fill();
    if (rnd() < 0.5) { g.fillStyle = 'rgba(20,25,28,0.6)'; g.fillRect(132, 14, 124, 236); }                 // a dead, darker pane
  });
}
function clockTex() {
  return canvasTex(512, 512, (g) => {
    g.fillStyle = '#e4e2da'; g.beginPath(); g.arc(256, 256, 250, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#26282a'; g.lineWidth = 14; g.stroke();
    g.translate(256, 256);
    for (let i = 0; i < 12; i++) { g.save(); g.rotate(i * Math.PI / 6); g.fillStyle = '#26282a'; g.fillRect(-7, -232, 14, i % 3 ? 34 : 56); g.restore(); }
    const hand = (a: number, l: number, w: number) => { g.save(); g.rotate(a); g.fillStyle = '#1d1f21'; g.fillRect(-w / 2, -l, w, l + 20); g.restore(); };
    hand((3 + 40 / 60) / 12 * Math.PI * 2, 130, 16); hand(40 / 60 * Math.PI * 2, 200, 10);           // stopped at 3:40
    g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.fill();
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < 18; i++) { const x = 80 + rnd() * 350, l = 60 + rnd() * 200, gr = g.createLinearGradient(0, 260, 0, 260 + l);
      gr.addColorStop(0, 'rgba(90,70,50,0.35)'); gr.addColorStop(1, 'rgba(90,70,50,0)'); g.fillStyle = gr; g.fillRect(x, 260, 3, l); }
  }, false);
}
const SIGN_WORDS = ['旅社', '五金交电', '理发', '照相馆', '粮油', '钟表修理', '招待所', '百货', '茶室', '书报', '录像厅', '浴池', '缝纫', '修车'];
const SIGN_STYLES = [['#a3271f', '#f3eee2'], ['#f1ede3', '#b3261d'], ['#244e86', '#f1ede3'], ['#e9d9a6', '#7b231b'], ['#2f5f4b', '#f1ede3']];
function signTex(word: string, style: string[]) {
  return canvasTex(128, 128 * word.length + 48, (g) => {
    const h = 128 * word.length + 48;
    g.fillStyle = style[0]; g.fillRect(0, 0, 128, h);
    g.strokeStyle = style[1]; g.lineWidth = 5; g.strokeRect(8, 8, 112, h - 16);
    g.fillStyle = style[1]; g.font = 'bold 92px "PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    [...word].forEach((ch, i) => g.fillText(ch, 64, 24 + 64 + i * 128));
    g.fillStyle = 'rgba(30,25,20,0.35)'; for (let i = 0; i < 20; i++) g.fillRect(rnd() * 128, rnd() * h, 2 + rnd() * 3, 20 + rnd() * 80);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, 128, h * 0.25);                        // sun-faded top
  }, false);
}

// ---------------------------------------------------------------- materials
const concrete = detailed(new THREE.MeshStandardMaterial({ color: 0x7f837d, roughness: 0.95 }), { joints: 0.4, streaks: 1.2, weather: 1.2 });
const quayTile = new THREE.MeshStandardMaterial({ map: facadeTex('#7b8a92', 'rgba(40,50,55,0.45)', '#3b4a52', '#2b363c', false, false), roughness: 0.8 });
const mud = new THREE.MeshStandardMaterial({ color: 0x4a4a40, roughness: 1 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x6f716c, roughness: 1 });
const facadeMats = [
  facadeTex('#e3e2db', 'rgba(120,120,110,0.35)', '#3f6f8f', '#1f3b52', true, false),
  facadeTex('#d9d2c2', 'rgba(120,110,95,0.35)', '#2d3a3f', '#161c1f', true, true),
  facadeTex('#cfd3d0', 'rgba(100,110,110,0.35)', '#4b86a6', '#244d66', false, false),
  facadeTex('#d8c9c2', 'rgba(130,105,95,0.35)', '#36444a', '#1a2226', true, true),
  facadeTex('#a9c4b8', 'rgba(70,95,85,0.4)', '#2c4a4f', '#18282b', true, false),             // mint mosaic
  facadeTex('#8f5a4c', 'rgba(60,35,30,0.45)', '#2a3438', '#151b1e', false, true),            // red-brown tile
  facadeTex('#d6c48e', 'rgba(120,100,60,0.4)', '#41606e', '#22343c', true, false),           // yellow tile
  panelTex('#a3a49d'), panelTex('#8e928e'),
].map((map, i) => detailed(new THREE.MeshStandardMaterial({ map, color: [0xb4b8b1, 0xaeb0a6, 0xb0b5b2, 0xb2aca6, 0xb4b8b4, 0xb8b4b0, 0xb6b4ac, 0xb8b8b4, 0xb8b8b4][i], roughness: 0.75, envMap, envMapIntensity: 0.2 }), { joints: 0, streaks: 1.6, weather: 1.4 }));
const shopMats = [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ map: shopTex(), roughness: 0.8 }));
const curtain = new THREE.MeshStandardMaterial({ map: curtainTex(), roughness: 0.2, metalness: 0.55, envMap, envMapIntensity: 0.7 });
const laundryMats = [0xd9d2c4, 0x8a3b33, 0x3d5c8a, 0xc9b46a, 0x6e8a6a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, side: THREE.DoubleSide }));
const blueGlass = new THREE.MeshStandardMaterial({ color: 0x24506e, roughness: 0.15, metalness: 0.6, envMap, envMapIntensity: 0.8 });
const hullRust = rustMaterial({ amount: 0.95, seed: 41, envMap, repeat: 3, tint: 0x9a7c6a });
const paintRust = rustMaterial({ amount: 0.45, seed: 43, envMap, repeat: 2, tint: 0xd8d3c8 });
const steelRust = rustMaterial({ amount: 0.75, seed: 45, envMap, repeat: 2, tint: 0x9c8e84 });
const darkSteel = new THREE.MeshStandardMaterial({ color: 0x3b3f40, metalness: 0.7, roughness: 0.6, envMap, envMapIntensity: 0.4 });

const b = new Batch();          // concrete, steel, etc. (9 m texture tiles)
const fb = new Batch(4);        // facades: one texture repeat per 4 m bay

// ---------------------------------------------------------------- the drained canal and its quays
const Z0 = 200, Z1 = -1100, ZL = Z0 - Z1, ZC = (Z0 + Z1) / 2;
const CW = 15;                                                                           // half-width of the canal
b.box(0, -0.5, ZC, 34, 1, ZL, mud);                                                      // canal bed
for (const s of [-1, 1]) {
  fb.box(s * (CW + 0.5), 5, ZC, 1, 10, ZL, quayTile);                                    // tiled embankment wall
  b.box(s * (CW + 8.5), 5, ZC, 16, 10, ZL, concrete);                                    // quay
  b.box(s * (CW + 0.9), 10.4, ZC, 0.5, 0.8, ZL, concrete);                              // kerb
  b.rail(new THREE.Vector3(s * (CW + 1.3), 10.8, Z0), new THREE.Vector3(s * (CW + 1.3), 10.8, Z1), steelRust, 1.1, 3.2);
  b.box(s * 300, 4.5, ZC, 520, 9, ZL, concrete);                                         // ground beyond the blocks
}
// a rusted lock gate closing the canal behind the observer
b.box(0, 9, 150, CW * 2 + 2, 18, 3, hullRust);
for (let x = -CW + 3; x <= CW - 3; x += 6) b.box(x, 9, 148.2, 0.8, 18, 0.8, steelRust);

// ---------------------------------------------------------------- the footbridge you stand on
b.box(0, 11.6, 40, 66, 0.8, 7, concrete);
b.box(0, 10.6, 40, CW * 2, 1.2, 4, concrete);                                           // spine beam
for (const z of [36.7, 43.3]) b.rail(new THREE.Vector3(-32, 12, z), new THREE.Vector3(32, 12, z), steelRust, 1.15, 1.6);
for (const x of [-20, 20]) for (const z of [36.4, 43.6]) {                               // dead lamp posts
  b.box(x, 15.5, z, 0.25, 7, 0.25, darkSteel);
  b.box(x, 19, z + (z > 40 ? -0.7 : 0.7), 0.3, 0.3, 1.6, darkSteel);
}

// ---------------------------------------------------------------- the blocks
// Each block is built from a small grammar so neighbours differ: a shop podium, one of several body
// types (tiled slab, open-corridor block, stepped tower, curtain-wall tower, a Kowloon-like cluster of
// add-ons), then rooftop accretions. Heights are doubled from the first version: a canyon.
const FRONT = 32;                                                                         // facade line
interface Bld { front: number; z: number; d: number; h: number; s: number; glass: boolean }
const blds: Bld[] = [];
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
function rooftop(x: number, y: number, z: number, w: number, d: number, s: number) {
  const n = 2 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const px = x + (rnd() - 0.5) * w * 0.7, pz = z + (rnd() - 0.5) * d * 0.7, r = rnd();
    if (r < 0.3) b.cylinder(px, y, pz, 1.2 + rnd(), 2.5 + rnd() * 2, darkSteel, 14);                              // water tank
    else if (r < 0.55) { const sw = 4 + rnd() * 6, sd = 3 + rnd() * 5, sh = 3 + rnd() * 2;                          // rooftop shack
      fb.box(px, y + sh / 2, pz, sw, sh, sd, pick(facadeMats)); b.box(px, y + sh + 0.15, pz, sw + 0.8, 0.3, sd + 0.8, steelRust); }
    else if (r < 0.75) b.box(px, y + 5, pz, 0.15, 10 + rnd() * 10, 0.15, darkSteel);                               // antenna
    else if (r < 0.88) {                                                                                           // billboard frame
      b.box(px - s * 1, y + 7, pz, 0.4, 9, Math.min(d * 0.8, 14), steelRust);
      for (const k of [-1, 1]) b.box(px, y + 3, pz + k * 4, 0.3, 6, 0.3, steelRust);
    } else { const dish = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 8, 0, Math.PI * 2, 0, 1.1), darkSteel);  // satellite dish
      dish.position.set(px, y + 2, pz); dish.rotation.set(-0.8, s > 0 ? -1.2 : 1.2, 0); scene.add(dish); }
  }
}
function block(s: number, zTop: number, len: number) {
  const zc = zTop - len / 2, far = Math.max(0, -zTop) / 1000;
  const d = 16 + rnd() * 14, set = rnd() < 0.2 ? 2 + rnd() * 4 : 0;
  const front = s * (FRONT + set);
  const H = 2 * ((zTop > -80 ? 18 + rnd() * 30 : 24 + rnd() * 60) + far * (30 + rnd() * 120));
  let y = 10;
  // shop podium: two floors of shutters and sign bands
  if (rnd() < 0.75) { fb.box(front + s * d / 2, y + 4, zc, d, 8, len, pick(shopMats)); b.box(front + s * 0.6, y + 8.3, zc, 1.4, 0.4, len, concrete); y += 8; }
  const kind = rnd();
  const mat = pick(facadeMats);
  if (kind < 0.3) {                                                         // tiled slab, sometimes with a setback crown
    const h1 = H * (0.75 + rnd() * 0.2);
    fb.box(front + s * d / 2, y + h1 / 2, zc, d, h1, len, mat);
    y += h1;
    if (rnd() < 0.5) { const h2 = H - h1 + 6; fb.box(front + s * (d / 2 + 3), y + h2 / 2, zc, d - 6, h2, len - 6, pick(facadeMats)); y += h2; }
    b.box(front + s * d / 2, y + 0.3, zc, d + 0.6, 0.6, len + 0.6, roofMat);
    rooftop(front + s * d / 2, y + 0.6, zc, d, len, s);
  } else if (kind < 0.5) {                                                  // open-corridor block: balconies, rails, laundry
    fb.box(front + s * (d / 2 + 1.6), y + H / 2, zc, d, H, len, mat);
    for (let fy = y + 3.6; fy < y + H - 1; fy += 3.6) {
      b.box(front + s * 0.8, fy, zc, 1.8, 0.25, len, concrete);
      b.box(front + s * 0.05, fy + 0.55, zc, 0.12, 1.1, len, concrete);
      if (zTop > -400 && rnd() < 0.5) for (let k = 0; k < 3; k++) {
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.8 + rnd(), 1 + rnd()), pick(laundryMats));
        cloth.position.set(front + s * 0.3, fy - 0.8, zc + (rnd() - 0.5) * len * 0.9); cloth.rotation.y = Math.PI / 2; scene.add(cloth);
      }
    }
    y += H; b.box(front + s * (d / 2 + 1.6), y + 0.3, zc, d + 0.6, 0.6, len + 0.6, roofMat);
    rooftop(front + s * (d / 2 + 1.6), y + 0.6, zc, d, len, s);
  } else if (kind < 0.68) {                                                 // stepped tower: each segment smaller than the last
    let w = d, l = len, hx = front + s * d / 2;
    const segs = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < segs; i++) {
      const sh = (H / segs) * (0.8 + rnd() * 0.4);
      fb.box(hx, y + sh / 2, zc, w, sh, l, i === 0 ? mat : pick(facadeMats));
      y += sh; b.box(hx, y + 0.3, zc, w + 0.6, 0.6, l + 0.6, roofMat);
      w *= 0.72 + rnd() * 0.15; l *= 0.72 + rnd() * 0.15; hx += s * rnd() * 2;
    }
    rooftop(hx, y + 0.6, zc, w, l, s);
  } else if (kind < 0.82) {                                                 // curtain-wall tower with a concrete frame and a crown
    const hh = H * 1.25;
    b.box(front + s * d / 2, y + hh / 2, zc, d - 1, hh, len - 1, curtain);
    for (const k of [-1, 1]) b.box(front + s * d / 2, y + hh / 2, zc + k * (len / 2 - 0.6), d, hh, 1.2, concrete);
    for (let fy = y; fy < y + hh; fy += 16) b.box(front + s * d / 2, fy, zc, d + 0.3, 1.2, len + 0.3, concrete);
    y += hh;
    const crown = rnd();
    if (crown < 0.4) { const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.min(d, len) * 0.55, 18, 4), concrete); cone.position.set(front + s * d / 2, y + 9, zc); cone.rotation.y = Math.PI / 4; scene.add(cone); }
    else if (crown < 0.7) { b.cylinder(front + s * d / 2, y, zc, 5, 6, concrete, 24); b.box(front + s * d / 2, y + 22, zc, 0.6, 32, 0.6, darkSteel); }
    else { const ball = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), curtain); ball.position.set(front + s * d / 2, y + 9, zc); scene.add(ball); b.cylinder(front + s * d / 2, y, zc, 2, 3, concrete, 12); }
  } else {                                                                  // Kowloon-like: a slab encrusted with add-ons and cages
    fb.box(front + s * d / 2, y + H / 2, zc, d, H, len, mat);
    for (let i = 0; i < 6 + Math.floor(rnd() * 8); i++) {
      const bw = 2 + rnd() * 3, bh = 3 + rnd() * 5, bl = 3 + rnd() * 6;
      const by = y + rnd() * (H - bh), bz = zc + (rnd() - 0.5) * (len - bl);
      if (rnd() < 0.5) fb.box(front - s * bw / 2, by + bh / 2, bz, bw, bh, bl, pick(facadeMats));
      else { b.box(front - s * bw / 2, by + bh / 2, bz, bw, bh, 0.1, steelRust); b.box(front - s * bw, by + bh / 2, bz, 0.1, bh, bl, steelRust);   // iron cage balcony
        for (let k = 0; k <= 6; k++) b.box(front - s * bw, by + bh / 2, bz - bl / 2 + (k * bl) / 6, 0.08, bh, 0.08, steelRust); b.box(front - s * bw / 2, by, bz, bw, 0.2, bl, concrete); }
    }
    y += H; b.box(front + s * d / 2, y + 0.3, zc, d + 0.6, 0.6, len + 0.6, roofMat);
    for (let i = 0; i < 3; i++) { const sw = 4 + rnd() * 5, sh = 3 + rnd() * 4; fb.box(front + s * (d * rnd()), y + sh / 2, zc + (rnd() - 0.5) * len * 0.6, sw, sh, 4 + rnd() * 5, pick(facadeMats)); }
    rooftop(front + s * d / 2, y + 0.6, zc, d, len, s);
  }
  blds.push({ front, z: zc, d: len, h: y - 10, s, glass: kind >= 0.68 && kind < 0.82 });
}
for (const s of [-1, 1]) {
  let z = 120;
  while (z > -1050) { const len = 14 + rnd() * 24; block(s, z, len); z -= len + (rnd() < 0.3 ? 3 + rnd() * 5 : 0.4); }
  for (let i = 0; i < 6; i++) {                                                          // distant high-rises closing the vista
    const hz = -800 - rnd() * 300, hh = 240 + rnd() * 260, hw = 30 + rnd() * 30;
    b.box(s * (60 + rnd() * 150), 10 + hh / 2, hz, hw, hh, hw, i % 2 ? curtain : concrete);
  }
}
// footbridges, pipes and cables strung across the canal between the two walls of blocks
for (let i = 0; i < 9; i++) {
  const z = -60 - rnd() * 520, y = 30 + rnd() * 120, r = rnd();
  if (r < 0.45) {
    b.box(0, y, z, FRONT * 2, 1.2, 3.4, concrete);
    b.rail(new THREE.Vector3(-FRONT, y + 0.6, z - 1.6), new THREE.Vector3(FRONT, y + 0.6, z - 1.6), steelRust, 1.1, 2);
    b.rail(new THREE.Vector3(-FRONT, y + 0.6, z + 1.6), new THREE.Vector3(FRONT, y + 0.6, z + 1.6), steelRust, 1.1, 2);
    if (rnd() < 0.5) { b.box(0, y + 2.2, z, FRONT * 2, 0.3, 3.6, steelRust); }
  } else if (r < 0.8) {
    for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6 + rnd() * 0.6, 0.6, FRONT * 2, 12), steelRust); p.rotation.z = Math.PI / 2; p.position.set(0, y + k * 1.8, z + (rnd() - 0.5) * 2); p.castShadow = true; scene.add(p); }
  } else {
    for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, FRONT * 2.02, 4), darkSteel); c.rotation.z = Math.PI / 2 + (rnd() - 0.5) * 0.06; c.position.set(0, y - k * 0.8 - 1.5, z + k * 0.6); scene.add(c); }
  }
}
// air-conditioner boxes and vertical signs on the nearer blocks
const acUnits: THREE.Matrix4[] = [];
const signs: { mesh: THREE.Mesh }[] = [];
let signIdx = 0;
for (const bl of blds) {
  if (bl.z < -420) continue;
  const front = bl.front;
  if (!bl.glass) for (let y = 21; y < Math.min(10 + bl.h - 2, 160); y += 4) for (let zz = bl.z - bl.d / 2 + 2; zz < bl.z + bl.d / 2 - 1; zz += 4) {
    if (rnd() < 0.32) acUnits.push(new THREE.Matrix4().makeTranslation(front - bl.s * 0.35, y + (rnd() - 0.5) * 0.6, zz + (rnd() - 0.5)));
  }
  if (bl.z > -260 && rnd() < 0.7) {
    const word = SIGN_WORDS[signIdx++ % SIGN_WORDS.length], style = SIGN_STYLES[Math.floor(rnd() * SIGN_STYLES.length)];
    const sh = 2.6 * word.length + 1;
    const mat = new THREE.MeshStandardMaterial({ map: signTex(word, style), roughness: 0.7 });
    const side = new THREE.MeshStandardMaterial({ color: 0x55534e, roughness: 0.8 });
    // a blade sign sticking out from the facade, readable from up and down the canal
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, sh, 2.6), [mat, mat, side, side, side, side]);
    m.position.set(front - bl.s * 1.7, 20 + rnd() * Math.max(2, Math.min(bl.h, 70) - sh - 10) + sh / 2, bl.z + (rnd() - 0.5) * bl.d * 0.6);
    m.castShadow = true; scene.add(m); signs.push({ mesh: m });
    b.box(front - bl.s * 0.8, m.position.y + sh / 2 - 0.3, m.position.z, 1.6, 0.15, 0.15, darkSteel);
    b.box(front - bl.s * 0.8, m.position.y - sh / 2 + 0.3, m.position.z, 1.6, 0.15, 0.15, darkSteel);
  }
}
{
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.65, 0.9), new THREE.MeshStandardMaterial({ color: 0xc4c5bf, roughness: 0.7 }), acUnits.length);
  acUnits.forEach((m, i) => inst.setMatrixAt(i, m)); inst.castShadow = true; scene.add(inst);
}
// barber poles by the quay doors near the bridge
const poleTexs: THREE.CanvasTexture[] = [];
for (const [x, z] of [[-31.4, 22], [31.4, 8], [-31.4, -18], [31.4, -46]]) {
  const t = canvasTex(64, 256, (g) => {
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, 64, 256);
    for (let i = -4; i < 12; i++) { g.fillStyle = i % 2 ? '#c2271e' : '#2b4f9a'; g.beginPath(); g.moveTo(0, i * 32); g.lineTo(64, i * 32 - 40); g.lineTo(64, i * 32 - 26); g.lineTo(0, i * 32 + 14); g.fill(); }
  });
  poleTexs.push(t);
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 20), new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, emissive: 0x222222 }));
  p.position.set(x, 13.2, z); scene.add(p);
  b.box(x, 13.2, z, 0.5, 1.8, 0.5, darkSteel);
}

// ---------------------------------------------------------------- the clock tower
{
  const cx = 30, cz = -108;
  b.cylinder(cx, 10, cz, 8, 118, concrete, 40);
  b.cylinder(cx, 96, cz, 8.15, 8, blueGlass, 40);
  b.cylinder(cx, 128, cz, 7, 12, concrete, 40);
  b.cylinder(cx, 140, cz, 7.6, 1, roofMat, 40);
  b.cylinder(cx, 141, cz, 1.2, 9, darkSteel, 12);
  const face = new THREE.MeshStandardMaterial({ map: clockTex(), roughness: 0.6 });
  for (const [ox, oz, ry] of [[-7.05, 0, -Math.PI / 2], [0, 7.05, 0]] as const) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(5, 48), face); m.position.set(cx + ox, 134, cz + oz); m.rotation.y = ry; scene.add(m);
  }
}

// ---------------------------------------------------------------- grounded ships
function ship(len: number, beam: number, depth: number) {
  const g = new THREE.Group();
  const hull = new THREE.BoxGeometry(beam, depth, len, 6, 6, 40);
  const p = hull.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i); const z = p.getZ(i);
    const zn = z / len + 0.5, yn = y / depth + 0.5;
    const bow = zn > 0.7 ? 1 - ((zn - 0.7) / 0.3) ** 1.6 * 0.94 : 1;
    const stern = zn < 0.06 ? 0.82 + 0.18 * (zn / 0.06) : 1;
    x *= bow * stern * (0.35 + 0.65 * Math.sqrt(Math.max(0, yn)));
    y += zn > 0.75 ? (zn - 0.75) * depth * 0.7 * yn : 0;
    p.setXYZ(i, x, y, z);
  }
  hull.computeVertexNormals();
  const hm = new THREE.Mesh(hull, hullRust); hm.castShadow = hm.receiveShadow = true; g.add(hm);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(beam * 0.92, 0.4, len * 0.8), darkSteel, 0, depth / 2, -len * 0.04);
  add(new THREE.BoxGeometry(beam * 0.72, 6, len * 0.14), paintRust, 0, depth / 2 + 3, -len * 0.36);
  add(new THREE.BoxGeometry(beam * 0.5, 3.4, len * 0.1), paintRust, 0, depth / 2 + 7.7, -len * 0.38);
  add(new THREE.BoxGeometry(beam * 0.51, 1, len * 0.101), new THREE.MeshStandardMaterial({ color: 0x14181a, roughness: 0.3 }), 0, depth / 2 + 8, -len * 0.38);
  add(new THREE.CylinderGeometry(1.3, 1.6, 7, 16), hullRust, 0, depth / 2 + 8, -len * 0.44);
  add(new THREE.CylinderGeometry(0.25, 0.3, 16, 8), steelRust, 0, depth / 2 + 8, len * 0.3);
  add(new THREE.BoxGeometry(beam * 0.6, 0.25, 0.25), steelRust, 0, depth / 2 + 12, len * 0.3);
  return g;
}
const ships: [number, number, number, number, number, number, number, number][] = [
  // len, beam, depth, x, z, yaw, list, sink
  [58, 10, 9, 3, -40, 0.12, 0.14, 2.6],
  [104, 12, 12, -2, -170, -0.05, -0.1, 3.4],
  [44, 9, 8, 4, -305, 0.3, 0.24, 2.2],
  [82, 11, 11, -3, -520, 0.12, 0.34, 4.5],
];
for (const [l, bm, dp, x, z, yw, list, sink] of ships) {
  const s = ship(l, bm, dp); s.position.set(x, dp / 2 - sink, z); s.rotation.set(0, yw, list); scene.add(s);
}

// ---------------------------------------------------------------- the stair tower that stops in mid-air
{
  const cx = -23, cz = -150, y0 = 10, R = 3.2, STEP = 3.2;
  const top = 250;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.box(cx + sx * R, (y0 + top) / 2, cz + sz * R, 0.45, top - y0, 0.45, steelRust);
  const corner = (k: number) => { const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]][k % 4]; return new THREE.Vector3(cx + c[0] * (R - 0.9), 0, cz + c[1] * (R - 0.9)); };
  let y = y0, k = 0;
  while (y < top - STEP * 2) {
    const a = corner(k).setY(y), c = corner(k + 1).setY(y + STEP);
    b.slab(a, c, 1.3, 0.25, steelRust);
    b.box(c.x, c.y - 0.12, c.z, 1.6, 0.2, 1.6, steelRust);
    if (k % 2 === 0) {                                                                    // X bracing on one face
      const f = k % 4;
      const p0 = corner(f).setY(y), p1 = corner(f + 1).setY(y + STEP * 2);
      b.slab(new THREE.Vector3(p0.x * 1 + (p0.x - cx) * 0.25, p0.y, p0.z + (p0.z - cz) * 0.25), new THREE.Vector3(p1.x + (p1.x - cx) * 0.25, p1.y, p1.z + (p1.z - cz) * 0.25), 0.18, 0.18, steelRust);
    }
    y += STEP; k++;
  }
  // the last flight hangs broken off its landing
  const a = corner(k).setY(y);
  b.slab(a, a.clone().add(new THREE.Vector3(1.5, -5.5, 2.6)), 1.3, 0.25, steelRust);
}

// ---------------------------------------------------------------- mud, black water, dry grass
const decay = new Decay(scene, { envMap });
for (let z = 30, i = 0; z > -900; z -= 16 + rnd() * 10, i++) {
  const x = 4 * Math.sin(z / 70) + (rnd() - 0.5) * 2;
  decay.puddle(x, 0, z, 1.6 + rnd() * 1.5, 8 + rnd() * 6, 300 + i, 'sewage', 0.1 * Math.cos(z / 70));
}
for (let i = 0; i < 70; i++) {
  const z = 40 - rnd() * 700, x = (rnd() < 0.5 ? -1 : 1) * (6 + rnd() * 8);
  decay.weeds(x, 0, z, 2 + rnd() * 2, 500 + i, 50, 1.8);
}
for (let i = 0; i < 30; i++) decay.weeds((rnd() < 0.5 ? -1 : 1) * (17 + rnd() * 13), 10, 30 - rnd() * 500, 1.2, 700 + i, 25, 1.2);
decay.flush();

// ---------------------------------------------------------------- far viaduct and its train
const VZ = -470, VY = 44;
b.box(0, VY, VZ, 1600, 2.6, 9, concrete);
for (let x = -760; x <= 760; x += 44) b.box(x, VY / 2, VZ, 3.2, VY, 5, concrete);
b.rail(new THREE.Vector3(-800, VY + 1.3, VZ - 4.2), new THREE.Vector3(800, VY + 1.3, VZ - 4.2), darkSteel, 1.1, 4);
b.rail(new THREE.Vector3(-800, VY + 1.3, VZ + 4.2), new THREE.Vector3(800, VY + 1.3, VZ + 4.2), darkSteel, 1.1, 4);
const train = new THREE.Group(); scene.add(train);
{
  const cream = new THREE.MeshStandardMaterial({ color: 0xd8d0b4, roughness: 0.7 });
  const green = new THREE.MeshStandardMaterial({ color: 0x3e6a55, roughness: 0.7 });
  const win = new THREE.MeshStandardMaterial({ color: 0x1c1a14, emissive: 0xffd9a0, emissiveIntensity: 0.9 });
  for (let i = 0; i < 5; i++) {
    const x = i * 19.5;
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, z = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; train.add(me); };
    add(new THREE.BoxGeometry(18.6, 1.7, 3.2), green, 0.85);
    add(new THREE.BoxGeometry(18.6, 2, 3.2), cream, 2.7);
    add(new THREE.BoxGeometry(18.6, 0.5, 3.0), roofMat, 3.95);
    for (const z of [-1.62, 1.62]) add(new THREE.BoxGeometry(16, 0.9, 0.05), win, 2.6, z);
  }
  train.position.set(-900, VY + 1.3, VZ);
}
function updateTrain(t: number) {
  const period = 90, p = t % period;                    // ~60 s crossing, then a pause out of sight
  train.position.x = -900 + Math.min(1, p / 60) * 1900;
}

// ---------------------------------------------------------------- the dead Ferris wheel
const wheel = new THREE.Group(); wheel.position.set(-28, 70, -760); wheel.rotation.y = 0.35; scene.add(wheel);
{
  const W = 48;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(W, 0.6, 8, 120), darkSteel); wheel.add(rim);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(W - 3, 0.35, 6, 120), darkSteel));
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.3, W, 0.3), darkSteel); sp.position.set(Math.cos(a) * W / 2, Math.sin(a) * W / 2, 0); sp.rotation.z = a - Math.PI / 2; wheel.add(sp);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3, 2.6), paintRust); cab.position.set(Math.cos(a) * W, Math.sin(a) * W - 2, 0); cab.userData.a = a; wheel.add(cab);
  }
  for (const s of [-1, 1]) b.slab(new THREE.Vector3(-28 + s * 26, 10, -760), new THREE.Vector3(-28, 70, -760), 1.6, 1.6, darkSteel);
}

// ---------------------------------------------------------------- the floating bust
const SY = 330;                                          // hovering above the rooftops of the canyon
const statueRoot = new THREE.Group(); statueRoot.position.set(0, SY, -270); scene.add(statueRoot);
const statue = buildStatue(80, envMap);
statue.group.rotation.x = 0.1;                         // looking down into the basin
statueRoot.add(statue.group);
const chains: THREE.Group[] = [];
for (const [x, y, z, n] of [[-48, -92, 6, 40], [42, -90, 10, 36], [14, -100, 18, 14], [-20, -98, 16, 9]] as const) {
  const c = chain(new THREE.Vector3(x, y, z), n, 3.4, darkSteel); statueRoot.add(c); chains.push(c);
}
for (let i = 0; i < 6; i++) {                          // snapped cables trailing from the back
  const len = 30 + rnd() * 60;
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, len, 6), darkSteel);
  cab.position.set((rnd() - 0.5) * 100, -70 - len / 2, -28 - rnd() * 14); statueRoot.add(cab);
}

// ---------------------------------------------------------------- light
const hemi = new THREE.HemisphereLight(0xdfe6e1, 0x50554c, 2.0); scene.add(hemi);
const key = new THREE.DirectionalLight(0xeef2ec, 0.85);
key.position.set(-300, 650, 220); key.target.position.set(0, 0, -300); scene.add(key.target);
key.castShadow = true; key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6;
Object.assign(key.shadow.camera, { left: -800, right: 800, top: 800, bottom: -800, near: 50, far: 2600 });
scene.add(key);

b.flush(scene);
fb.flush(scene);
const composer = aoComposer(renderer, scene, camera, 2.5, 0.85);

// ---------------------------------------------------------------- interaction
let dragging = false, lastX = 0, lastY = 0;
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  yaw -= (e.clientX - lastX) * 0.004;
  pitch = THREE.MathUtils.clamp(pitch - (e.clientY - lastY) * 0.004, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
  lastX = e.clientX; lastY = e.clientY;
  camera.rotation.set(pitch, yaw, 0);
});
(window as unknown as { __setView: (y: number, p: number, f?: number) => void }).__setView = (y, p, f) => { yaw = y; pitch = p; camera.rotation.set(pitch, yaw, 0); if (f) { camera.fov = f; camera.updateProjectionMatrix(); } };
document.querySelector<HTMLButtonElement>('#prev')!.addEventListener('click', () => { window.location.href = './classic-004.html'; });
document.querySelector<HTMLButtonElement>('#first')!.addEventListener('click', () => { window.location.href = './classic-001.html'; });
const panel = document.querySelector<HTMLElement>('aside')!;
const show = document.querySelector<HTMLButtonElement>('#show')!;
document.querySelector<HTMLButtonElement>('#hide')!.addEventListener('click', () => { panel.hidden = true; show.hidden = false; });
show.addEventListener('click', () => { panel.hidden = false; show.hidden = true; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

// ---------------------------------------------------------------- animation
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  // the bust drifts: a slow rise and fall, a slight turn, its chains swinging a little behind
  statueRoot.position.y = SY + Math.sin(t * 0.09) * 4;
  statueRoot.rotation.y = Math.sin(t * 0.035) * 0.09;
  statueRoot.rotation.z = Math.sin(t * 0.05 + 1) * 0.015;
  chains.forEach((c, i) => { c.rotation.z = Math.sin(t * 0.3 + i) * 0.02; c.rotation.x = Math.sin(t * 0.23 + i * 2) * 0.015; });
  statue.update(t);
  wheel.rotation.z = t * 0.012;
  for (const ch of wheel.children) if (ch.userData.a !== undefined) { const a = ch.userData.a + t * 0.012; ch.rotation.z = -t * 0.012; void a; }
  poleTexs.forEach((tx) => { tx.offset.y = (t * 0.25) % 1; });
  updateTrain(t);
  composer.render();
}
animate();
