// Falling snow, animated entirely on the GPU.
// Flakes live in a vertical cylinder centred on (center.x, center.z) and wrap from bottom to top,
// so a fixed viewpoint gets endless snowfall at constant cost. Works on top of splat worlds and
// on the classic mesh scenes (where the depth test lets walls hide flakes behind them).
import * as THREE from 'three';

export interface SnowOptions {
  center?: THREE.Vector3;   // middle of the snow volume (defaults to the camera position)
  radius?: number;          // horizontal radius of the volume (scene units)
  height?: number;          // vertical extent of the volume
  count?: number;           // number of flakes
  size?: number;            // flake size in scene units
  speed?: number;           // fall speed (scene units / second)
  wind?: [number, number];  // steady drift on x / z (scene units / second)
  innerRadius?: number;     // keep this close to the eye clear (avoids giant blurry flakes)
  opacity?: number;
  box?: [number, number];   // use a rectangular volume (width x, depth z) instead of a cylinder
  spread?: number;          // box only: extra width gained by the time flakes reach the bottom
  fog?: number;             // exponential distance fade (match the scene's FogExp2 density)
}

const vert = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime, uRadius, uInner, uHeight, uSize, uSpeed, uPx;
  uniform vec2 uWind, uBox;
  uniform float uSpread, uFog;
  uniform vec3 uCenter;
  varying float vAlpha;
  void main() {
    // place flake in an annulus (inner..outer radius), uniform by area
    float r = sqrt(mix(uInner * uInner, uRadius * uRadius, aSeed.x));
    float a = aSeed.z * 6.2831853;
    float fall = uSpeed * (0.65 + 0.7 * aSeed.w);
    float y = mod(aSeed.y * uHeight - uTime * fall, uHeight) - 0.5 * uHeight;
    vec3 p = uCenter + vec3(cos(a) * r, y, sin(a) * r);
    if (uBox.x > 0.0) {
      float t = 0.5 - y / uHeight;                       // 0 at the top, 1 at the bottom
      p = uCenter + vec3((aSeed.x - 0.5) * (uBox.x + uSpread * t), y, (aSeed.z - 0.5) * uBox.y);
    }
    // wind drift (wrapped back into the cylinder) + gentle per-flake flutter
    vec2 drift = uWind * uTime * (0.8 + 0.4 * aSeed.w);
    if (uBox.x > 0.0) p.x += sin(uTime * 0.3 + aSeed.w * 6.0) * uSpread * 0.15;
    else p.xz += drift - 2.0 * uRadius * floor((drift + uRadius) / (2.0 * uRadius));
    float ph = aSeed.w * 40.0 + uTime * (0.6 + aSeed.x);
    p.x += sin(ph) * uSize * 6.0;
    p.z += cos(ph * 0.83) * uSize * 6.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = -mv.z;
    float sz = uSize * (0.45 + 2.2 * aSeed.w * aSeed.w * aSeed.w);
    gl_PointSize = clamp(sz * uPx / max(d, 1e-3), 1.2, 64.0);
    // fade in near the eye, out at the edges of the volume and at its top/bottom
    float edge = uBox.x > 0.0 ? 1.0 : 1.0 - smoothstep(0.75, 1.0, length(p.xz - uCenter.xz) / uRadius);
    float cap = 1.0 - smoothstep(0.38, 0.5, abs(y) / uHeight);
    vAlpha = smoothstep(uInner * 0.6, uInner * 1.6, d) * edge * cap * exp(-uFog * uFog * d * d);
    gl_Position = projectionMatrix * mv;
  }`;

const frag = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float m = smoothstep(0.5, 0.0, length(c));
    m = m * m * (3.0 - 2.0 * m);
    float a = m * vAlpha * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vec3(0.93, 0.95, 0.98), a);
  }`;

export function addSnow(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, o: SnowOptions = {}) {
  const q = new URLSearchParams(location.search);
  const off = q.has('nosnow');
  const count = Math.round((o.count ?? 9000) * Number(q.get('snow') ?? 1));
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)); // placed in the shader
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const radius = o.radius ?? 20;
  const height = o.height ?? radius * 1.2;
  const uniforms = {
    uTime: { value: 0 },
    uRadius: { value: radius },
    uInner: { value: o.innerRadius ?? radius * 0.04 },
    uHeight: { value: height },
    uSize: { value: o.size ?? radius * 0.0025 },
    uSpeed: { value: o.speed ?? height * 0.06 },
    uWind: { value: new THREE.Vector2(...(o.wind ?? [radius * 0.01, radius * 0.004])) },
    uCenter: { value: (o.center ?? camera.position).clone() },
    uOpacity: { value: o.opacity ?? 0.85 },
    uPx: { value: 1 },
    uBox: { value: new THREE.Vector2(...(o.box ?? [0, 0])) },
    uSpread: { value: o.spread ?? 0 },
    uFog: { value: o.fog ?? 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, transparent: true, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 10; // after splats / opaque geometry
  points.visible = !off;
  scene.add(points);

  const px = new THREE.Vector2();
  const clock = new THREE.Clock();
  return {
    points,
    update() {
      uniforms.uTime.value = clock.getElapsedTime();
      // pixels per scene unit at distance 1: viewport height / (2 tan(fov/2))
      renderer.getDrawingBufferSize(px);
      uniforms.uPx.value = px.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    },
  };
}
