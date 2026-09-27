// Studio for render-products.mjs: a product on an invisible shadow-catching floor in front of a
// flat light-grey backdrop, lit by a room environment (reflections, fill) plus a large key light
// and a soft overhead light. Every frame jitters both lights across an area and the camera by a
// sub-pixel; averaging `samples` frames yields soft area shadows and clean anti-aliasing.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import * as kit from "./kit.js";

const BACKDROP = "#e4e4e2";

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;

const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;

window.glInfo = () => {
  const gl = renderer.getContext();
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
};

function halton(index, base) {
  let f = 1;
  let r = 0;
  for (let i = index; i > 0; i = Math.floor(i / base)) {
    f /= base;
    r += f * (i % base);
  }
  return r;
}

const toRad = THREE.MathUtils.degToRad;
const fromSpherical = (azimuth, elevation, distance) =>
  new THREE.Vector3().setFromSphericalCoords(distance, toRad(90 - elevation), toRad(azimuth));

/** World-space vertex sample of every mesh (for framing on the silhouette, not the bbox). */
function samplePoints(object, limit = 40000) {
  const meshes = [];
  object.traverse((o) => o.isMesh && meshes.push(o));
  const total = meshes.reduce((n, m) => n + m.geometry.attributes.position.count, 0);
  const stride = Math.max(1, Math.floor(total / limit));
  const points = [];
  const v = new THREE.Vector3();
  for (const mesh of meshes) {
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += stride) points.push(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).clone());
  }
  return points;
}

/** Place the camera at azimuth/elevation so the silhouette is centred and spans `fill` of the frame. */
function frame(camera, object, { azimuth, elevation, fill }) {
  const box = new THREE.Box3().setFromObject(object);
  const target = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  let distance = radius / Math.sin(toRad(camera.fov / 2));
  const points = samplePoints(object);
  const ndc = new THREE.Vector3();
  for (let pass = 0; pass < 8; pass++) {
    camera.position.copy(target).add(fromSpherical(azimuth, elevation, distance));
    camera.lookAt(target);
    camera.updateMatrixWorld();
    let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const p of points) {
      ndc.copy(p).project(camera);
      minX = Math.min(minX, ndc.x);
      maxX = Math.max(maxX, ndc.x);
      minY = Math.min(minY, ndc.y);
      maxY = Math.max(maxY, ndc.y);
    }
    const extent = Math.max(maxX - minX, maxY - minY) / 2;
    // Shift the target by the off-centre amount (in world units at the target's depth).
    const worldPerNdc = distance * Math.tan(toRad(camera.fov / 2));
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    target.addScaledVector(right, ((minX + maxX) / 2) * worldPerNdc);
    target.addScaledVector(up, ((minY + maxY) / 2) * worldPerNdc);
    distance *= extent / fill;
  }
  camera.position.copy(target).add(fromSpherical(azimuth, elevation, distance));
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return { target, distance, radius };
}

function makeLight(intensity, radius, center) {
  const light = new THREE.DirectionalLight(0xffffff, intensity);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  const cam = light.shadow.camera;
  cam.left = cam.bottom = -radius * 1.6;
  cam.right = cam.top = radius * 1.6;
  cam.near = 0.01;
  cam.far = radius * 12;
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = radius * 0.004;
  light.target.position.copy(center);
  return light;
}

function dispose(object) {
  object.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of [o.material].flat()) {
      for (const value of Object.values(m)) if (value?.isTexture) value.dispose();
      m.dispose();
    }
  });
}

window.renderProduct = async ({ slug, seed, size, samples }) => {
  const { default: build } = await import(`./products/${slug}.js`);
  const spec = await build({ THREE, kit, rng: kit.rng(seed), seed });
  const view = { azimuth: 35, elevation: 22, fov: 26, fill: 0.74, ...spec.camera };
  const lighting = { keyAzimuth: -50, keyElevation: 52, key: 2.4, top: 1.0, env: 0.9, shadow: 0.55, softness: 0.24, ...spec.lighting };

  const scene = new THREE.Scene();
  scene.environment = environment;
  scene.environmentIntensity = lighting.env;
  scene.environmentRotation.y = toRad(lighting.envRotation ?? 0);

  const product = spec.object;
  scene.add(product);
  product.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(product);
  const center = box.getCenter(new THREE.Vector3());
  product.position.x -= center.x;
  product.position.z -= center.z;
  product.position.y -= box.min.y;
  product.updateMatrixWorld(true);
  product.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.userData.castShadow ?? true;
      o.receiveShadow = true;
    }
  });

  const camera = new THREE.PerspectiveCamera(view.fov, 1, 0.01, 1000);
  const { target, distance, radius } = frame(camera, product, view);
  camera.near = distance / 50;
  camera.far = distance * 10;
  camera.updateProjectionMatrix();

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(radius * 60, radius * 60), new THREE.ShadowMaterial({ opacity: lighting.shadow }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const lightCenter = new THREE.Vector3(0, box.getSize(new THREE.Vector3()).y / 2, 0);
  const keyBase = fromSpherical(view.azimuth + lighting.keyAzimuth, lighting.keyElevation, radius * 6);
  const topBase = fromSpherical(view.azimuth + 20, 84, radius * 6);
  const key = makeLight(lighting.key, radius, lightCenter);
  const top = makeLight(lighting.top, radius, lightCenter);
  scene.add(key, key.target, top, top.target);
  for (const extra of spec.lights ?? []) scene.add(extra);

  renderer.setSize(size, size, false);
  renderer.setClearColor(new THREE.Color(BACKDROP), 1);
  renderer.toneMappingExposure = lighting.exposure ?? 1;
  const rtOptions = { type: THREE.HalfFloatType, depthBuffer: true, samples: 0 };
  const frameTarget = new THREE.WebGLRenderTarget(size, size, rtOptions);
  const accumTarget = new THREE.WebGLRenderTarget(size, size, { ...rtOptions, depthBuffer: false });
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadScene = new THREE.Scene();
  const blend = new THREE.MeshBasicMaterial({ map: frameTarget.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blend);
  quadScene.add(quad);

  // Offset a light perpendicular to its direction by a point on a disk (area-light sampling).
  const jitter = (light, base, spread, i) => {
    const dir = base.clone().normalize();
    const u = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0.001)).normalize();
    const v = new THREE.Vector3().crossVectors(dir, u);
    const r = Math.sqrt(halton(i, 2)) * spread;
    const a = halton(i, 3) * Math.PI * 2;
    light.position.copy(lightCenter).add(base).addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r);
  };

  for (let i = 0; i < samples; i++) {
    jitter(key, keyBase, radius * 6 * lighting.softness, i + 1);
    jitter(top, topBase, radius * 6 * lighting.softness * 1.6, i + 7);
    camera.setViewOffset(size, size, halton(i + 1, 5) - 0.5, halton(i + 1, 7) - 0.5, size, size);
    renderer.setRenderTarget(frameTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(accumTarget);
    renderer.autoClear = false;
    blend.opacity = 1 / (i + 1);
    renderer.render(quadScene, quadCamera);
    renderer.autoClear = true;
  }

  renderer.setRenderTarget(null);
  quad.material = new THREE.MeshBasicMaterial({ map: accumTarget.texture, toneMapped: true, depthTest: false });
  renderer.render(quadScene, quadCamera);
  const dataUrl = canvas.toDataURL("image/png");

  frameTarget.dispose();
  accumTarget.dispose();
  quad.geometry.dispose();
  blend.dispose();
  quad.material.dispose();
  floor.geometry.dispose();
  floor.material.dispose();
  key.shadow.dispose();
  top.shadow.dispose();
  dispose(product);

  return {
    dataUrl,
    meta: { variant: spec.variant, camera: { azimuth: view.azimuth, elevation: view.elevation, fov: view.fov, target: target.toArray().map((n) => +n.toFixed(4)) }, alt: spec.alt },
  };
};
