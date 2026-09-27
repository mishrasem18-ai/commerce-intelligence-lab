// Portable SSD: a pocket-size rounded slab (anodised aluminium shell, soft-touch band or rugged
// bumper) with a USB-C port and activity LED, usually with its short USB-C cable. Units: cm.
const COLOURWAYS = [
  { name: "space-grey aluminium", shell: { metal: 0x6b6d72, roughness: 0.42 }, band: 0x1c1c1f, cable: 0x1a1a1c },
  { name: "deep-blue aluminium", shell: { metal: 0x2d4a86, roughness: 0.4 }, band: 0x15161a, cable: 0x1a1a1c },
  { name: "black with orange rugged bumper", shell: { plastic: 0x202124, roughness: 0.6 }, band: 0xe8742a, rugged: true, cable: 0x1a1a1c },
  { name: "silver aluminium", shell: { metal: 0xc7c8cc, roughness: 0.35 }, band: 0x2a2a2e, cable: 0xe8e8e8 },
];

export default function build({ THREE, kit, rng, seed }) {
  const c = COLOURWAYS[(seed - 1) % COLOURWAYS.length];
  const W = rng.range(5.4, 6.0);
  const L = rng.range(8.6, 9.6);
  const T = c.rugged ? 1.5 : rng.range(0.9, 1.05);
  const group = new THREE.Group();
  const random = kit.rng(seed * 31);

  // Anodised shell: brushed-aluminium micro-texture (noise stretched along the length).
  const brushed = new Float32Array(256 * 256);
  const n = kit.fbm(random, 256, 4, 3);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) brushed[y * 256 + x] = n[y * 256 + ((x * 7) % 256)] * 0.3 + random() * 0.05;
  const shellMaterial = c.shell.metal
    ? kit.metal(c.shell.metal, c.shell.roughness, { normalMap: kit.normalMap(brushed, 256, 0.6, 3), clearcoat: 0.2, clearcoatRoughness: 0.5 })
    : kit.rubber(c.shell.plastic, c.shell.roughness);

  const bandMaterial = c.rugged ? kit.rubber(c.band, 0.7) : kit.rubber(c.band, 0.65);
  if (c.rugged) {
    // Bumper frame all round, shell inset top and bottom.
    group.add(kit.mesh(kit.slab(W, L, T, { corner: 1.1, bevel: 0.45 }), bandMaterial));
    group.add(kit.mesh(kit.slab(W - 0.9, L - 0.9, T + 0.04, { corner: 0.7, bevel: 0.12 }), shellMaterial, { position: [0, -0.02, 0] }));
  } else {
    // Two shell halves with a soft-touch band in between.
    const half = (T - 0.22) / 2;
    group.add(kit.mesh(kit.slab(W, L, half, { corner: 0.9, bevel: 0.25 }), shellMaterial));
    group.add(kit.mesh(kit.slab(W - 0.08, L - 0.08, 0.26, { corner: 0.86, bevel: 0.02 }), bandMaterial, { position: [0, half - 0.02, 0] }));
    group.add(kit.mesh(kit.slab(W, L, half, { corner: 0.9, bevel: 0.25 }), shellMaterial, { position: [0, half + 0.22, 0] }));
  }

  // USB-C port on the short (+z) end: dark oval opening with a lighter tongue.
  const endZ = L / 2;
  const portShape = kit.roundedRectShape(0.9, 0.32, 0.16);
  const port = new THREE.ExtrudeGeometry(portShape, { depth: 0.06, bevelEnabled: false, curveSegments: 16 });
  group.add(kit.mesh(port, kit.plastic(0x050505, 0.6), { position: [0, T / 2, endZ - 0.03] }));
  group.add(kit.mesh(kit.roundedBox(0.62, 0.07, 0.04, 0.02, 2), kit.metal(0x9a9a9a, 0.3), { position: [0, T / 2, endZ + 0.02] }));
  // Activity LED on the top face.
  const led = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 24);
  group.add(kit.mesh(led, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7fd6ff, emissiveIntensity: 2 }), { position: [0, T + 0.005, endZ - 0.6] }));

  const withCable = seed !== 4;
  if (withCable) {
    const plugLen = 1.7;
    const plug = kit.roundedBox(1.25, 0.6, plugLen, 0.28, 5);
    const cableMaterial = kit.rubber(c.cable, 0.6);
    group.add(kit.mesh(plug, cableMaterial, { position: [0, T / 2, endZ + 0.25 + plugLen / 2] }));
    group.add(kit.mesh(kit.roundedBox(0.85, 0.28, 0.5, 0.13, 3), kit.metal(0xbfc0c4, 0.25), { position: [0, T / 2, endZ + 0.05] }));
    const neck = new THREE.CylinderGeometry(0.22, 0.26, 0.9, 32);
    group.add(kit.mesh(neck, cableMaterial, { position: [0, T / 2, endZ + 0.25 + plugLen + 0.4], rotation: [Math.PI / 2, 0, 0] }));
    // Cable lies on the floor: from the plug it drops and curls round in a loose loop.
    const y0 = T / 2;
    const start = endZ + 0.25 + plugLen + 0.8;
    const side = seed % 2 ? 1 : -1;
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, y0, start),
      new THREE.Vector3(0, y0 * 0.6, start + 1.2),
      new THREE.Vector3(side * 0.9, 0.2, start + 3.0),
      new THREE.Vector3(side * 3.4, 0.2, start + 4.3),
      new THREE.Vector3(side * 6.0, 0.2, start + 3.8),
      new THREE.Vector3(side * 7.4, 0.2, start + 2.0),
    ]);
    group.add(kit.mesh(new THREE.TubeGeometry(path, 240, 0.2, 20, false), cableMaterial));
    // Far plug, lying on the floor.
    const tip = path.getPoint(1);
    const dir = path.getTangent(1);
    const farPlug = kit.mesh(kit.roundedBox(1.25, 0.6, plugLen, 0.28, 5), cableMaterial);
    farPlug.position.copy(tip).addScaledVector(dir, plugLen / 2);
    farPlug.position.y = 0.3;
    farPlug.rotation.y = Math.atan2(dir.x, dir.z);
    group.add(farPlug);
    const tongue = kit.mesh(kit.roundedBox(0.85, 0.28, 0.7, 0.13, 3), kit.metal(0xbfc0c4, 0.25));
    tongue.position.copy(tip).addScaledVector(dir, plugLen + 0.3);
    tongue.position.y = 0.3;
    tongue.rotation.y = farPlug.rotation.y;
    group.add(tongue);
  }

  group.rotation.y = rng.range(-0.4, -0.1);
  return {
    object: group,
    variant: `${c.name}${withCable ? ", USB-C cable" : ""}`,
    camera: { azimuth: 30 + rng.range(-6, 6), elevation: 32, fill: 0.76 },
    alt: `Pocket-size ${c.name} portable SSD${withCable ? " with a USB-C cable" : ""} on a light grey background`,
  };
}
