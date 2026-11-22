import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Batch, detailed, aoComposer, v3 } from './kit';
import { Decay } from './decay';
import { rustMaterial } from './rust';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root was not found.');
app.innerHTML = `
  <div id="scene" aria-label="Vertical concrete void"></div>
  <header><div class="eyebrow">CONCRETE WORLD / 003</div><h1>THE VERTICAL VOID</h1></header>
  <aside aria-label="Scene controls">
    <div class="panel-title">ATMOSPHERE</div>
    <label for="fog">FOG <output id="fog-value">0.004</output><input id="fog" type="range" min="0.001" max="0.03" step="0.0002" value="0.0038"></label>
    <label for="light">LIGHT <output id="light-value">1.0</output><input id="light" type="range" min="0.3" max="2.5" step="0.1" value="1.0"></label>
    <button id="next" type="button">NEXT SCENE</button>
    <button id="prev" type="button">SCENE 002</button>
    <button id="first" type="button">SCENE 001</button>
    <button id="hide" type="button">HIDE UI</button>
  </aside>
  <button id="show" type="button" hidden>SHOW UI</button>`;

// ---------- renderer / camera ----------
const scene = new THREE.Scene();
const background = new THREE.Color(0x737a7d);
scene.background = background;
scene.fog = new THREE.FogExp2(background, 0.0038);

const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 3000);
// The observer stands on a landing cantilevered from the south wall, high inside the shaft.
camera.position.set(0, 2.4, 28.5);
camera.rotation.order = 'YXZ';
let yaw = 0;
let pitch = 0.3;
camera.rotation.set(pitch, yaw, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.querySelector('#scene')!.appendChild(renderer.domElement);

// ---------- materials ----------
// Same approved light-grey concrete as the Scene 001 columns. UVs are set in world units below,
// so a 200 m wall shows the same grain size as a 2 m parapet instead of one stretched image.
const loader = new THREE.TextureLoader();
function texture(path: string, color = false) {
  const map = loader.load(path);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  if (color) map.colorSpace = THREE.SRGBColorSpace;
  return map;
}
const wallColor = texture('/textures/lightwall_diff_2k.jpg', true);
const wallNormal = texture('/textures/lightwall_nor_gl_2k.jpg');
const wallRough = texture('/textures/lightwall_rough_2k.jpg');

const concrete = detailed(new THREE.MeshStandardMaterial({ color: 0xb6bbbd, map: wallColor, normalMap: wallNormal, normalScale: new THREE.Vector2(0.1, 0.1), roughnessMap: wallRough, roughness: 0.98 }), { floorY: -180, cyl: [0, 0], streaks: 1.9, weather: 1.7 });
const darkConcrete = detailed(new THREE.MeshStandardMaterial({ color: 0x868b8d, map: wallColor, normalMap: wallNormal, normalScale: new THREE.Vector2(0.1, 0.1), roughnessMap: wallRough, roughness: 0.99 }), { joints: 0.7, streaks: 1.4, weather: 1.5, floorY: -180, cyl: [0, 0] });
const stairMat = detailed(new THREE.MeshStandardMaterial({ color: 0xaeb3b5, map: wallColor, normalMap: wallNormal, normalScale: new THREE.Vector2(0.1, 0.1), roughnessMap: wallRough, roughness: 0.98 }), { joints: 0, streaks: 0 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0xa6abad, map: wallColor, normalMap: wallNormal, normalScale: new THREE.Vector2(0.12, 0.12), roughnessMap: wallRough, roughness: 0.97 });
const voidMat = new THREE.MeshStandardMaterial({ color: 0x121516, roughness: 1 });
const skyMat = new THREE.MeshBasicMaterial({ color: 0xe9eeee, fog: false });
const beamMat = new THREE.MeshBasicMaterial({ color: 0xdfe6e6, transparent: true, opacity: 0.055, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

const b = new Batch(9);
function block(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material = concrete, _shadows = true) {
  b.box(x, y, z, w, h, d, material);
}

// ---------- metal ----------
// Brushed dark steel for the machine parts. Metal needs something to reflect, so these
// materials get a soft studio environment map; the concrete stays purely diffuse.
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
// Gunmetal steel with only light, patchy rust; the machines keep their heavier corrosion.
const metal = rustMaterial({ amount: 0.12, seed: 21, envMap, repeat: 1.5, tint: 0x9aa0a2 });
const darkMetal = rustMaterial({ amount: 0.18, seed: 23, envMap, repeat: 1.5, tint: 0x6e7476 });
metal.metalness = darkMetal.metalness = 0.8; metal.envMapIntensity = darkMetal.envMapIntensity = 0.6;
const machineRust = rustMaterial({ amount: 0.6, seed: 25, envMap, repeat: 1.5, tint: 0xa09086 });
const machineRustDark = rustMaterial({ amount: 0.8, seed: 27, envMap, repeat: 1.5, tint: 0x8a7c72 });
// Light strips: segments on every rib, in three groups pulsed in sequence so light climbs the shaft.
const pulseMats = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ color: 0x0a0d0e, emissive: 0xbfe9f5, emissiveIntensity: 1, roughness: 1 }));
const glow = new THREE.MeshStandardMaterial({ color: 0x0c0f10, emissive: 0xdff2f7, emissiveIntensity: 2.4, roughness: 1 });

// ---------- the shaft ----------
// A round reactor shaft, 68 m across, from far below the fog line (-180) to a roof at +118.
// No windows: smooth board-formed concrete, steel ribs and rings, a spiral ramp, and one
// suspended machine ring as the focal object.
const R = 34;
const BOTTOM = -180;
const TOP = 560;   // the oculus is over half a kilometre up
const TAU = Math.PI * 2;
b.arc(0, 0, R, R + 4, 0, TAU, BOTTOM, TOP, concrete, 3);                     // shaft wall
b.disc(0, 0, R, BOTTOM, floorMat, 1);                                         // floor, lost in fog

// Roof slab with a round oculus (r = 11 m) and a deep stepped steel collar.
const O = 11;
b.arc(0, 0, O, R + 4, 0, TAU, TOP, TOP + 4, concrete, 3);
b.arc(0, 0, O, O + 1.2, 0, TAU, TOP - 6, TOP, darkMetal, 2);
b.arc(0, 0, O + 1.2, O + 4, 0, TAU, TOP - 2.5, TOP, darkConcrete, 2);
const sky = new THREE.Mesh(new THREE.CircleGeometry(O + 6, 64), skyMat);
sky.rotation.x = Math.PI / 2;
sky.position.set(0, TOP + 12, 0);
scene.add(sky);

// Steel ribs: 32 tall fins standing off the wall, the shaft's main rhythm.
const RIBS = 12;
for (let i = 0; i < RIBS; i++) {
  const a = (i / RIBS) * TAU;
  if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.4) continue; // clear the landing
  b.boxRot(Math.sin(a) * (R - 0.6), (BOTTOM + TOP) / 2, -Math.cos(a) * (R - 0.6), 2.6, TOP - BOTTOM, 1.2, -a, darkMetal);
  b.boxRot(Math.sin(a) * (R - 1.35), (BOTTOM + TOP) / 2, -Math.cos(a) * (R - 1.35), 0.9, TOP - BOTTOM, 0.4, -a, darkMetal);
  let k = 0;
  for (let y = BOTTOM + 8; y < TOP - 8; y += 14, k++) b.boxRot(Math.sin(a) * (R - 1.6), y, -Math.cos(a) * (R - 1.6), 0.22, 6, 0.12, -a, pulseMats[k % 3]);
}
// Ring beams: a steel band every 30 m, deeper than the ribs so the shaft reads as stacked drums.
for (let y = -120; y <= TOP - 30; y += 70) {
  b.arc(0, 0, R - 2.4, R, 0, TAU, y - 0.9, y + 0.9, metal, 2);
  b.arc(0, 0, R - 2.0, R, 0, TAU, y - 1.6, y - 0.9, darkConcrete, 2);
}

// Two colossal recessed portals facing each other across the void (east and west).
for (const side of [-1, 1]) {
  const a = side * Math.PI / 2;
  b.arc(0, 0, R - 0.05, R + 0.2, a - 0.12, a + 0.12, -40, 40, voidMat, 2);    // dark opening
  b.arc(0, 0, R - 3, R, a - 0.15, a - 0.12, -42, 42, metal, 2);              // steel jambs
  b.arc(0, 0, R - 3, R, a + 0.12, a + 0.15, -42, 42, metal, 2);
  b.arc(0, 0, R - 3, R, a - 0.15, a + 0.15, 40, 42, metal, 2);               // lintel
  b.arc(0, 0, R - 0.6, R, a - 0.11, a + 0.11, -38, -37.4, glow, 2);           // light strip at the threshold
}

// Spiral ramp hugging the wall: one turn every 52 m, from the fog up to the roof collar.
const PITCH = 52;
const STEP = 0.02;
for (let a = 0, y = BOTTOM + 20; y < TOP - 12; a += STEP, y += (PITCH * STEP) / TAU) {
  if (Math.abs(Math.sin(a) ) > 0.99 && y > -42 && y < 42) continue;           // pass under the portals
  b.arc(0, 0, R - 6.5, R - 2.4, a, a + STEP + 0.004, y - 0.7, y, concrete, 4);
  b.arc(0, 0, R - 6.5, R - 6.2, a, a + STEP + 0.004, y, y + 1.0, darkConcrete, 4); // inner upstand
  b.arc(0, 0, R - 6.3, R - 4.4, a, a + STEP + 0.004, y - 1.8, y - 0.7, darkMetal, 4); // steel soffit
}

// ---------- the machine ring ----------
// A suspended steel halo with a glowing inner face, hung from the roof on four cables,
// and a second, smaller ring far below in the fog for depth.
function halo(y: number, r: number, depth: number) {
  b.arc(0, 0, r, r + depth, 0, TAU, y - 2.2, y + 2.2, metal, 2);
  b.arc(0, 0, r + 0.4, r + depth - 0.4, 0, TAU, y + 2.2, y + 2.8, darkMetal, 2);
  b.arc(0, 0, r + 0.4, r + depth - 0.4, 0, TAU, y - 2.8, y - 2.2, darkMetal, 2);
  b.arc(0, 0, r - 0.05, r + 0.05, 0, TAU, y - 0.5, y + 0.5, glow, 2);       // light line on the inner face
  for (let i = 0; i < 16; i++) {                                               // radial stiffeners
    const a = (i / 16) * TAU;
    b.boxRot(Math.sin(a) * (r + depth / 2), y, -Math.cos(a) * (r + depth / 2), 0.4, 6.2, depth + 0.6, -a, darkMetal);
  }
}
halo(34, 15, 3.4);
halo(-62, 10, 2.4);
for (let i = 0; i < 4; i++) {
  const a = (i / 4) * TAU + Math.PI / 4;
  const x = Math.sin(a) * 16.7, z = -Math.cos(a) * 16.7;
  b.box(x, (36.8 + TOP) / 2, z, 0.35, TOP - 36.8, 0.35, darkMetal);         // suspension cable
}

// One steel bridge crossing the void beneath the halo, offset from the centre.
const by = -8;
b.box(-9, by, 0, 3.6, 0.6, R * 2 - 9, metal);
b.box(-9, by - 1.6, 0, 1.2, 2.6, R * 2 - 9, darkMetal);
for (const sd of [-1, 1]) b.rail(v3(-9 + sd * 1.65, by + 0.3, -R + 5), v3(-9 + sd * 1.65, by + 0.3, R - 5), metal, 1.0, 2.2);

// ---------- the observer's landing ----------
// A semicircular balcony cantilevered from the south wall, with a low steel-capped parapet.
const LZ = R - 2;
b.arc(0, LZ, 0, 9, -Math.PI / 2 - 0.0, Math.PI / 2, -1.2, 0, floorMat, 2);
b.arc(0, LZ, 8.7, 9, -Math.PI / 2, Math.PI / 2, 0, 0.9, darkConcrete, 2);
b.arc(0, LZ, 8.6, 9.1, -Math.PI / 2, Math.PI / 2, 0.9, 1.0, metal, 2);
b.arc(0, LZ, 2, 9, -Math.PI / 2, Math.PI / 2, -4.5, -1.2, darkConcrete, 2);
block(0, 4, R + 0.2, 3.4, 8, 0.3, voidMat, false);                              // the doorway you came through, behind you

b.flush(scene, [voidMat, glow]);

// ---------- decay ----------
{
  const d = new Decay(scene, { envMap });
  d.puddle(-9, by + 0.3, -5, 1.2, 0.8, 37);
  d.puddle(2.6, 0, 26.5, 1.5, 1.0, 38);
  d.flush();
}


// ---------- the seized wheel ----------
// A rusted 26 m wheel on the north wall, held by a pawl. It keeps trying to turn, catches on a
// tooth, shudders and drops back; once in a while it grinds forward by one tooth.
const wheel = new THREE.Group();
{
  const WY = 24, WR = 13, WZ = -(R - 5.5);
  const mount = new THREE.Group(); mount.position.set(0, WY, WZ); scene.add(mount);
  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D) => { const me = new THREE.Mesh(g, m); me.castShadow = me.receiveShadow = true; parent.add(me); };
  add(new THREE.TorusGeometry(WR, 0.9, 14, 120), machineRustDark, wheel);
  add(new THREE.TorusGeometry(WR - 3.5, 0.45, 10, 96), machineRust, wheel);
  const hub = new THREE.CylinderGeometry(2.4, 2.4, 2.6, 40); hub.rotateX(Math.PI / 2); add(hub, machineRustDark, wheel);
  const cap = new THREE.CylinderGeometry(1.1, 1.1, 3.4, 24); cap.rotateX(Math.PI / 2); add(cap, machineRust, wheel);
  for (let i = 0; i < 8; i++) { const g = new THREE.BoxGeometry(0.9, WR - 2.4, 0.7); g.translate(0, (WR + 2.4) / 2, 0); g.rotateZ((i / 8) * Math.PI * 2); add(g, machineRust, wheel); }
  for (let i = 0; i < 36; i++) { const g = new THREE.BoxGeometry(1.1, 1.6, 1.4); g.translate(0, WR + 1.4, 0); g.rotateZ((i / 36) * Math.PI * 2); add(g, machineRustDark, wheel); }
  mount.add(wheel);
  // axle housing into the wall and the pawl that jams it, both fixed
  const axle = new THREE.BoxGeometry(4, 4, 5.5); axle.translate(0, 0, -3); add(axle, darkConcrete, mount);
  const pawlArm = new THREE.BoxGeometry(1.2, 5, 1.2); pawlArm.translate(0, 0, 0); pawlArm.rotateZ(0.5); pawlArm.translate(-2.2, WR + 3.6, 0.2); add(pawlArm, machineRust, mount);
  const pawlPin = new THREE.CylinderGeometry(0.9, 0.9, 2.4, 16); pawlPin.rotateX(Math.PI / 2); pawlPin.translate(-3.4, WR + 5.6, -0.3); add(pawlPin, machineRustDark, mount);
  const bracket = new THREE.BoxGeometry(3, 3, 6); bracket.translate(-3.4, WR + 5.6, -3); add(bracket, darkConcrete, mount);
}
const wheelState = { a: 0, v: 0, base: 0, target: 0, next: 1.5, hold: 0, burst: 0 };
function updateWheel(dt: number, t: number) {
  const s = wheelState, TOOTH = (Math.PI * 2) / 36;
  if (t > s.next) {
    if (s.burst > 0) { s.target = s.base - (Math.random() - 0.25) * 0.03; s.burst--; s.next = t + 0.06 + Math.random() * 0.1; }
    else if (Math.random() < 0.3) { s.burst = 3 + Math.floor(Math.random() * 5); s.next = t; }
    else if (Math.random() < 0.15) { s.base -= TOOTH; s.target = s.base - 0.02; s.next = t + 1.2 + Math.random() * 2; }   // grinds one tooth on
    else { s.target = s.base - TOOTH * (0.5 + Math.random() * 0.4); s.hold = t + 0.15 + Math.random() * 0.4; s.next = t + 0.8 + Math.random() * 1.8; }
  }
  if (s.hold && t > s.hold) { s.target = s.base; s.hold = 0; }
  const k = 520, c = 9, n = Math.ceil(dt / 0.004);
  for (let i = 0; i < n; i++) { const h = dt / n; s.v += (k * (s.target - s.a) - c * s.v) * h; s.a += s.v * h; }
  wheel.rotation.z = s.a + Math.sin(t * 47) * 0.0015;
}

// ---------- the slow lift ----------
// An open rusted cage on two guide rails, standing off the north-west wall, creeping upward at
// walking-pace-divided-by-three. It disappears into the roof and comes back up out of the fog.
const LIFT_A = -0.785, LIFT_R = 24.5;
const liftBase = new THREE.Group();
liftBase.position.set(Math.sin(LIFT_A) * LIFT_R, 0, -Math.cos(LIFT_A) * LIFT_R);
liftBase.rotation.y = -LIFT_A;                       // local x: along the wall, local z: towards the shaft centre
scene.add(liftBase);
const cage = new THREE.Group(); liftBase.add(cage);
let cable: THREE.Mesh;
{
  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D) => { const me = new THREE.Mesh(g, m); me.castShadow = me.receiveShadow = true; parent.add(me); return me; };
  // rails and the brackets tying them back to the wall (skipping where the spiral ramp passes)
  for (const x of [-2.4, 2.4]) { const g = new THREE.BoxGeometry(0.45, TOP - BOTTOM, 0.6); g.translate(x, (TOP + BOTTOM) / 2, -1.9); add(g, machineRustDark, liftBase); }
  for (let y = BOTTOM + 10; y < TOP - 6; y += 18) {
    if (Math.abs(((y + 114.5) % 52 + 52) % 52) < 5 || Math.abs(((y + 114.5) % 52 + 52) % 52) > 47) continue;
    const g = new THREE.BoxGeometry(5.4, 0.6, R - LIFT_R + 0.5); g.translate(0, y, -1.9 - (R - LIFT_R) / 2); add(g, machineRustDark, liftBase);
  }
  // the cage: floor, roof, corner posts, bars, a gate, a weak warm lamp
  const W = 4, H = 3.2, D = 3.4;
  const floor = new THREE.BoxGeometry(W, 0.3, D); add(floor, machineRustDark, cage);
  const roof = new THREE.BoxGeometry(W, 0.25, D); roof.translate(0, H, 0); add(roof, machineRustDark, cage);
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) { const g = new THREE.BoxGeometry(0.18, H, 0.18); g.translate(x, H / 2, z); add(g, machineRust, cage); }
  for (let i = 1; i < 12; i++) {
    const u = -W / 2 + (i * W) / 12;
    for (const z of [-D / 2, D / 2]) { const g = new THREE.BoxGeometry(0.05, H, 0.05); g.translate(u, H / 2, z); add(g, machineRust, cage); }
  }
  for (let i = 1; i < 10; i++) {
    const u = -D / 2 + (i * D) / 10;
    for (const x of [-W / 2, W / 2]) { const g = new THREE.BoxGeometry(0.05, H, 0.05); g.translate(x, H / 2, u); add(g, machineRust, cage); }
  }
  for (const y of [1.1, 2.2]) for (const z of [-D / 2, D / 2]) { const g = new THREE.BoxGeometry(W, 0.08, 0.08); g.translate(0, y, z); add(g, machineRust, cage); }
  // guide shoes on the rails
  for (const x of [-2.4, 2.4]) for (const y of [0.4, H - 0.4]) { const g = new THREE.BoxGeometry(0.8, 0.6, 1.2); g.translate(x, y, -1.4); add(g, machineRustDark, cage); }
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, emissive: 0xffc98a, emissiveIntensity: 2.2 });
  const lamp = new THREE.BoxGeometry(0.6, 0.12, 0.3); lamp.translate(0, H - 0.2, 0); add(lamp, lampMat, cage);
  const bulb = new THREE.PointLight(0xffc28a, 60, 18, 2); bulb.position.set(0, H - 0.5, 0); cage.add(bulb);
  // hoist cable up to the roof; its length is updated as the cage moves
  const cg = new THREE.BoxGeometry(0.12, 1, 0.12); cg.translate(0, 0.5, 0);
  cable = add(cg, machineRustDark, liftBase);
}
const LIFT_LOW = BOTTOM + 15, LIFT_HIGH = TOP - 8, LIFT_SPEED = 0.45;
function updateLift(t: number) {
  const span = LIFT_HIGH - LIFT_LOW;
  const y = LIFT_LOW + ((-6 - LIFT_LOW + t * LIFT_SPEED) % span + span) % span;
  cage.position.y = y + Math.sin(t * 2.1) * 0.015;       // a faint judder on the rails
  cable.position.set(0, y + 3.2, 0); cable.scale.y = Math.max(0.1, TOP - (y + 3.2));
}

// ---------- light ----------
const ambient = new THREE.HemisphereLight(0xd6dddd, 0x5a5e5e, 2.0);
scene.add(ambient);
// Sun enters only through the oculus: the roof casts shadows, so a bright patch lands on the walls.
const sun = new THREE.DirectionalLight(0xf2f4f2, 3.2);
sun.position.set(-176, 1408, 308);
sun.target.position.set(0, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.camera.near = 400; sun.shadow.camera.far = 2600;
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);
const bounce = new THREE.DirectionalLight(0xb4bcbc, 0.8);
bounce.position.set(30, -20, -40);
scene.add(bounce);

// Visible light shaft under the round oculus, leaning the same way the sun does.
const sunDir = sun.position.clone().normalize();
const shaftLen = 760;
const shaft = new THREE.Mesh(new THREE.CylinderGeometry(O - 0.5, O - 0.5, shaftLen, 48, 1, true), beamMat);
shaft.position.set(0, TOP, 0).addScaledVector(sunDir, -shaftLen / 2);
shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sunDir);
scene.add(shaft);

// ---------- interaction ----------
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
fogInput.addEventListener('input', () => { const v = Number(fogInput.value); (scene.fog as THREE.FogExp2).density = v; fogValue.textContent = v.toFixed(3); });
lightInput.addEventListener('input', () => { const v = Number(lightInput.value); ambient.intensity = 1.6 * v; bounce.intensity = v * 0.8; sun.intensity = 3.2 * v; lightValue.textContent = v.toFixed(1); });
document.querySelector<HTMLButtonElement>('#next')!.addEventListener('click', () => { window.location.href = '/classic-004.html'; });
document.querySelector<HTMLButtonElement>('#prev')!.addEventListener('click', () => { window.location.href = '/classic-002.html'; });
document.querySelector<HTMLButtonElement>('#first')!.addEventListener('click', () => { window.location.href = '/classic-001.html'; });
const panel = document.querySelector<HTMLElement>('aside')!;
const show = document.querySelector<HTMLButtonElement>('#show')!;
document.querySelector<HTMLButtonElement>('#hide')!.addEventListener('click', () => { panel.hidden = true; show.hidden = false; });
show.addEventListener('click', () => { panel.hidden = false; show.hidden = true; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const composer = aoComposer(renderer, scene, camera, 3, 0.9);
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  updateWheel(dt, t); updateLift(t);
  pulseMats.forEach((m, i) => { m.emissiveIntensity = 0.25 + 1.6 * Math.max(0, Math.sin(t * 2.2 - i * 2.1)) ** 3; });
  composer.render();
}
animate();
