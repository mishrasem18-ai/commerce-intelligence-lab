// Hair Oil: a Boston-round glass bottle, part-filled with golden oil, closed by a dropper
// (rubber bulb + ribbed collar) or a treatment pump. Units: cm.
const COLOURWAYS = [
  { name: "clear glass, golden oil, black dropper", tint: 0xfbfaf4, oil: 0xc98a1c, top: "dropper", collar: 0x1a1a1a, bulb: 0x141414 },
  { name: "amber glass, black dropper", tint: 0x8a4a0e, oil: 0x8e5207, top: "dropper", collar: 0x151515, bulb: 0x111111 },
  { name: "clear glass, golden oil, gold pump", tint: 0xfbfaf4, oil: 0xd39a2a, top: "pump", collar: 0xc9a86a, bulb: 0xf2f0ea },
  { name: "amber glass, gold collar, black bulb", tint: 0x93500f, oil: 0x8e5207, top: "dropper", collar: 0xc9a86a, bulb: 0x111111, collarMetal: true },
];

export default function build({ THREE, kit, rng, seed }) {
  const c = COLOURWAYS[(seed - 1) % COLOURWAYS.length];
  const R = rng.range(1.9, 2.1);
  const H = rng.range(6.6, 7.4);
  const neckR = 0.95;
  const neckTop = H + 1.4;
  const wall = 0.22;
  const group = new THREE.Group();

  const clear = c.tint === 0xfbfaf4;
  const glass = kit.glass({ tint: c.tint, distance: clear ? 30 : 1.6, roughness: 0.03, thickness: 0.6, ior: 1.52 });
  const bottle = kit.lathe(
    [
      [0, 0],
      [R, 0],
      [R, H],
      [neckR, H + 1.0],
      [neckR, neckTop],
      [neckR - wall, neckTop],
      [neckR - wall, H + 1.0],
      [R - wall, H - 0.1],
      [R - wall, 0.45],
      [0, 0.45],
    ],
    { radius: [0, 0.35, 1.1, 0.25, 0.05, 0.05, 0.25, 1.0, 0.3, 0] },
  );
  group.add(kit.mesh(bottle, glass));

  // Oil (opaque, glossy — seen through the glass), filled to ~70 % of the body.
  const fill = H * rng.range(0.62, 0.74);
  const oil = kit.lathe(
    [
      [0, 0.46],
      [R - wall - 0.01, 0.46],
      [R - wall - 0.01, fill],
      [0, fill],
    ],
    { radius: [0, 0.28, 0.05, 0] },
  );
  const oilMaterial = new THREE.MeshPhysicalMaterial({
    color: c.oil,
    roughness: 0.08,
    transmission: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    emissive: new THREE.Color(c.oil).multiplyScalar(0.05),
    sheen: 0.5,
    sheenColor: new THREE.Color(c.oil).offsetHSL(0, 0, 0.2),
  });
  group.add(kit.mesh(oil, oilMaterial, { castShadow: false }));

  const collarMaterial = c.collarMetal || c.top === "pump" ? kit.metal(c.collar, 0.25) : kit.plastic(c.collar, 0.5);
  const collarH = 1.6;
  const collar = kit.lathe(
    [
      [0, 0],
      [neckR + 0.22, 0],
      [neckR + 0.22, collarH],
      [0, collarH],
    ],
    { radius: [0, 0.06, 0.18, 0], segments: 480 },
  );
  // Grip ribs.
  const cp = collar.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    const z = cp.getZ(i);
    const y = cp.getY(i);
    if (Math.hypot(x, z) < neckR + 0.12 || y < 0.1 || y > collarH - 0.2) continue;
    const k = 1 + 0.035 * Math.max(0, Math.cos(Math.atan2(z, x) * 48));
    cp.setX(i, x * k);
    cp.setZ(i, z * k);
  }
  collar.computeVertexNormals();
  group.add(kit.mesh(collar, collarMaterial, { position: [0, neckTop - collarH + 0.35, 0] }));

  const topY = neckTop + 0.35;
  if (c.top === "dropper") {
    const bulb = kit.lathe(
      [
        [0, 0],
        [0.95, 0],
        [0.95, 0.35],
        [0.72, 0.5],
        [0.76, 1.9],
        [0.62, 2.7],
        [0, 2.95],
      ],
      { radius: [0, 0.05, 0.1, 0.12, 0.6, 0.5, 0] },
    );
    group.add(kit.mesh(bulb, kit.rubber(c.bulb, 0.55, { clearcoat: 0.2 }), { position: [0, topY, 0] }));
    // Glass pipette inside the oil.
    const pipette = kit.lathe(
      [
        [0, 0.6],
        [0.12, 0.62],
        [0.28, 1.6],
        [0.28, topY - 0.2],
        [0, topY - 0.2],
      ],
      { radius: [0, 0.05, 0.3, 0, 0] },
    );
    group.add(kit.mesh(pipette, kit.plastic(0xffffff, 0.1, { transparent: true, opacity: 0.25 }), { castShadow: false }));
  } else {
    const pump = new THREE.Group();
    const stem = kit.lathe([[0, 0], [0.25, 0], [0.25, 0.9], [0, 0.9]], { radius: [0, 0, 0.05, 0] });
    pump.add(kit.mesh(stem, kit.plastic(c.bulb, 0.35)));
    const head = kit.roundedBox(1.2, 0.95, 1.2, 0.35);
    pump.add(kit.mesh(head, kit.plastic(c.bulb, 0.3), { position: [0, 1.35, 0] }));
    const nozzle = kit.lathe([[0, 0], [0.2, 0], [0.2, 1.5], [0, 1.5]], { radius: [0, 0, 0.1, 0] });
    pump.add(kit.mesh(nozzle, kit.plastic(c.bulb, 0.3), { position: [0, 1.45, 0.3], rotation: [Math.PI / 2, 0, 0] }));
    pump.rotation.y = rng.range(0.4, 0.9);
    pump.position.y = topY;
    group.add(pump);
    const tube = kit.lathe([[0, 0.5], [0.15, 0.5], [0.15, topY], [0, topY]]);
    group.add(kit.mesh(tube, kit.plastic(0xf4f4f0, 0.2, { transparent: true, opacity: 0.5 }), { castShadow: false }));
  }

  return {
    object: group,
    variant: c.name,
    camera: { azimuth: 30 + rng.range(-10, 10), elevation: 12, fill: 0.7 },
    lighting: { key: 2.2, env: 1.0 },
    alt: `${clear ? "Clear" : "Amber"} glass hair oil bottle with a ${c.top === "pump" ? "pump" : "dropper"} top, filled with golden oil, on a light grey background`,
  };
}
