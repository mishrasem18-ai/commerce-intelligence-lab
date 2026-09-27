// Shared building blocks for the product scenes: seeded RNG, filleted lathe profiles, rounded
// slabs, PBR materials and procedural surface textures (all deterministic, no image files).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

export function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}

/**
 * Replace every interior corner of a polyline by a quadratic fillet. `points` are [x, y] pairs;
 * `radius` is a number or a per-point array (0 keeps the corner sharp).
 */
export function fillet(points, radius, segments = 10) {
  const out = [];
  const p = points.map(([x, y]) => new THREE.Vector2(x, y));
  for (let i = 0; i < p.length; i++) {
    const r = Array.isArray(radius) ? radius[i] : radius;
    if (i === 0 || i === p.length - 1 || !r) {
      out.push(p[i]);
      continue;
    }
    const a = p[i - 1].clone().sub(p[i]);
    const b = p[i + 1].clone().sub(p[i]);
    const ra = Math.min(r, a.length() / 2);
    const rb = Math.min(r, b.length() / 2);
    const start = p[i].clone().add(a.normalize().multiplyScalar(ra));
    const end = p[i].clone().add(b.normalize().multiplyScalar(rb));
    const curve = new THREE.QuadraticBezierCurve(start, p[i], end);
    out.push(...curve.getPoints(segments));
  }
  return out;
}

/** Solid of revolution around +Y from [radius, height] points (bottom → top), with fillets. */
export function lathe(points, { radius = 0, segments = 160, filletSegments = 10 } = {}) {
  const profile = fillet(points, radius, filletSegments).map((v) => new THREE.Vector2(Math.max(v.x, 0), v.y));
  const geometry = new THREE.LatheGeometry(profile, segments);
  geometry.computeVertexNormals();
  return mergeSeam(geometry);
}

function mergeSeam(geometry) {
  const merged = mergeVertices(geometry.deleteAttribute("normal"), 1e-5);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Squeeze tube body along +y: round (radius r0) at y = 0, easing into a flat lens of half-width
 * `flatHalf` at y = length, where a crimp seal closes it.
 */
export function squeezeTube(r0, length, flatHalf, seg = 160, rings = 120) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let j = 0; j <= rings; j++) {
    const v = j / rings;
    const f = Math.pow(v, 1.35);
    const s = 0.5 - 0.5 * Math.cos(Math.PI * f); // ease
    const a = r0 + (flatHalf - r0) * s;
    const b = r0 + (0.07 - r0) * s;
    // Round cross-section softens into a lens (pointed sides) as it flattens.
    const pinch = 1 + 1.6 * s;
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      const cx = Math.cos(t);
      const sy = Math.sin(t);
      const x = a * cx;
      const z = b * Math.sign(sy) * Math.pow(Math.abs(sy), pinch === 1 ? 1 : 1 / pinch + 0.35);
      positions.push(x, v * length, z);
      uvs.push(i / seg, v);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i;
      const b = a + seg + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export const roundedBox = (w, h, d, r, segments = 6) => new RoundedBoxGeometry(w, h, d, segments, r);

export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

/**
 * Flat slab with a rounded-rectangle footprint (w × d), `height` tall, edges rounded by `bevel`.
 * Sits on y = 0. `holes` are extra Paths cut through the slab (in footprint x/z, z flipped).
 */
export function slab(w, d, height, { corner = 0, bevel = 0, bevelSegments = 6, curveSegments = 24, holes = [] } = {}) {
  const shape = roundedRectShape(w - bevel * 2, d - bevel * 2, Math.max(corner - bevel, 0.0001));
  shape.holes.push(...holes);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(height - bevel * 2, 0.0001),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
    curveSegments,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevel, 0);
  return geometry;
}

// ---- materials -----------------------------------------------------------------------------

export const plastic = (color, roughness = 0.45, extra = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, clearcoat: extra.clearcoat ?? 0.15, clearcoatRoughness: 0.4, ...extra });

export const metal = (color, roughness = 0.3, extra = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 1, ...extra });

export const rubber = (color, roughness = 0.85, extra = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, sheen: 0.2, sheenRoughness: 0.8, ...extra });

export const glass = ({ color = 0xffffff, tint = 0xffffff, distance = 0.5, roughness = 0.04, thickness = 0.2, ior = 1.5, ...extra } = {}) =>
  new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness,
    transmission: 1,
    thickness,
    ior,
    attenuationColor: new THREE.Color(tint),
    attenuationDistance: distance,
    specularIntensity: 1,
    ...extra,
  });

// ---- procedural textures -------------------------------------------------------------------

/** Tileable value noise in [0, 1] on a `size` grid with `cells` lattice cells per side. */
export function valueNoise(random, size, cells) {
  const lattice = Array.from({ length: cells * cells }, () => random());
  const at = (x, y) => lattice[((y % cells + cells) % cells) * cells + ((x % cells + cells) % cells)];
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const fy = (y / size) * cells;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = (fx - ix) * (fx - ix) * (3 - 2 * (fx - ix));
      const ty = (fy - iy) * (fy - iy) * (3 - 2 * (fy - iy));
      const top = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx;
      const bottom = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx;
      out[y * size + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

/** Sum of octaves of value noise (tileable). */
export function fbm(random, size, baseCells, octaves = 4) {
  const out = new Float32Array(size * size);
  let amplitude = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const layer = valueNoise(random, size, baseCells << o);
    for (let i = 0; i < out.length; i++) out[i] += layer[i] * amplitude;
    total += amplitude;
    amplitude /= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Height field (Float32Array, size²) → tangent-space normal map texture. */
export function normalMap(height, size, strength = 1, repeat = 1) {
  const data = new Uint8Array(size * size * 4);
  const h = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  return dataTexture(data, size, repeat);
}

/** Scalar field in [0, 1] → greyscale texture (roughness / AO / bump maps). */
export function greyMap(field, size, lo = 0, hi = 1, repeat = 1) {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < field.length; i++) {
    const v = (lo + (hi - lo) * field[i]) * 255;
    data.set([v, v, v, 255], i * 4);
  }
  return dataTexture(data, size, repeat);
}

function dataTexture(data, size, repeat) {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Canvas-drawn colour texture (sRGB). */
export function canvasTexture(width, height, draw) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  draw(c.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Woven fabric height field: over/under threads with per-thread jitter plus fibre noise. */
export function weave(random, size, threads) {
  const fibre = fbm(random, size, 32, 3);
  const jitter = Array.from({ length: threads * 2 }, () => 0.8 + 0.4 * random());
  const out = new Float32Array(size * size);
  const period = size / threads;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / period);
      const cy = Math.floor(y / period);
      const u = (x % period) / period;
      const v = (y % period) / period;
      const warpUp = (cx + cy) % 2 === 0;
      const warp = Math.sin(Math.PI * u) * jitter[cx % threads];
      const weft = Math.sin(Math.PI * v) * jitter[threads + (cy % threads)];
      out[y * size + x] = (warpUp ? Math.max(warp, weft * 0.6) : Math.max(weft, warp * 0.6)) * 0.8 + fibre[y * size + x] * 0.2;
    }
  }
  return out;
}

/** Merge helper: a mesh with `material`, optional position/rotation/scale. */
export function mesh(geometry, material, { position, rotation, scale, castShadow } = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (position) m.position.set(...position);
  if (rotation) m.rotation.set(...rotation);
  if (scale) m.scale.set(...(Array.isArray(scale) ? scale : [scale, scale, scale]));
  if (castShadow === false) m.userData.castShadow = false;
  return m;
}

/** Straight-grain wood (canvas, sRGB): streaks along x, warped by noise, with fine pores. */
export function woodTexture(random, light, dark, width = 1024, height = 256) {
  const warp = fbm(random, 256, 4, 3);
  const pores = Array.from({ length: 900 }, () => [random(), random(), 0.2 + random() * 0.8]);
  const lines = Array.from({ length: 70 }, () => [random(), 0.3 + random() * 0.7]);
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);
    for (const [y0, strength] of lines) {
      ctx.strokeStyle = dark;
      ctx.globalAlpha = 0.08 + 0.22 * strength;
      ctx.lineWidth = 0.6 + strength * 2.2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const n = warp[Math.floor((y0 * 255 + 0) % 256) * 256 + Math.floor((x / w) * 255)];
        const y = (y0 + (n - 0.5) * 0.25) * h;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = dark;
    for (const [x, y, s] of pores) {
      ctx.globalAlpha = 0.15 * s;
      ctx.fillRect(x * w, y * h, 2 + s * 5, 0.8);
    }
    ctx.globalAlpha = 1;
  });
}
