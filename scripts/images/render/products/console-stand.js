// Console Stand: a vertical stand with a cradle holding a plain, unbranded slim console
// upright, plus two controller charging docks with LEDs on the base. Units: cm.
const VARIANTS = [
  { name: "black stand, white console", stand: 0x1c1d20, console: 0xeeeeec, accent: 0x1a1a1c, led: 0x3aa0ff },
  { name: "white stand, white console", stand: 0xf0f0ee, console: 0xf5f5f3, accent: 0x2a2b2e, led: 0x3aa0ff },
  { name: "black stand, black console", stand: 0x1c1d20, console: 0x232427, accent: 0x5a5c62, led: 0x40e0a0 },
  { name: "graphite stand, light-grey console", stand: 0x2d2f33, console: 0xc9cacd, accent: 0x1a1a1c, led: 0xffffff },
];

export default function build({ THREE, kit, rng, seed }) {
  const v = VARIANTS[(seed - 1) % VARIANTS.length];
  const group = new THREE.Group();
  const standMaterial = kit.plastic(v.stand, 0.45, { clearcoat: 0.25 });
  const ledMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: v.led, emissiveIntensity: 2.2 });

  // Base plate.
  const BW = rng.range(30, 32);
  const BD = rng.range(21, 23);
  const BH = 2.0;
  group.add(kit.mesh(kit.slab(BW, BD, BH, { corner: 2.0, bevel: 0.45 }), standMaterial));
  // Front LED bar.
  group.add(kit.mesh(kit.roundedBox(8, 0.25, 0.1, 0.06, 2), ledMaterial, { position: [0, BH * 0.5, BD / 2 + 0.01] }));

  // Console, upright in a central cradle.
  const CT = 5.4; // thickness (x)
  const CH = rng.range(26, 28);
  const CD = BD - 2.5;
  const cradleH = 4.2;
  for (const s of [-1, 1]) {
    group.add(kit.mesh(kit.roundedBox(1.4, cradleH, CD * 0.8, 0.5, 5), standMaterial, { position: [s * (CT / 2 + 0.7), BH + cradleH / 2 - 0.3, 0] }));
  }
  const consoleGroup = new THREE.Group();
  const shell = kit.plastic(v.console, 0.32, { clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const accent = kit.plastic(v.accent, 0.5);
  // Two shell halves with a recessed accent band between them (vent line).
  consoleGroup.add(kit.mesh(kit.roundedBox(CT * 0.42, CH, CD, 0.6, 6), shell, { position: [-CT * 0.29, CH / 2, 0] }));
  consoleGroup.add(kit.mesh(kit.roundedBox(CT * 0.42, CH, CD, 0.6, 6), shell, { position: [CT * 0.29, CH / 2, 0] }));
  consoleGroup.add(kit.mesh(kit.roundedBox(CT * 0.3, CH - 0.8, CD - 0.8, 0.3, 3), accent, { position: [0, CH / 2, 0] }));
  // Front face: slim disc slot and power button.
  consoleGroup.add(kit.mesh(kit.roundedBox(0.25, CH * 0.45, 0.06, 0.1, 2), kit.plastic(0x050505, 0.6), { position: [-CT * 0.29, CH * 0.62, CD / 2 + 0.005] }));
  consoleGroup.add(kit.mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 32), kit.plastic(v.accent, 0.3), { position: [CT * 0.29, CH * 0.88, CD / 2 + 0.01], rotation: [Math.PI / 2, 0, 0] }));
  consoleGroup.add(kit.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), ledMaterial, { position: [CT * 0.29, CH * 0.84, CD / 2 + 0.02], rotation: [Math.PI / 2, 0, 0] }));
  consoleGroup.position.y = BH + 0.9;
  group.add(consoleGroup);

  // Controller docks either side: angled cradle with a charging-pin block.
  const pins = kit.metal(0xd9b56a, 0.25);
  for (const s of [-1, 1]) {
    const dock = new THREE.Group();
    dock.add(kit.mesh(kit.slab(7.5, 6.5, 2.2, { corner: 1.4, bevel: 0.5 }), standMaterial));
    dock.add(kit.mesh(kit.slab(5.8, 4.8, 0.3, { corner: 1.0, bevel: 0.1 }), kit.rubber(0x0f0f10, 0.85), { position: [0, 2.05, 0] }));
    dock.add(kit.mesh(kit.roundedBox(1.8, 1.4, 0.9, 0.3, 3), standMaterial, { position: [0, 2.8, -1.6] }));
    dock.add(kit.mesh(kit.roundedBox(1.0, 0.5, 0.25, 0.08, 2), pins, { position: [0, 3.0, -1.1] }));
    dock.add(kit.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), ledMaterial, { position: [0, 1.1, 3.26], rotation: [Math.PI / 2, 0, 0] }));
    dock.position.set(s * (BW / 2 - 5.2), BH - 0.05, 1.6);
    dock.rotation.y = s * 0.12;
    group.add(dock);
  }

  // Fan grille at the back of the base.
  const grille = new THREE.InstancedMesh(kit.roundedBox(0.2, 1.1, 0.25, 0.08, 2), kit.plastic(0x050505, 0.8), 18);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 18; i++) {
    m.makeTranslation(-4.25 + i * 0.5, BH * 0.5, -BD / 2 + 0.05);
    grille.setMatrixAt(i, m);
  }
  group.add(grille);

  group.rotation.y = rng.range(-0.25, -0.05);
  return {
    object: group,
    variant: v.name,
    camera: { azimuth: 30 + rng.range(-6, 6), elevation: 20, fill: 0.78 },
    alt: `${v.name.split(" ")[0].replace(/^\w/, (ch) => ch.toUpperCase())} vertical console stand holding a plain ${v.name.split(", ")[1].replace(" console", "")} slim console upright, with two controller charging docks, on a light grey background`,
  };
}
