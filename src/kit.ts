// Shared Concrete World toolkit: surface detail shader, geometry batching, small architectural parts
// and the ambient-occlusion post stack. Used by Scene 001 and Scene 003.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// ---------------------------------------------------------------- textures
const loader = new THREE.TextureLoader();
export function tex(path: string, color = false) {
  const t = loader.load(path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- surface detail
// World-space detail added on top of a standard material: precast panel joints, formwork tie holes,
// rain/seepage streaks starting under every 4.5 m line, broad tonal patches, grime near the floor.
const DETAIL_GLSL = /* glsl */ `
varying vec3 vCwPos; varying vec3 vCwN;
uniform float uJoints; uniform float uStreaks; uniform float uFloorY; uniform vec2 uCyl; uniform float uWeather;
float cwH(float x){ return fract(sin(x*127.1)*43758.5453); }
float cwN1(float x){ float i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); return mix(cwH(i), cwH(i+1.0), f); }
float cwH2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float cwN2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(cwH2(i), cwH2(i+vec2(1.,0.)), f.x), mix(cwH2(i+vec2(0.,1.)), cwH2(i+vec2(1.,1.)), f.x), f.y); }
float cwFbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * cwN2(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }
// Damp patch from a signed field f (metres, > 0 is wet): crisp tide line plus a faint efflorescence halo.
vec3 cwTide(float f){
  float damp = smoothstep(-0.025, 0.025, f);
  float rim = 1.0 - smoothstep(0.0, 0.05, abs(f));
  float halo = smoothstep(-0.3, -0.04, f) * (1.0 - damp);
  return vec3(damp, rim, halo);
}
`;
export interface DetailOpts { joints?: number; streaks?: number; floorY?: number; cyl?: [number, number]; weather?: number }
export function detailed<T extends THREE.MeshStandardMaterial>(mat: T, o: DetailOpts = {}): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uJoints = { value: o.joints ?? 1 };
    shader.uniforms.uStreaks = { value: o.streaks ?? 1 };
    shader.uniforms.uFloorY = { value: o.floorY ?? 0 };
    shader.uniforms.uCyl = { value: new THREE.Vector2(...(o.cyl ?? [0, 0])) };
    shader.uniforms.uWeather = { value: o.weather ?? 1 };
    shader.vertexShader = 'varying vec3 vCwPos; varying vec3 vCwN;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n vec4 cwW = modelMatrix * vec4(transformed, 1.0); vCwPos = cwW.xyz; vCwN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = (o.cyl ? '#define CW_CYL\n' : '') + DETAIL_GLSL + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    {
      vec3 an = abs(normalize(vCwN));
      float dist = length(vViewPosition);
      float near = 1.0 - smoothstep(70.0, 200.0, dist);
      float close = 1.0 - smoothstep(12.0, 45.0, dist);
      vec2 big = an.y > 0.5 ? vCwPos.xz : (an.x > an.z ? vCwPos.zy : vCwPos.xy);
      vec3 tint = vec3(mix(0.86, 1.06, cwN2(big * 0.05)) * mix(0.93, 1.03, cwN2(big * 0.45)));
      float rust = 0.0;
      const vec3 DAMP = vec3(0.64, 0.62, 0.575);      // wet concrete: darker and slightly warm
      if (an.y < 0.5) {
        #ifdef CW_CYL
          vec2 rel = vCwPos.xz - uCyl;
          vec2 p = vec2(atan(rel.x, -rel.y) * length(rel), vCwPos.y);
        #else
          vec2 p = an.x > an.z ? vCwPos.zy : vCwPos.xy;
        #endif
        // precast panel joints and formwork tie holes
        vec2 g = p / vec2(3.0, 1.5);
        vec2 fd = min(fract(g), 1.0 - fract(g)) * vec2(3.0, 1.5);
        float joint = 1.0 - smoothstep(0.012, 0.045, min(fd.x, fd.y));
        tint *= 1.0 - 0.3 * joint * near * uJoints;
        vec2 th = (fract(p / 0.75) - 0.5) * 0.75;
        float hole = 1.0 - smoothstep(0.028, 0.048, length(th));
        tint *= 1.0 - 0.45 * hole * near * uJoints;
        // seepage streaks under every 4.5 m line
        float below = fract((0.0 - vCwPos.y) / 4.5);
        float col = cwN1(p.x * 1.7) * cwN1(p.x * 0.31 + 7.0);
        float streak = smoothstep(0.18, 0.7, col) * exp(-below * 2.2) * (0.55 + 0.45 * cwN2(vec2(p.x * 3.0, vCwPos.y * 0.25)));
        tint *= mix(vec3(1.0), DAMP, 0.75 * streak * uStreaks);
        // damp washes hanging from each ledge line: length varies along the wall, ragged lower edge
        float lvl = floor(vCwPos.y / 4.5);
        float d = below * 4.5;                                              // metres below the line above
        float Lx = max(0.0, 5.0 * cwFbm(vec2(p.x * 0.09, lvl * 3.7)) - 2.0);
        float jag = (cwFbm(vec2(p.x * 0.8, vCwPos.y * 0.5)) - 0.5) * 1.1 + (cwN2(vec2(p.x * 3.5, vCwPos.y * 1.5)) - 0.5) * 0.25;
        vec3 tide = cwTide(Lx + jag * step(0.01, Lx) - d);
        float inner = tide.x * mix(0.45, 1.0, exp(-d * 0.35)) * mix(0.75, 1.0, cwN2(p * 1.1));
        tint *= mix(vec3(1.0), DAMP, inner * uWeather);
        tint *= 1.0 - 0.22 * tide.y * near * uWeather;
        tint *= 1.0 + 0.08 * tide.z * uWeather;
        // rust bleeding from a few tie holes
        vec2 hc = floor(p / 0.75);
        for (int k = 0; k < 4; k++) {
          vec2 c = hc + vec2(0.0, float(k));
          float pick = cwH2(c * 1.37 + 3.1);
          if (pick > 0.86) {
            vec2 hp = (c + 0.5) * 0.75;
            float len = 0.4 + 2.6 * cwH2(c + 11.0);
            float dy = hp.y - p.y;
            float w = 0.016 + 0.035 * clamp(dy / len, 0.0, 1.0);
            float dx = abs(p.x - hp.x + 0.02 * sin(p.y * 7.0 + pick * 20.0));
            float s = (1.0 - smoothstep(w * 0.5, w, dx)) * step(0.0, dy) * (1.0 - smoothstep(len * 0.3, len, dy));
            s = max(s, (1.0 - smoothstep(0.04, 0.09, length(p - hp))) * 0.8);
            rust = max(rust, s * (0.55 + 0.45 * cwN2(vec2(p.x * 20.0, p.y * 3.0))) * uJoints);
          }
        }
        // rust dripping from steel at ledge lines (rails, sills, fixings)
        float cx = floor(p.x / 0.9);
        float pk = cwH(cx * 3.7 + 1.3);
        if (pk > 0.8) {
          float xc = (cx + 0.5) * 0.9 + (cwH(cx) - 0.5) * 0.5;
          float L = 0.6 + 2.4 * cwH(cx + 7.0), dy = below * 4.5;
          float w = 0.03 + 0.05 * clamp(dy / L, 0.0, 1.0);
          rust = max(rust, (1.0 - smoothstep(w * 0.5, w, abs(p.x - xc))) * (1.0 - smoothstep(L * 0.4, L, dy)) * 0.75);
        }
        // pitting (bug holes) visible up close
        vec2 pc = floor(p * 14.0); vec2 pf = fract(p * 14.0) - 0.5;
        float pit = step(0.93, cwH2(pc)) * (1.0 - smoothstep(0.12, 0.3, length(pf)));
        tint *= 1.0 - 0.35 * pit * close;
        // grime rising from the ground
        tint *= mix(0.78, 1.0, smoothstep(0.0, 6.0, vCwPos.y - uFloorY));
      } else {
        // horizontal surfaces: occasional dried puddle marks with tide lines
        vec2 q = vCwPos.xz * 0.08;
        float warp = cwFbm(q * 1.3 + 2.0);
        float field = (cwFbm(q + warp * 0.8) + 0.08 * cwN2(big * 0.015) - 0.66) * 12.0;
        vec3 tide = cwTide(field);
        tint *= mix(vec3(1.0), DAMP * 1.08, tide.x * mix(0.5, 0.85, cwN2(vCwPos.xz * 0.7)) * uWeather);
        tint *= 1.0 - 0.16 * tide.y * near * uWeather;
        tint *= 1.0 + 0.05 * tide.z * uWeather;
        vec2 pc = floor(vCwPos.xz * 12.0); vec2 pf = fract(vCwPos.xz * 12.0) - 0.5;
        tint *= 1.0 - 0.3 * step(0.95, cwH2(pc)) * (1.0 - smoothstep(0.12, 0.3, length(pf))) * close;
      }
      diffuseColor.rgb *= tint;
      vec3 rustCol = diffuseColor.rgb * vec3(1.18, 0.66, 0.4);
      diffuseColor.rgb = mix(diffuseColor.rgb, rustCol, clamp(rust * near * uWeather, 0.0, 1.0));
    }`);
  };
  mat.customProgramCacheKey = () => `cw-${o.joints ?? 1}-${o.streaks ?? 1}-${o.floorY ?? 0}-${o.cyl ? 'c' : 'p'}-${o.weather ?? 1}`;
  return mat;
}

// ---------------------------------------------------------------- batching
// Many small parts are merged into one mesh per material: a few draw calls, any amount of detail.
const UP = new THREE.Vector3(0, 1, 0);
export class Batch {
  private groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  constructor(public tile = 9) {}
  push(geo: THREE.BufferGeometry, mat: THREE.Material) {
    if (!this.groups.has(mat)) this.groups.set(mat, []);
    this.groups.get(mat)!.push(geo);
  }
  private worldUV(geo: THREE.BoxGeometry, w: number, h: number, d: number, seed: number) {
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * size[f][0] / this.tile + seed * 0.37, uv.getY(i) * size[f][1] / this.tile + seed * 0.23);
    }
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) {
    const geo = new THREE.BoxGeometry(w, h, d);
    this.worldUV(geo, w, h, d, x * 0.031 + y * 0.017 + z * 0.023);
    geo.translate(x, y, z);
    this.push(geo, mat);
  }
  // A rectangular member from a to b; `width` stays horizontal, `thick` is perpendicular to it.
  slab(a: THREE.Vector3, b: THREE.Vector3, width: number, thick: number, mat: THREE.Material) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const yAxis = dir.clone().normalize();
    let xAxis = new THREE.Vector3().crossVectors(yAxis, UP);
    if (xAxis.lengthSq() < 1e-6) xAxis = new THREE.Vector3(1, 0, 0);
    xAxis.normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    const geo = new THREE.BoxGeometry(width, len, thick);
    this.worldUV(geo, width, len, thick, a.x * 0.03 + a.z * 0.05);
    geo.applyMatrix4(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    const mid = a.clone().add(b).multiplyScalar(0.5);
    geo.translate(mid.x, mid.y, mid.z);
    this.push(geo, mat);
  }
  // Steel guard rail between two points at deck level (works on slopes too).
  rail(a: THREE.Vector3, b: THREE.Vector3, mat: THREE.Material, height = 1.05, spacing = 1.6) {
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.round(len / spacing));
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      this.box(p.x, p.y + height / 2, p.z, 0.05, height, 0.05, mat);
    }
    const lift = (v: THREE.Vector3, h: number) => v.clone().add(new THREE.Vector3(0, h, 0));
    this.slab(lift(a, height), lift(b, height), 0.06, 0.06, mat);
    this.slab(lift(a, height * 0.5), lift(b, height * 0.5), 0.035, 0.035, mat);
  }
  // Box rotated about Y (rotY in radians), e.g. a fin facing a curve's centre.
  boxRot(x: number, y: number, z: number, w: number, h: number, d: number, rotY: number, mat: THREE.Material) {
    const geo = new THREE.BoxGeometry(w, h, d);
    this.worldUV(geo, w, h, d, x * 0.031 + y * 0.017 + z * 0.023);
    geo.rotateY(rotY);
    geo.translate(x, y, z);
    this.push(geo, mat);
  }
  // Solid annular sector. Angle convention: φ = 0 points to -z, positive φ turns toward +x.
  // Point on the circle: (cx + sin φ · r, cz − cos φ · r).
  arc(cx: number, cz: number, r0: number, r1: number, a0: number, a1: number, y0: number, y1: number, mat: THREE.Material, maxChord = 2.5) {
    const n = Math.max(6, Math.ceil((Math.abs(a1 - a0) * r1) / maxChord));
    const pos: number[] = [], nor: number[] = [], uv: number[] = [];
    const T = this.tile;
    const P = (r: number, a: number, y: number) => [cx + Math.sin(a) * r, y, cz - Math.cos(a) * r];
    const quad = (A: number[], B: number[], C: number[], D: number[], N: number[] | ((p: number[]) => number[]), UVs: number[][]) => {
      // Fix winding so the front face always agrees with the supplied normal.
      const nA = typeof N === 'function' ? N(A) : N;
      const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const order: [number, number[]][] = cr[0] * nA[0] + cr[1] * nA[1] + cr[2] * nA[2] >= 0
        ? [[0, A], [1, B], [2, C], [0, A], [2, C], [3, D]]
        : [[0, A], [2, C], [1, B], [0, A], [3, D], [2, C]];
      for (const [i, v] of order) {
        pos.push(...v);
        const nn = typeof N === 'function' ? N(v) : N; nor.push(...nn);
        uv.push(UVs[i][0], UVs[i][1]);
      }
    };
    const radial = (sgn: number) => (v: number[]) => { const dx = v[0] - cx, dz = v[2] - cz, l = Math.hypot(dx, dz) || 1; return [sgn * dx / l, 0, sgn * dz / l]; };
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
      const lo = Math.min(t0, t1), hi = Math.max(t0, t1);
      // outer wall (faces away from centre)
      quad(P(r1, lo, y0), P(r1, hi, y0), P(r1, hi, y1), P(r1, lo, y1), radial(1),
        [[lo * r1 / T, y0 / T], [hi * r1 / T, y0 / T], [hi * r1 / T, y1 / T], [lo * r1 / T, y1 / T]]);
      // inner wall (faces the centre)
      quad(P(r0, hi, y0), P(r0, lo, y0), P(r0, lo, y1), P(r0, hi, y1), radial(-1),
        [[hi * r0 / T, y0 / T], [lo * r0 / T, y0 / T], [lo * r0 / T, y1 / T], [hi * r0 / T, y1 / T]]);
      // top and bottom
      const top = [P(r0, lo, y1), P(r0, hi, y1), P(r1, hi, y1), P(r1, lo, y1)];
      quad(top[0], top[3], top[2], top[1], [0, 1, 0], [top[0], top[3], top[2], top[1]].map((v) => [v[0] / T, v[2] / T]));
      const bot = [P(r0, lo, y0), P(r0, hi, y0), P(r1, hi, y0), P(r1, lo, y0)];
      quad(bot[0], bot[1], bot[2], bot[3], [0, -1, 0], bot.map((v) => [v[0] / T, v[2] / T]));
    }
    // end caps
    for (const [a, sgn] of [[Math.min(a0, a1), -1], [Math.max(a0, a1), 1]] as [number, number][]) {
      const tn = [sgn * Math.cos(a), 0, sgn * Math.sin(a)];
      const A = P(r0, a, y0), B = P(r1, a, y0), C = P(r1, a, y1), D = P(r0, a, y1);
      const uvs = [[r0 / T, y0 / T], [r1 / T, y0 / T], [r1 / T, y1 / T], [r0 / T, y1 / T]];
      if (sgn > 0) quad(A, B, C, D, tn, uvs); else quad(B, A, D, C, tn, [uvs[1], uvs[0], uvs[3], uvs[2]]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    this.pushNonIndexed(geo, mat);
  }
  // Vertical cylinder with world-scaled UVs.
  cylinder(x: number, y0: number, z: number, r: number, h: number, mat: THREE.Material, segs = 64) {
    const geo = new THREE.CylinderGeometry(r, r, h, segs, 1, true);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (2 * Math.PI * r) / this.tile, uv.getY(i) * h / this.tile);
    geo.translate(x, y0 + h / 2, z);
    this.push(geo, mat);
    // caps with world-space UVs (no radial stretching)
    this.disc(x, z, r, y0 + h, mat, 1);
    this.disc(x, z, r, y0, mat, -1);
  }
  disc(x: number, z: number, r: number, y: number, mat: THREE.Material, up: 1 | -1) {
    const geo = new THREE.CircleGeometry(r, 96);
    geo.rotateX(up > 0 ? -Math.PI / 2 : Math.PI / 2);
    geo.translate(x, y, z);
    const p = geo.attributes.position as THREE.BufferAttribute, uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / this.tile, p.getZ(i) / this.tile);
    this.push(geo, mat);
  }
  // Ribbon window following a curve. side = +1 on a convex (outer) face, -1 on a concave (inner) face.
  curvedRibbon(cx: number, cz: number, rFace: number, side: 1 | -1, a0: number, a1: number, y0: number, glass: THREE.Material, frame: THREE.Material, steel: THREE.Material, H = 1.8) {
    const off = (d: number) => rFace + side * d;
    const span = (rA: number, rB: number) => [Math.min(rA, rB), Math.max(rA, rB)] as const;
    const g = span(off(0.01), off(0.05)); this.arc(cx, cz, g[0], g[1], a0, a1, y0, y0 + H, glass);
    const s = span(off(-0.05), off(0.45)); this.arc(cx, cz, s[0], s[1], a0 - 0.004, a1 + 0.004, y0 - 0.2, y0, frame);
    const h = span(off(-0.05), off(0.28)); this.arc(cx, cz, h[0], h[1], a0, a1, y0 + H, y0 + H + 0.28, frame);
    const t = span(off(0.03), off(0.09)); this.arc(cx, cz, t[0], t[1], a0, a1, y0 + 1.17, y0 + 1.23, steel);
    const n = Math.max(2, Math.round((Math.abs(a1 - a0) * rFace) / 1.25));
    for (let i = 1; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n, r = off(0.06);
      this.boxRot(cx + Math.sin(a) * r, y0 + H / 2, cz - Math.cos(a) * r, 0.07, H, 0.08, -a, steel);
    }
    for (const a of [a0, a1]) { const r = off(0.14); this.boxRot(cx + Math.sin(a) * r, y0 + H / 2, cz - Math.cos(a) * r, 0.24, H, 0.28, -a, frame); }
  }
  // Guard rail along an arc at deck height yDeck.
  railArc(cx: number, cz: number, r: number, a0: number, a1: number, yDeck: number, mat: THREE.Material, height = 1.05) {
    const n = Math.max(2, Math.round((Math.abs(a1 - a0) * r) / 1.7));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      this.boxRot(cx + Math.sin(a) * r, yDeck + height / 2, cz - Math.cos(a) * r, 0.05, height, 0.05, -a, mat);
    }
    this.arc(cx, cz, r - 0.03, r + 0.03, a0, a1, yDeck + height - 0.03, yDeck + height + 0.03, mat, 2);
    this.arc(cx, cz, r - 0.02, r + 0.02, a0, a1, yDeck + height * 0.5 - 0.02, yDeck + height * 0.5 + 0.02, mat, 2);
  }
  private pushNonIndexed(geo: THREE.BufferGeometry, mat: THREE.Material) { this.push(geo, mat); }
  flush(scene: THREE.Scene, noShadow: THREE.Material[] = []) {
    for (const [mat, geos] of this.groups) {
      const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = !noShadow.includes(mat);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    this.groups.clear();
  }
}

// ---------------------------------------------------------------- post-processing
export function aoComposer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, radius = 2.5, intensity = 0.9, bloom?: { strength: number; radius: number; threshold: number }) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.updateGtaoMaterial({ radius, distanceExponent: 1.4, thickness: 3, scale: 1.2, samples: 16 });
  gtao.blendIntensity = intensity;
  if (location.search.includes('noao')) gtao.enabled = false;
  composer.addPass(gtao);
  // optional bloom: emissive lights get a soft halo and actually read as light sources
  if (bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), bloom.strength, bloom.radius, bloom.threshold));
  composer.addPass(new OutputPass());
  addEventListener('resize', () => composer.setSize(innerWidth, innerHeight));
  return composer;
}

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
