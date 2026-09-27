// Night Cream: a thick-walled cosmetic cream jar with a screw lid. Units: cm.
const COLOURWAYS = [
  { name: "navy frosted glass, silver lid", glass: { tint: 0x14244f, distance: 1.2, roughness: 0.32 }, lid: { metal: 0xd8d8dc, roughness: 0.28 } },
  { name: "plum frosted glass, gold lid", glass: { tint: 0x4a1f45, distance: 1.4, roughness: 0.3 }, lid: { metal: 0xd9b67a, roughness: 0.3 } },
  { name: "white opal glass, white lid", opal: 0xf4f2ee, lid: { plastic: 0xf7f6f3, roughness: 0.32 } },
  { name: "forest frosted glass, black lid", glass: { tint: 0x0f3324, distance: 1.1, roughness: 0.34 }, lid: { plastic: 0x1c1c1e, roughness: 0.4 } },
];

export default function build({ THREE, kit, rng, seed }) {
  const colourway = COLOURWAYS[(seed - 1) % COLOURWAYS.length];
  const open = seed % 2 === 0;
  const R = rng.range(3.4, 3.8);
  const H = rng.range(3.9, 4.5);
  const neck = R - 0.35;
  const wall = 0.45;

  const group = new THREE.Group();
  const jarMaterial = colourway.glass
    ? kit.glass({ ...colourway.glass, thickness: 1.2, ior: 1.5 })
    : kit.plastic(colourway.opal, 0.22, { clearcoat: 0.6, sheen: 0.3 });
  const jar = kit.lathe(
    [
      [0, 0],
      [R, 0],
      [R, H - 0.6],
      [neck, H - 0.45],
      [neck, H],
      [neck - wall, H],
      [neck - wall, 0.9],
      [0, 0.9],
    ],
    { radius: [0, 0.45, 0.35, 0.1, 0.08, 0.08, 0.35, 0] },
  );
  group.add(kit.mesh(jar, jarMaterial));

  // The cream: fills the cavity; when open, its top rises into a soft swirl.
  const creamMaterial = kit.plastic(0xe9e2d6, 0.5, { clearcoat: 0.2 });
  const inner = neck - wall - 0.01;
  const top = open ? H - 0.35 : H - 0.8;
  const cream = kit.lathe(
    [
      [0, 0.91],
      [inner, 0.91],
      [inner, top - 0.1],
      [inner * 0.6, top + 0.12],
      [0, top + (open ? 0.55 : 0.1)],
    ],
    { radius: [0, 0.2, 0.4, 0.6, 0], segments: 200 },
  );
  if (open) {
    // Twist the dome into a spiral swirl.
    const pos = cream.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = pos.getY(i);
      const r = Math.hypot(x, z) / inner;
      if (y < top - 0.2) continue;
      const theta = Math.atan2(z, x);
      pos.setY(i, y + 0.12 * Math.sin(theta * 1 + r * 9) * Math.sin(Math.PI * Math.min(r, 1)));
    }
    cream.computeVertexNormals();
  }
  group.add(kit.mesh(cream, creamMaterial));

  const lidMaterial = colourway.lid.metal
    ? kit.metal(colourway.lid.metal, colourway.lid.roughness, { clearcoat: 0.3 })
    : kit.plastic(colourway.lid.plastic, colourway.lid.roughness, { clearcoat: 0.3 });
  const lidH = rng.range(1.6, 2.1);
  const lid = kit.lathe(
    [
      [0, 0],
      [R + 0.02, 0],
      [R + 0.02, lidH],
      [0, lidH],
    ],
    { radius: [0, 0.08, 0.3, 0], segments: 576 },
  );
  // Knurled grip: fine vertical ribs on the lid's side (normal-map free: displace the lathe).
  const lp = lid.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i);
    const z = lp.getZ(i);
    const y = lp.getY(i);
    const r = Math.hypot(x, z);
    if (r < R - 0.05 || y < 0.15 || y > lidH - 0.3) continue;
    const theta = Math.atan2(z, x);
    const k = 1 + (0.012 * Math.cos(theta * 96)) / R;
    lp.setX(i, x * k);
    lp.setZ(i, z * k);
  }
  lid.computeVertexNormals();

  if (open) {
    group.add(kit.mesh(lid, lidMaterial, { position: [-R * 1.55, 0, -R * 1.25] }));
  } else {
    group.add(kit.mesh(lid, lidMaterial, { position: [0, H - 0.5, 0] }));
  }

  return {
    object: group,
    variant: `${colourway.name}, ${open ? "open with lid beside" : "closed"}`,
    camera: { azimuth: 30 + rng.range(-8, 8), elevation: open ? 30 : 20, fill: 0.72 },
    alt: `${open ? "Open" : "Closed"} ${colourway.name.split(",")[0]} night cream jar ${open ? "with its lid beside it" : `with a ${colourway.lid.metal ? "metal" : "matte"} lid`}, on a light grey background`,
  };
}
