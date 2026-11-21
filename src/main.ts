import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { addSnow } from './snow';
import { addEye } from './eye';
import { Decay } from './decay';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Batch, detailed, tex, aoComposer } from './kit';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root was not found.');

app.innerHTML = `
  <div id="scene" aria-label="Interactive concrete hall"></div>
  <header><div class="eyebrow">CONCRETE WORLD / 001</div><h1>THE SILENT OBSERVER</h1></header>
  <aside aria-label="Scene controls">
    <div class="panel-title">ATMOSPHERE</div>
    <label for="fog">FOG <output id="fog-value">0.012</output><input id="fog" type="range" min="0.003" max="0.05" step="0.001" value="0.012"></label>
    <label for="light">LIGHT <output id="light-value">1.4</output><input id="light" type="range" min="0.3" max="3" step="0.1" value="1.4"></label>
    <button id="next" type="button">NEXT SCENE</button>
    <button id="hide" type="button">HIDE UI</button>
  </aside>
  <button id="show" type="button" hidden>SHOW UI</button>
`;

const scene = new THREE.Scene();
const background = new THREE.Color(0x858b8b);
scene.background = background;
scene.fog = new THREE.FogExp2(background, 0.012);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 350);
camera.position.set(0, 3.4, 0);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.querySelector('#scene')!.appendChild(renderer.domElement);

// ---------------------------------------------------------------- approved materials (unchanged)
const textureLoader = new THREE.TextureLoader();
function loadMaterialTexture(path: string, color = false, repeat = 3): THREE.Texture {
  const texture = textureLoader.load(path);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
// Floor: Poly Haven "concrete" (approved).
const concreteColor = loadMaterialTexture('/textures/concrete_diff_2k.jpg', true);
const concreteNormal = loadMaterialTexture('/textures/concrete_nor_gl_2k.jpg');
const concreteRoughness = loadMaterialTexture('/textures/concrete_rough_2k.jpg');
const concreteDisplacement = loadMaterialTexture('/textures/concrete_disp_2k.jpg');
const floorMat = new THREE.MeshStandardMaterial({ color: 0x817f79, map: concreteColor, normalMap: concreteNormal, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: concreteRoughness, roughness: 0.9, displacementMap: concreteDisplacement, displacementScale: 0.012 });
// Columns: Poly Haven "concrete_wall_009" (approved, do not change).
const columnColor = loadMaterialTexture('/textures/lightwall_diff_2k.jpg', true, 1.5);
const columnNormal = loadMaterialTexture('/textures/lightwall_nor_gl_2k.jpg', false, 1.5);
const columnRoughness = loadMaterialTexture('/textures/lightwall_rough_2k.jpg', false, 1.5);
const columnMat = new THREE.MeshStandardMaterial({ color: 0xb8b6b0, map: columnColor, normalMap: columnNormal, normalScale: new THREE.Vector2(0.08, 0.08), roughnessMap: columnRoughness, roughness: 0.98 });

function block(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
}

// ---------------------------------------------------------------- refined materials for walls / ceiling
// Same light-grey concrete family as the columns, but world-scaled UVs (no stretching on 170 m walls)
// plus panel joints, tie holes and seepage streaks.
const wMap = tex('/textures/lightwall_diff_2k.jpg', true);
const wNor = tex('/textures/lightwall_nor_gl_2k.jpg');
const wRough = tex('/textures/lightwall_rough_2k.jpg');
const wallMat = detailed(new THREE.MeshStandardMaterial({ color: 0xaaa9a3, map: wMap, normalMap: wNor, normalScale: new THREE.Vector2(0.14, 0.14), roughnessMap: wRough, roughness: 0.98 }), { streaks: 0.7 });
const beamMat = detailed(new THREE.MeshStandardMaterial({ color: 0x86857f, map: wMap, normalMap: wNor, normalScale: new THREE.Vector2(0.12, 0.12), roughnessMap: wRough, roughness: 0.99 }), { joints: 0.6, streaks: 0.4 });
const capMat = detailed(new THREE.MeshStandardMaterial({ color: 0x9a9993, map: wMap, normalMap: wNor, normalScale: new THREE.Vector2(0.1, 0.1), roughnessMap: wRough, roughness: 0.99 }), { joints: 0, streaks: 0 });
const voidMat = new THREE.MeshStandardMaterial({ color: 0x14181a, roughness: 1 });
const skylightMat = new THREE.MeshBasicMaterial({ color: 0xdfe6e6 });

const b = new Batch(8);

// ---------------------------------------------------------------- metal
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const metal = new THREE.MeshStandardMaterial({ color: 0x6f7578, metalness: 0.9, roughness: 0.42, envMap, envMapIntensity: 0.9 });
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x3a3f42, metalness: 0.85, roughness: 0.5, envMap, envMapIntensity: 0.7 });
const glow = new THREE.MeshStandardMaterial({ color: 0x0c0f10, emissive: 0xe0f1f5, emissiveIntensity: 2.4, roughness: 1 });

// ---------------------------------------------------------------- shell
// A taller, sparser hall: 42 m to the roof, one wide light slit down the axis, and a steel ring
// gate on the far wall as the focal point. Column and floor materials are the approved ones.
const H = 42;
block(0, -0.45, 0, 130, 0.9, 170, floorMat);
b.box(0, H, 0, 130, 2, 170, beamMat);                                     // roof slab (cut by the slit below)
b.box(-63, H / 2 - 1, 0, 2, H, 170, wallMat); b.box(63, H / 2 - 1, 0, 2, H, 170, wallMat);
b.box(0, H / 2 - 1, -83, 130, H, 2, wallMat); b.box(0, H / 2 - 1, 83, 130, H, 2, wallMat);

// ---------------------------------------------------------------- columns: bare concrete blades
// Modelled on flood-control caverns (Tokyo's G-Cans tank: plain pillars about 2 m by 7 m, no capital,
// no base, straight into the ceiling beams). Each blade is 3.2 m by 12 m, long side along the hall,
// rows every 20 m so they read as a forest. The only marks are pour joints and a flood line at the foot.
const COL_X = [-40, -16, 16, 40];
const COL_Z: number[] = []; for (let z = -70; z <= 70; z += 20) COL_Z.push(z);
const BW = 3.2, BD = 12;
const jointMat = new THREE.MeshStandardMaterial({ color: 0x6e6c67, roughness: 1 });
for (const x of COL_X) for (const z of COL_Z) {
  block(x, (H - 3) / 2, z, BW, H - 3, BD, columnMat);                        // approved column material
  for (let y = 3.6; y < H - 4; y += 3.6) b.box(x, y, z, BW + 0.04, 0.07, BD + 0.04, jointMat);   // pour lift joints
}
// Flood line: the hall has been flooded; mud and damp stain every blade to ~5 m with a crisp tide mark.
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, 'rgba(60,54,44,0)'); grad.addColorStop(0.34, 'rgba(60,54,44,0)');
  grad.addColorStop(0.36, 'rgba(58,52,42,0.75)'); grad.addColorStop(0.5, 'rgba(66,60,48,0.5)'); grad.addColorStop(1, 'rgba(48,42,34,0.85)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 512);
  g.fillStyle = 'rgba(45,40,32,0.8)'; g.fillRect(0, 0.345 * 512, 256, 3);                       // tide mark
  g.fillStyle = 'rgba(205,200,188,0.25)'; g.fillRect(0, 0.33 * 512, 256, 6);                     // pale salt above it
  for (let i = 0; i < 40; i++) {                                                                // drips running down from the line
    const x = Math.random() * 256, len = 20 + Math.random() * 180;
    const d = g.createLinearGradient(0, 0.36 * 512, 0, 0.36 * 512 + len);
    d.addColorStop(0, 'rgba(40,36,30,0.45)'); d.addColorStop(1, 'rgba(40,36,30,0)');
    g.fillStyle = d; g.fillRect(x, 0.36 * 512, 1 + Math.random() * 3, len);
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
  const floodMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
  const FH = 7.5, parts: THREE.BufferGeometry[] = [];
  for (const x of COL_X) for (const z of COL_Z) {
    for (const [w, rotY, ox, oz] of [[BW, 0, 0, BD / 2 + 0.02], [BW, Math.PI, 0, -BD / 2 - 0.02], [BD, Math.PI / 2, BW / 2 + 0.02, 0], [BD, -Math.PI / 2, -BW / 2 - 0.02, 0]] as const) {
      const pg = new THREE.PlaneGeometry(w, FH); pg.translate(0, FH / 2, 0); pg.rotateY(rotY); pg.translate(x + ox, 0, z + oz); parts.push(pg);
    }
  }
  scene.add(new THREE.Mesh(mergeGeometries(parts), floodMat));
}
// Deep beams only along the column lines (no secondary grid).
for (const x of COL_X) b.box(x, H - 1.6, 0, 3, 2.6, 166, beamMat);
for (const z of COL_Z) {
  b.box(-40, H - 1.6, z, 46, 2.6, 3, beamMat);
  b.box(40, H - 1.6, z, 46, 2.6, 3, beamMat);
}

// ---------------------------------------------------------------- the light slit
// One 9 m wide opening runs the length of the roof between the two inner column lines.
const SLIT = 9;
const slitSky = new THREE.Mesh(new THREE.PlaneGeometry(SLIT, 160), skylightMat);
slitSky.rotation.x = Math.PI / 2; slitSky.position.set(0, H + 3, 0); scene.add(slitSky);
for (const sx of [-1, 1]) {
  b.box(sx * (SLIT / 2 + 0.4), H - 0.4, 0, 0.8, 4.8, 160, darkMetal);       // steel reveal on each side
  b.box(sx * (SLIT / 2 + 1.6), H - 2.4, 0, 1.6, 0.8, 160, metal);
}
for (let z = -75; z <= 75; z += 15) b.box(0, H + 0.4, z, SLIT + 1, 0.6, 0.5, darkMetal); // thin steel tie bars across the slit

// ---------------------------------------------------------------- walls: tall slits instead of vents and windows
for (const sx of [-1, 1]) {
  const wx = sx * 61.9;
  for (const z of COL_Z) b.box(wx, H / 2, z, 0.8, H, 2.4, wallMat);       // pilasters on the column rows
  for (let i = 0; i < COL_Z.length - 1; i++) {
    const zc = (COL_Z[i] + COL_Z[i + 1]) / 2;
    b.box(sx * 61.98, H / 2 - 2, zc, 0.06, H - 10, 1.4, voidMat);          // full-height dark slit
    b.box(sx * 61.7, H / 2 - 2, zc - 1.05, 0.6, H - 9, 0.5, darkMetal);
    b.box(sx * 61.7, H / 2 - 2, zc + 1.05, 0.6, H - 9, 0.5, darkMetal);
  }
  b.box(sx * 61.75, 0.5, 0, 0.5, 1, 166, capMat);                          // skirting
}
b.box(0, 0.5, 81.75, 126, 1, 0.5, capMat);

// ---------------------------------------------------------------- the ring gate (focal point)
// A 30 m steel ring set into the far wall, a dark circular recess behind it, a light line inside,
// and a glowing seam in the floor leading to it along the axis.
{
  const RZ = -81.9, RY = 18, RR = 15;
  const recess = new THREE.Mesh(new THREE.CircleGeometry(RR - 0.4, 96), voidMat);
  recess.position.set(0, RY, RZ + 0.02); scene.add(recess);
  const ring = new THREE.TorusGeometry(RR, 1.3, 20, 160); ring.translate(0, RY, RZ + 1.0); b.push(ring, metal);
  const outer = new THREE.TorusGeometry(RR + 2.4, 0.5, 12, 160); outer.translate(0, RY, RZ + 0.6); b.push(outer, darkMetal);
  const line = new THREE.TorusGeometry(RR - 1.2, 0.16, 8, 160); line.translate(0, RY, RZ + 1.6); b.push(line, glow);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const g = new THREE.BoxGeometry(0.8, 3.2, 1.6); g.translate(0, RR + 1.4, 0); g.rotateZ(a); g.translate(0, RY, RZ + 1.0); b.push(g, darkMetal);
  }
  b.box(0, 1.5, RZ + 3, 10, 3, 4, beamMat);                        // threshold plinth under the ring
  b.box(0, 0.015, -44, 0.07, 0.03, 72, glow);                               // thin light seam in the floor along the axis
  b.box(0, 0.01, -44, 0.5, 0.02, 72, darkMetal);
}
// A giant mechanical eye inside the ring: it looks around and blinks behind two steel lids.
const lidMat = darkMetal.clone(); lidMat.side = THREE.DoubleSide;
const eye = addEye(scene, { center: new THREE.Vector3(0, 18, -84), radius: 12, lidMaterial: lidMat, rimMaterial: metal, envMap });

b.flush(scene, [voidMat, glow]);

// ---------------------------------------------------------------- decay: what nature and neglect left behind
// Kept at human scale so the hall reads as enormous around them.
{
  const d = new Decay(scene, { envMap });
  d.puddle(3.2, 0, -14, 3, 1.8, 21); d.puddle(-3, 0, -36, 4.6, 2.3, 22); d.puddle(2.8, 0, -62, 3.4, 2, 23);   // melt water pooled under the slit
  d.puddle(-24, 0, 18, 5, 3, 24);
  for (const [x, z] of [[16, -60], [-16, 30], [40, -30], [-40, 0], [16, 0]]) d.weeds(x + 2.4, 0, z + 1.5, 1.1, x * 7 + z, 30);
  d.flush();
}

// ---------------------------------------------------------------- light
RectAreaLightUniformsLib.init();
const ambient = new THREE.HemisphereLight(0xdce5e8, 0x383a3a, 1.3); scene.add(ambient);
const interiorFill = new THREE.DirectionalLight(0xc7d1d1, 0.5);
interiorFill.position.set(-35, 20, -28); scene.add(interiorFill);
// Soft light falling from the slit.
const slotLights: THREE.RectAreaLight[] = [];
{
  const l = new THREE.RectAreaLight(0xe4ecec, 5, SLIT, 160);
  l.position.set(0, H - 0.5, 0); l.lookAt(0, 0, 0);
  scene.add(l); slotLights.push(l);
}

const composer = aoComposer(renderer, scene, camera, 2.2, 0.85);

// ---------------------------------------------------------------- interaction
let yaw = 0, pitch = 0, dragging = false, lastX = 0, lastY = 0;
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (event) => { dragging = true; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointerup', () => { dragging = false; }); canvas.addEventListener('pointercancel', () => { dragging = false; });
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  yaw -= (event.clientX - lastX) * 0.004; pitch = THREE.MathUtils.clamp(pitch - (event.clientY - lastY) * 0.004, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
  lastX = event.clientX; lastY = event.clientY; camera.rotation.set(pitch, yaw, 0);
});
(window as unknown as { __setView: (y: number, p: number, f?: number) => void }).__setView = (y, p, f) => { yaw = y; pitch = p; camera.rotation.set(pitch, yaw, 0); if (f) { camera.fov = f; camera.updateProjectionMatrix(); } };

const fogInput = document.querySelector<HTMLInputElement>('#fog')!; const lightInput = document.querySelector<HTMLInputElement>('#light')!;
const fogValue = document.querySelector<HTMLOutputElement>('#fog-value')!; const lightValue = document.querySelector<HTMLOutputElement>('#light-value')!;
fogInput.addEventListener('input', () => { const value = Number(fogInput.value); (scene.fog as THREE.FogExp2).density = value; fogValue.textContent = value.toFixed(3); });
lightInput.addEventListener('input', () => {
  const value = Number(lightInput.value);
  ambient.intensity = value; interiorFill.intensity = value * 0.385;
  for (const l of slotLights) l.intensity = value * 5;
  lightValue.textContent = value.toFixed(1);
});
const panel = document.querySelector<HTMLElement>('aside')!; const show = document.querySelector<HTMLButtonElement>('#show')!;
document.querySelector<HTMLButtonElement>('#next')!.addEventListener('click', () => { window.location.href = '/classic-002.html'; });
document.querySelector<HTMLButtonElement>('#hide')!.addEventListener('click', () => { panel.hidden = true; show.hidden = false; }); show.addEventListener('click', () => { panel.hidden = false; show.hidden = true; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
// Snow drifting down through the light slit.
const snowfall = [addSnow(scene, camera, renderer, {
  box: [SLIT - 1, 150], spread: 5, center: new THREE.Vector3(0, H / 2, 0), height: H,
  count: 18000, size: 0.05, speed: 1.4, innerRadius: 1.5, opacity: 0.9, fog: 0.02,
})];
const clock = new THREE.Clock();
function animate() { requestAnimationFrame(animate); const dt = Math.min(clock.getDelta(), 0.1); eye.update(dt, clock.elapsedTime); snowfall.forEach((s) => s.update()); composer.render(); } animate();
