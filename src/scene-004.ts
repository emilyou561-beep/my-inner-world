import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Batch, detailed, tex, aoComposer, v3 } from './kit';
import { Decay } from './decay';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root was not found.');
app.innerHTML = `
  <div id="scene" aria-label="Curved brutalist exterior"></div>
  <header><div class="eyebrow">CONCRETE WORLD / 004</div><h1>THE CRESCENT</h1></header>
  <aside aria-label="Scene controls">
    <div class="panel-title">ATMOSPHERE</div>
    <label for="fog">FOG <output id="fog-value">0.0045</output><input id="fog" type="range" min="0.001" max="0.015" step="0.0002" value="0.0045"></label>
    <label for="light">LIGHT <output id="light-value">1.0</output><input id="light" type="range" min="0.3" max="2" step="0.1" value="1.0"></label>
    <button id="prev" type="button">SCENE 003</button>
    <button id="first" type="button">SCENE 001</button>
    <button id="hide" type="button">HIDE UI</button>
  </aside>
  <button id="show" type="button" hidden>SHOW UI</button>`;

// ---------------------------------------------------------------- renderer: overcast, diffuse
const SKY = new THREE.Color(0xc4cdcb);
const scene = new THREE.Scene();
scene.background = SKY;
scene.fog = new THREE.FogExp2(SKY, 0.0045);

const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.3, 1500);
camera.position.set(0, 3.2, 0);              // centre of the circular plaza
camera.rotation.order = 'YXZ';
let yaw = 0, pitch = 0.2;
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

// ---------------------------------------------------------------- materials
const cMap = tex('/textures/lightwall_diff_2k.jpg', true);
const cNor = tex('/textures/lightwall_nor_gl_2k.jpg');
const cRough = tex('/textures/lightwall_rough_2k.jpg');
const concreteBase = (color: number, normal = 0.12) => new THREE.MeshStandardMaterial({ color, map: cMap, normalMap: cNor, normalScale: new THREE.Vector2(normal, normal), roughnessMap: cRough, roughness: 0.97 });

// Geometry centres: the crescent wraps the plaza; each tower has its own axis so panel joints follow every curve.
const LT = { x: Math.sin(-1.55) * 80, z: -Math.cos(-1.55) * 80, r: 14 };
const RT = { x: Math.sin(1.55) * 80, z: -Math.cos(1.55) * 80, r: 14 };
const CORE = { x: 0, z: -200, r: 42 };

const crescent = detailed(concreteBase(0xaeb3b3), { cyl: [0, 0] });
const crescentDark = detailed(concreteBase(0x8c9191), { cyl: [0, 0] });
const towerL = detailed(concreteBase(0x9fa4a4), { cyl: [LT.x, LT.z] });
const towerR = detailed(concreteBase(0x9fa4a4), { cyl: [RT.x, RT.z] });
const coreMat = detailed(concreteBase(0x989d9d), { cyl: [CORE.x, CORE.z] });
const plain = detailed(concreteBase(0xa9aeae, 0.1), { joints: 0, streaks: 0.4, weather: 0.3 });
const plainDark = detailed(concreteBase(0x878c8c, 0.1), { joints: 0, streaks: 0.3, weather: 0.3 });
const ground = detailed(concreteBase(0xa2a8a9, 0.18), { joints: 0, streaks: 0 });
const glass = new THREE.MeshStandardMaterial({ color: 0x2b3637, roughness: 0.32, metalness: 0.15 });
const steel = new THREE.MeshStandardMaterial({ color: 0x3e4344, roughness: 0.6, metalness: 0.4 });
const voidMat = new THREE.MeshStandardMaterial({ color: 0x101314, roughness: 1 });
const doorSteel = new THREE.MeshStandardMaterial({ color: 0x2f3435, roughness: 0.55, metalness: 0.55 });
const brass = new THREE.MeshStandardMaterial({ color: 0x5e5848, roughness: 0.45, metalness: 0.7 });
const lamp = new THREE.MeshBasicMaterial({ color: 0xdfe4dc });

const b = new Batch(9);
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- the plaza (observer stands at its centre)
b.box(0, -0.5, 0, 900, 1, 900, ground);
b.cylinder(0, 0, 0, 30, 1.2, ground, 96);
b.arc(0, 0, 30, 32.5, 0, TAU, 0, 0.8, plainDark, 2);                 // two shallow steps around the drum
b.arc(0, 0, 32.5, 35, 0, TAU, 0, 0.4, plainDark, 2);
for (const r of [6, 12, 18, 24]) b.arc(0, 0, r - 0.09, r + 0.09, 0, TAU, 1.19, 1.208, plainDark, 1.2);   // paving rings
for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; b.boxRot(Math.sin(a) * 18, 1.2, -Math.cos(a) * 18, 0.16, 0.012, 24, -a, plainDark); }
b.cylinder(0, -0.2, 0, 1.6, 1.5, plainDark, 48);                                                  // a low drum marking the centre

// ---------------------------------------------------------------- behind the observer: stepped seating facing the crescent
const S0 = Math.PI - 1.3, S1 = Math.PI + 1.3, STEPS = 14;
for (let j = 0; j < STEPS; j++) {
  const r0 = 40 + 3 * j;
  b.arc(0, 0, r0, r0 + 3.05, S0, S1, 0, 0.9 * (j + 1), j % 2 ? plain : plainDark, 2.5);
}
// handrails running up the seating
for (let a = S0 + 0.26; a < S1 - 0.1; a += 0.52) {
  b.rail(v3(Math.sin(a) * 40, 0.9, -Math.cos(a) * 40), v3(Math.sin(a) * 82, 0.9 * STEPS + 0.2, -Math.cos(a) * 82), steel, 0.95, 2.2);
}
// colonnade crowning the seating
{
  const top = 0.9 * STEPS, rc = 84;
  b.arc(0, 0, 82, 88, S0, S1, 0, top, plainDark, 3);
  for (let a = S0 + 0.02; a <= S1 - 0.02 + 1e-6; a += 0.075) b.cylinder(Math.sin(a) * rc, top, -Math.cos(a) * rc, 1.1, 14, plain, 24);
  b.arc(0, 0, rc - 2, rc + 2, S0, S1, top + 14, top + 16.2, plain, 2.5);
  b.arc(0, 0, rc - 2.3, rc + 2.3, S0, S1, top + 16.2, top + 16.7, plainDark, 2.5);
  b.arc(0, 0, rc + 3, rc + 4, S0, S1, top, top + 16.2, crescentDark, 2.5);                        // back wall
}

// ---------------------------------------------------------------- the crescent: terraces stepping back as they rise
const A0 = -1.45, A1 = 1.45;          // ±83° around the plaza
const TIERS = 8, TIER_H = 13.5;
const BAY = 0.12;                      // angular bay width (≈7.5 m at the first tier)
const PORTAL = 0.2;                    // half-angle kept clear for the central portal
for (let k = 0; k < TIERS; k++) {
  const r0 = 62 + 8 * k, r1 = r0 + 24;
  const y0 = k * TIER_H, y1 = y0 + TIER_H;
  const mat = k % 2 ? crescentDark : crescent;
  b.arc(0, 0, r0, r1, A0, A1, y0, y1, mat);
  b.arc(0, 0, r0 - 0.3, r0 + 0.6, A0, A1, y1 - 0.5, y1, plainDark);  // drip edge at every terrace
  b.railArc(0, 0, r0 + 8 * 0 + 0.4, A0 + 0.01, A1 - 0.01, y1, steel);
  // bays: pilasters and curved ribbon windows on the concave face
  for (let a = A0; a < A1 - 1e-6; a += BAY) {
    const pr = r0 - 0.5;
    if (!(k < 3 && Math.abs(a) < PORTAL + 0.04)) b.boxRot(Math.sin(a) * pr, (y0 + y1) / 2, -Math.cos(a) * pr, 1.0, TIER_H, 1.0, -a, plain);
    const mid = a + BAY / 2;
    if (k < 3 && Math.abs(mid) < PORTAL + BAY / 2) continue;          // the portal interrupts the lower tiers
    for (let yy = Math.ceil((y0 + 1.6) / 4.5) * 4.5; yy + 1.8 <= y1 - 1.4; yy += 4.5)
      b.curvedRibbon(0, 0, r0, -1, a + 0.014, a + BAY - 0.014, yy, glass, plain, steel);
  }
  // end walls of each tier close the crescent with a vertical slot window
  for (const e of [A0, A1]) {
    const sgn = Math.sign(e), rm = (r0 + r1) / 2, tx = Math.cos(e), tz = Math.sin(e);
    const px = Math.sin(e) * rm + sgn * tx * 0.05, pz = -Math.cos(e) * rm + sgn * tz * 0.05;
    b.boxRot(px, (y0 + y1) / 2, pz, 0.08, TIER_H - 4, 2.2, -e, voidMat);
  }
}

// Central portal: a gate tower standing on the first tier, with a stepped reveal, ribbed jambs,
// coffered steel doors, a gridded transom, a cantilevered canopy and a flight of steps.
{
  const ZF = -61;                     // door plane (just in front of the curved facade)
  const OW = 6, OH = 36;              // half-width and height of the inner opening
  const SILL = 1.8;                   // threshold height, reached by steps
  const doorH = 16;

  // Gate tower body behind the opening, so the frame reads as a solid mass from any angle.
  b.box(0, 13.5 + (46 - 13.5) / 2, -65.6, 27.2, 46 - 13.5, 8.4, crescentDark);
  b.box(0, 46.6, -61.5, 28.6, 1.2, 16, plainDark);                                   // roof cap

  // Massive outer surround with vertical fluting on its face.
  for (const s of [-1, 1]) {
    const xc = s * 11.6;
    b.box(xc, 23, -57.5, 4, 46, 7, plain);
    for (let i = 0; i < 5; i++) b.box(xc - 1.6 + i * 0.8, 23, -53.9, 0.36, 44, 0.3, plainDark);
    b.box(xc, 0.4, -57.3, 4.6, 0.8, 7.6, plainDark);                                  // plinth
    // slim vertical light slots beside the doors, set into the innermost reveal
    b.box(s * 5.97, SILL + 6.5, ZF + 1.0, 0.06, 6, 0.3, lamp);
  }
  b.box(0, 43, -57.3, 27.2, 6, 7.6, plain);                                           // head
  b.box(0, 39.85, -53.7, 27.4, 0.3, 0.8, plainDark);                                  // drip edge
  for (let i = -4; i <= 4; i++) b.box(i * 2.8, 43, -53.45, 0.3, 4.6, 0.3, plainDark); // coffers on the head

  // Three stepped reveals receding toward the doors.
  for (let k = 2; k >= 0; k--) {
    const inner = OW + 1.2 * k, outer = inner + 1.2, z1 = ZF + 2 + 2 * k;
    const depth = z1 - ZF, zc = (ZF + z1) / 2;
    const mat = k % 2 ? plainDark : plain;
    for (const s of [-1, 1]) b.box(s * (inner + 0.6), (OH + 1.2 * (k + 1)) / 2, zc, 1.2, OH + 1.2 * (k + 1), depth, mat);
    b.box(0, OH + 1.2 * k + 0.6, zc, outer * 2, 1.2, depth, mat);
  }

  // Doors: two coffered steel leaves with stiles, horizontal ribs and long pull bars.
  for (const s of [-1, 1]) {
    const xc = s * OW / 2;
    b.box(xc, SILL + doorH / 2, ZF - 0.05, OW - 0.08, doorH, 0.3, doorSteel);
    b.box(s * (OW - 0.25), SILL + doorH / 2, ZF + 0.15, 0.5, doorH, 0.12, steel);     // outer stile
    b.box(s * 0.25, SILL + doorH / 2, ZF + 0.15, 0.42, doorH, 0.12, steel);           // meeting stile
    for (let r = 0; r < 12; r++) {
      const y = SILL + 0.7 + r * (doorH - 1.4) / 11;
      b.box(xc, y, ZF + 0.14, OW - 0.9, 0.16, 0.1, steel);
    }
    for (const c of [-1, 1]) b.box(xc + c * (OW / 4 - 0.1), SILL + doorH / 2, ZF + 0.12, 0.1, doorH - 1.2, 0.08, steel);
    b.box(s * 0.75, SILL + 6.5, ZF + 0.38, 0.14, 4.5, 0.14, brass);                    // pull bar
    for (const yy of [4.5, 8.5]) b.box(s * 0.75, SILL + yy, ZF + 0.27, 0.1, 0.1, 0.24, brass);
  }
  b.box(0, SILL + doorH / 2, ZF + 0.02, 0.06, doorH, 0.2, voidMat);                    // seam between the leaves

  // Heavy transom beam, then a tall gridded window up to the head of the opening.
  b.box(0, SILL + doorH + 0.6, ZF + 0.3, OW * 2, 1.2, 1.0, plain);
  const tY0 = SILL + doorH + 1.2, tY1 = OH;
  b.box(0, (tY0 + tY1) / 2, ZF - 0.05, OW * 2, tY1 - tY0, 0.08, glass);
  for (let x = -OW + 1.5; x < OW - 0.1; x += 1.5) b.box(x, (tY0 + tY1) / 2, ZF + 0.05, 0.12, tY1 - tY0, 0.18, steel);
  for (let y = tY0 + 2.25; y < tY1 - 0.1; y += 2.25) b.box(0, y, ZF + 0.05, OW * 2, 0.1, 0.16, steel);
  b.box(0, tY0 + (tY1 - tY0) * 0.5, ZF + 0.12, 0.35, tY1 - tY0, 0.3, plain);           // central concrete mullion

  // Cantilevered canopy over the doors, hung from the head by steel rods.
  const cy = SILL + doorH + 2.4;
  b.box(0, cy, ZF + 4.6, OW * 2 - 0.1, 0.9, 9.2, plain);
  b.box(0, cy - 0.55, ZF + 9.05, OW * 2 - 0.1, 0.2, 0.4, plainDark);                    // drip
  for (const s of [-1, 1]) b.slab(v3(s * 4.5, cy + 0.45, ZF + 8.6), v3(s * 4.5, OH - 1, ZF + 0.6), 0.12, 0.12, steel);

  // Steps and landing up to the threshold, with flanking cheek walls and handrails.
  b.box(0, SILL / 2, ZF + 2.5, OW * 2 - 0.1, SILL, 5, plain);                          // landing
  for (let j = 0; j < 6; j++) {
    const top = SILL - 0.3 * j, zf = ZF + 5 + 0.9 * (j + 1);
    b.box(0, top / 2 - 0.15, zf - 0.45, OW * 2 - 0.1, top - 0.3, 0.9, j % 2 ? plain : plainDark);
  }
  for (const s of [-1, 1]) {
    b.box(s * 5.6, 0.7, ZF + 7.5, 0.8, 1.4, 5.6, plainDark);
    b.rail(v3(s * 5.2, SILL, ZF + 5), v3(s * 5.2, 0.3, ZF + 10.4), steel, 0.95, 1.4);
  }
  // Bollards on the plaza side.
  for (const x of [-9, -3, 3, 9]) b.cylinder(x, 0, ZF + 14, 0.38, 1.1, plainDark, 20);
}

// ---------------------------------------------------------------- drum towers at both ends of the crescent
function drum(T: { x: number; z: number; r: number }, mat: THREE.Material, h: number, balconies: boolean) {
  b.cylinder(T.x, 0, T.z, T.r, h, mat, 96);
  b.arc(T.x, T.z, T.r - 0.2, T.r + 0.6, 0, TAU, h, h + 0.8, plainDark, 2);               // crown
  const segs = 6;
  for (let yy = 4.5; yy + 3 < h; yy += 9) {
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * TAU + 0.06, a1 = ((i + 1) / segs) * TAU - 0.06;
      b.curvedRibbon(T.x, T.z, T.r, 1, a0, a1, yy, glass, plain, steel);
    }
  }
  if (balconies) for (let yy = 27; yy < h - 10; yy += 27) {
    b.arc(T.x, T.z, T.r, T.r + 3.6, 0, TAU, yy - 0.6, yy, plain, 2);
    b.railArc(T.x, T.z, T.r + 3.35, 0, TAU, yy, steel);
  }
}
drum(LT, towerL, 196, true);
drum(RT, towerR, 176, false);

// Helical ramp wrapping the right-hand drum.
{
  const turns = 2.5, rise = 112, n = 260, rc = RT.r + 2.8, width = 4.2;
  const P = (t: number) => { const a = t * turns * TAU; return v3(RT.x + Math.sin(a) * rc, (t * rise), RT.z - Math.cos(a) * rc); };
  const Po = (t: number) => { const a = t * turns * TAU, r = rc + width / 2 - 0.15; return v3(RT.x + Math.sin(a) * r, t * rise, RT.z - Math.cos(a) * r); };
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1.08) / n;
    b.slab(P(t0), P(Math.min(t1, 1)), width, 0.55, plain);
    b.slab(Po(t0).add(v3(0, 0.55, 0)), Po(Math.min(t1, 1)).add(v3(0, 0.55, 0)), 0.3, 0.9, plainDark);   // upstand
    if (i % 2 === 0) b.rail(Po(t0).add(v3(0, 1.0, 0)), Po((i + 2) / n).add(v3(0, 1.0, 0)), steel, 0.55, 3);
    if (i % 12 === 0) { const a = t0 * turns * TAU, r = RT.r + 0.6; b.boxRot(RT.x + Math.sin(a) * r, t0 * rise - 0.8, RT.z - Math.cos(a) * r, 0.8, 1.4, 1.6, -a, plainDark); }
  }
}

// ---------------------------------------------------------------- sky-bridge: a curved deck high above, tower to tower
{
  const R = 80, y = 150;
  b.arc(0, 0, R - 2.2, R + 2.2, -1.48, 1.48, y - 0.7, y, plain);
  b.arc(0, 0, R - 0.7, R + 0.7, -1.48, 1.48, y - 3.6, y - 0.7, plainDark);
  b.railArc(0, 0, R - 2.0, -1.48, 1.48, y, steel);
  b.railArc(0, 0, R + 2.0, -1.48, 1.48, y, steel);
}

// ---------------------------------------------------------------- parabolic arch framing the portal
{
  const zc = -48, half = 26, H = 66, n = 48;
  const P = (t: number) => { const x = -half + 2 * half * t; return v3(x, H * (1 - (x / half) ** 2), zc); };
  for (let i = 0; i < n; i++) {
    const a = P(i / n), c = P((i + 1) / n), dir = c.clone().sub(a).normalize().multiplyScalar(0.25);
    b.slab(a.clone().sub(dir), c.clone().add(dir), 5, 3.4, plain);
  }
  for (const s of [-1, 1]) b.box(s * half, 0.6, zc, 7, 1.2, 8, plainDark);                  // footings
}

// ---------------------------------------------------------------- the core behind everything, lost in haze
b.cylinder(CORE.x, 0, CORE.z, CORE.r, 320, coreMat, 128);
for (let yy = 13.5; yy < 316; yy += 13.5)
  for (let i = 0; i < 10; i++) b.curvedRibbon(CORE.x, CORE.z, CORE.r, 1, (i / 10) * TAU + 0.04, ((i + 1) / 10) * TAU - 0.04, yy, glass, plain, steel);

b.flush(scene, [glass, voidMat, lamp]);

// ---------------------------------------------------------------- decay
{
  const d = new Decay(scene, { envMap: new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture });
  d.tree(-14, 1.2, -12, 9, 41); d.weeds(-14, 1.2, -12, 1.5, 42, 60);
  d.tree(17, 1.2, 9, 7, 43); d.weeds(17, 1.2, 9, 1.2, 44, 40);
  d.tree(-36, 0, -40, 13, 45); d.tree(44, 0, -30, 11, 46); d.tree(20, 0, -52, 8, 47);
  d.puddle(6, 1.2, -9, 3, 2, 51); d.puddle(-9, 1.2, 11, 4, 2.4, 52); d.puddle(21, 1.2, -14, 2.4, 1.5, 53);
  d.puddle(0, 0, -47, 6, 3, 54); d.puddle(-30, 0, -46, 5, 3, 55);
  d.dump(-21, 1.2, -5, 401, 6); d.dump(10, 1.2, 17, 402, 4); d.dump(26, 0, -44, 403, 7);
  for (let i = 0; i < 12; i++) { const a = i * 0.53; d.weeds(Math.sin(a) * 24, 1.2, -Math.cos(a) * 24, 0.8, 60 + i, 20); }
  d.flush();
}

// ---------------------------------------------------------------- light
const hemi = new THREE.HemisphereLight(0xe6eded, 0x70726e, 2.1);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xf0f3f2, 0.9);
key.position.set(-90, 200, 120);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 10, far: 700 });
key.shadow.radius = 6;
key.shadow.bias = -0.0003;
scene.add(key);
const composer = aoComposer(renderer, scene, camera, 2.5, 0.9);

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

const fogInput = document.querySelector<HTMLInputElement>('#fog')!;
const lightInput = document.querySelector<HTMLInputElement>('#light')!;
const fogValue = document.querySelector<HTMLOutputElement>('#fog-value')!;
const lightValue = document.querySelector<HTMLOutputElement>('#light-value')!;
fogInput.addEventListener('input', () => { const v = Number(fogInput.value); (scene.fog as THREE.FogExp2).density = v; fogValue.textContent = v.toFixed(4); });
lightInput.addEventListener('input', () => { const v = Number(lightInput.value); hemi.intensity = 2.1 * v; key.intensity = 0.9 * v; lightValue.textContent = v.toFixed(1); });
document.querySelector<HTMLButtonElement>('#prev')!.addEventListener('click', () => { window.location.href = '/classic-003.html'; });
document.querySelector<HTMLButtonElement>('#first')!.addEventListener('click', () => { window.location.href = '/classic-001.html'; });
const panel = document.querySelector<HTMLElement>('aside')!;
const show = document.querySelector<HTMLButtonElement>('#show')!;
document.querySelector<HTMLButtonElement>('#hide')!.addEventListener('click', () => { panel.hidden = true; show.hidden = false; });
show.addEventListener('click', () => { panel.hidden = false; show.hidden = true; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
function animate() { requestAnimationFrame(animate); composer.render(); }
animate();
