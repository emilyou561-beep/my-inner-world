// Gaussian-splat world viewer (worlds generated with World Labs Marble from each scene's panorama).
// Keeps the project's rules: fixed viewpoint, drag to look around, same UI and scene navigation.
import * as THREE from 'three';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { addSnow, type SnowOptions } from './snow';
import './style.css';

export interface WorldOptions {
  index: string;          // "001"
  title: string;          // "THE SILENT OBSERVER"
  splat: string;          // "./worlds/scene-001.spz"
  classic: string;        // "./classic-001.html"
  prev?: { label: string; href: string };
  next?: { label: string; href: string };
  pitch?: number;         // initial look angle (radians, + = up)
  height?: number;        // lift the viewpoint above the capture point (world units)
  snow?: SnowOptions | false; // falling snow layer (scene units of this world)
}

export function mountWorld(o: WorldOptions) {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('App root was not found.');
  const navButton = (id: string, label: string) => `<button id="${id}" type="button">${label}</button>`;
  app.innerHTML = `
    <div id="scene" aria-label="${o.title}"></div>
    <header><div class="eyebrow">CONCRETE WORLD / ${o.index}</div><h1>${o.title}</h1></header>
    <aside aria-label="Scene controls">
      <div class="panel-title">VIEW</div>
      <label for="fov">FIELD OF VIEW <output id="fov-value">70</output><input id="fov" type="range" min="40" max="100" step="1" value="70"></label>
      ${o.next ? navButton('next', o.next.label) : ''}
      ${o.prev ? navButton('prev', o.prev.label) : ''}
      ${navButton('classic', 'CLASSIC VIEW')}
      ${navButton('hide', 'HIDE UI')}
    </aside>
    <button id="show" type="button" hidden>SHOW UI</button>
    <div id="loading" class="loading">LOADING WORLD <span id="loading-pct"></span></div>`;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0f10);
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.15, 2000);
  const q = new URLSearchParams(location.search);
  camera.position.set(0, Number(q.get('h') ?? o.height ?? 0), 0); // Marble worlds are centred on the capture viewpoint
  camera.rotation.order = 'YXZ';

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  document.querySelector('#scene')!.appendChild(renderer.domElement);

  const spark = new SparkRenderer({ renderer });
  scene.add(spark);

  const pct = document.querySelector<HTMLSpanElement>('#loading-pct')!;
  const loading = document.querySelector<HTMLDivElement>('#loading')!;
  // No splat yet for this scene (or it failed to download) -> fall back to the classic procedural scene.
  fetch(o.splat, { method: 'HEAD' }).then((r) => {
    const type = r.headers.get('content-type') ?? '';
    if (!r.ok || type.includes('text/html')) location.replace(o.classic);
  }).catch(() => location.replace(o.classic));

  const world = new SplatMesh({
    url: o.splat,
    onProgress: (e: ProgressEvent) => { if (e.lengthComputable) pct.textContent = `${Math.round((e.loaded / e.total) * 100)}%`; },
    onLoad: () => { loading.hidden = true; },
  } as ConstructorParameters<typeof SplatMesh>[0]);
  if (new URLSearchParams(location.search).has("flip")) world.quaternion.set(1, 0, 0, 0);
  scene.add(world);
  (window as unknown as { __world: SplatMesh }).__world = world;

  // ---------------------------------------------------------------- look around (fixed viewpoint)
  let yaw = 0, pitch = Number(q.get('p') ?? o.pitch ?? 0), dragging = false, lastX = 0, lastY = 0;
  camera.rotation.set(pitch, yaw, 0);
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
  (window as unknown as { __setView: (y: number, p: number, f?: number) => void }).__setView = (y, p, f) => {
    yaw = y; pitch = p; camera.rotation.set(pitch, yaw, 0);
    if (f) { camera.fov = f; camera.updateProjectionMatrix(); }
  };

  // ---------------------------------------------------------------- UI
  const fov = document.querySelector<HTMLInputElement>('#fov')!;
  const fovValue = document.querySelector<HTMLOutputElement>('#fov-value')!;
  fov.addEventListener('input', () => { camera.fov = Number(fov.value); camera.updateProjectionMatrix(); fovValue.textContent = fov.value; });
  const go = (id: string, href?: string) => { if (href) document.querySelector<HTMLButtonElement>(`#${id}`)?.addEventListener('click', () => { location.href = href; }); };
  go('next', o.next?.href); go('prev', o.prev?.href); go('classic', o.classic);
  const panel = document.querySelector<HTMLElement>('aside')!;
  const show = document.querySelector<HTMLButtonElement>('#show')!;
  document.querySelector<HTMLButtonElement>('#hide')!.addEventListener('click', () => { panel.hidden = true; show.hidden = false; });
  show.addEventListener('click', () => { panel.hidden = false; show.hidden = true; });
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  const snow = o.snow === false ? null : addSnow(scene, camera, renderer, o.snow ?? {});
  renderer.setAnimationLoop(() => { snow?.update(); renderer.render(scene, camera); });
}
