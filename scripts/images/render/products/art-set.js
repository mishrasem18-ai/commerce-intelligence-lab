// Art Set: an open wooden case — coloured pencils, oil pastels, a two-row watercolour pan set
// and brushes in the tray, a white mixing palette in the propped-open lid. Units: cm.
const WOODS = [
  { name: "beech case", light: "#d9b98c", dark: "#9c7447" },
  { name: "walnut case", light: "#8a5a3a", dark: "#4a2c1a" },
  { name: "white-oak case", light: "#e3cfae", dark: "#b3946a" },
  { name: "beech case, deeper lid angle", light: "#dcbc90", dark: "#9a7246" },
];
const PALETTE = [0xd7263d, 0xf46036, 0xf7b32b, 0xf0e14a, 0x8cc63f, 0x2e933c, 0x1b998b, 0x2e86de, 0x1f3a93, 0x7b3fa0, 0xe56399, 0x7a4b2a, 0x222222, 0xf2f2f2];

export default function build({ THREE, kit, rng, seed }) {
  const wood = WOODS[(seed - 1) % WOODS.length];
  const random = kit.rng(seed * 7);
  const W = 32;
  const D = 22;
  const H = 3.8;
  const wall = 0.8;
  const floorT = 0.6;
  const group = new THREE.Group();

  const woodMap = kit.woodTexture(random, wood.light, wood.dark);
  woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  const woodMaterial = new THREE.MeshPhysicalMaterial({ map: woodMap, roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const woodMaterialZ = woodMaterial.clone();
  woodMaterialZ.map = woodMap.clone();
  woodMaterialZ.map.rotation = Math.PI / 2;
  woodMaterialZ.map.needsUpdate = true;

  const tray = new THREE.Group();
  tray.add(kit.mesh(kit.roundedBox(W, floorT, D, 0.2, 3), woodMaterial, { position: [0, floorT / 2, 0] }));
  tray.add(kit.mesh(kit.roundedBox(W, H, wall, 0.25, 3), woodMaterial, { position: [0, H / 2, D / 2 - wall / 2] }));
  tray.add(kit.mesh(kit.roundedBox(W, H, wall, 0.25, 3), woodMaterial, { position: [0, H / 2, -D / 2 + wall / 2] }));
  tray.add(kit.mesh(kit.roundedBox(wall, H, D, 0.25, 3), woodMaterialZ, { position: [W / 2 - wall / 2, H / 2, 0] }));
  tray.add(kit.mesh(kit.roundedBox(wall, H, D, 0.25, 3), woodMaterialZ, { position: [-W / 2 + wall / 2, H / 2, 0] }));
  // Divider between the front (pencils, pastels) and back (pans, brushes) compartments.
  tray.add(kit.mesh(kit.roundedBox(W - wall * 2, H * 0.7, 0.5, 0.15, 2), woodMaterial, { position: [0, (H * 0.7) / 2, 0.6] }));
  group.add(tray);

  const floorY = floorT;
  // Coloured pencils (hexagonal, sharpened), front-left.
  const pencilLen = 17;
  const r = 0.36;
  const woodTip = kit.plastic(0xe8c9a0, 0.8, { clearcoat: 0 });
  const pencilColours = PALETTE.slice(0, 11);
  const penX = -W / 2 + wall + 0.3 + pencilLen / 2;
  pencilColours.forEach((colour, i) => {
    const pencil = new THREE.Group();
    const bodyLen = pencilLen - 2;
    const lacquer = kit.plastic(colour, 0.3, { clearcoat: 0.8, clearcoatRoughness: 0.1 });
    pencil.add(kit.mesh(new THREE.CylinderGeometry(r, r, bodyLen, 6), lacquer, { rotation: [0, Math.PI / 6, 0] }));
    pencil.add(kit.mesh(new THREE.CylinderGeometry(0.12, r * 0.92, 1.6, 24), woodTip, { position: [0, bodyLen / 2 + 0.8, 0] }));
    pencil.add(kit.mesh(new THREE.CylinderGeometry(0.02, 0.12, 0.42, 16), kit.plastic(colour, 0.4), { position: [0, bodyLen / 2 + 1.8, 0] }));
    pencil.rotation.z = -Math.PI / 2;
    pencil.position.set(penX - 1 + (i % 2) * 0.3, floorY + r, 1.3 + wall / 2 + i * (r * 2 + 0.06));
    tray.add(pencil);
  });

  // Oil pastels with plain paper wraps, front-right, lying along x.
  const pastelX = W / 2 - wall - 0.4 - 3.4;
  PALETTE.slice(0, 8).forEach((colour, i) => {
    const pastel = new THREE.Group();
    const wax = kit.plastic(colour, 0.55, { clearcoat: 0.1 });
    const paper = kit.plastic(new THREE.Color(colour).lerp(new THREE.Color(0x000000), 0.12), 0.85, { clearcoat: 0 });
    pastel.add(kit.mesh(kit.lathe([[0, 0], [0.5, 0], [0.5, 6.6], [0, 6.6]], { radius: [0, 0.1, 0.1, 0], segments: 40 }), wax));
    pastel.add(kit.mesh(new THREE.CylinderGeometry(0.53, 0.53, 3.0, 40, 1, true), paper, { position: [0, 3.9, 0] }));
    pastel.rotation.z = -Math.PI / 2;
    pastel.position.set(pastelX - 3.3, floorY + 0.53, 1.35 + wall / 2 + i * 1.1);
    tray.add(pastel);
  });

  // Watercolour pans, 2 × 6, back-left.
  const panWhite = kit.plastic(0xf6f6f4, 0.25, { clearcoat: 0.5 });
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 6; col++) {
      const x = -W / 2 + wall + 1.6 + col * 2.6;
      const z = -D / 2 + wall + 1.3 + row * 3.0;
      tray.add(kit.mesh(kit.slab(2.4, 2.8, 1.1, { corner: 0.3, bevel: 0.08 }), panWhite, { position: [x, floorY, z] }));
      const cake = kit.mesh(kit.slab(2.0, 2.4, 0.14, { corner: 0.2, bevel: 0.04 }), kit.plastic(PALETTE[(row * 6 + col) % 12], 0.7, { clearcoat: 0.05 }), { position: [x, floorY + 1.02, z] });
      tray.add(cake);
    }
  }

  // Brushes, back-right.
  const brushXs = [0, 1, 2];
  for (const k of brushXs) {
    const brush = new THREE.Group();
    const handleColour = [0x1a1a1a, 0xb22222, 0x1f3a93][k];
    const handle = kit.lathe([[0, 0], [0.22, 0], [0.3, 4], [0.26, 9], [0.2, 10], [0, 10]], { radius: [0, 0.1, 1.5, 1.0, 0.05, 0] });
    brush.add(kit.mesh(handle, kit.plastic(handleColour, 0.3, { clearcoat: 0.9 })));
    brush.add(kit.mesh(kit.lathe([[0, 0], [0.2, 0], [0.24, 1.6], [0, 1.6]], { radius: [0, 0, 0.05, 0] }), kit.metal(0xcfcfd2, 0.25), { position: [0, 10, 0] }));
    brush.add(kit.mesh(kit.lathe([[0, 0], [0.22 + k * 0.05, 0], [0.26 + k * 0.06, 0.6], [0, 1.6 + k * 0.4]], { radius: [0, 0, 0.3, 0] }), kit.rubber(k === 1 ? 0xc9a36b : 0x2a1e17, 0.8), { position: [0, 11.6, 0] }));
    brush.rotation.z = -Math.PI / 2;
    brush.position.set(2.2, floorY + 0.3, -D / 2 + wall + 1.3 + k * 1.1);
    tray.add(brush);
  }

  // Lid: shallow wooden box hinged on the back edge, propped open, white palette inside.
  const lid = new THREE.Group();
  const LH = 1.6;
  lid.add(kit.mesh(kit.roundedBox(W, 0.6, D, 0.2, 3), woodMaterial, { position: [0, 0.3, 0] }));
  lid.add(kit.mesh(kit.roundedBox(W, LH, wall, 0.25, 3), woodMaterial, { position: [0, LH / 2, D / 2 - wall / 2] }));
  lid.add(kit.mesh(kit.roundedBox(W, LH, wall, 0.25, 3), woodMaterial, { position: [0, LH / 2, -D / 2 + wall / 2] }));
  lid.add(kit.mesh(kit.roundedBox(wall, LH, D, 0.25, 3), woodMaterialZ, { position: [W / 2 - wall / 2, LH / 2, 0] }));
  lid.add(kit.mesh(kit.roundedBox(wall, LH, D, 0.25, 3), woodMaterialZ, { position: [-W / 2 + wall / 2, LH / 2, 0] }));
  // Felt lining, a small mixing palette with paint dabs in its wells, and a row of paint tubes.
  lid.add(kit.mesh(kit.slab(W - wall * 2, D - wall * 2, 0.12, { corner: 0.2, bevel: 0.03 }), kit.rubber(0x1d2640, 0.95), { position: [0, 0.6, 0] }));
  const plateW = 12.5;
  const plateD = D - 5;
  const plateX = W / 2 - wall - 1.2 - plateW / 2;
  lid.add(kit.mesh(kit.slab(plateW, plateD, 0.35, { corner: 0.8, bevel: 0.1 }), panWhite, { position: [plateX, 0.72, 0] }));
  const well = kit.lathe([[0, 0.05], [1.2, 0.05], [1.45, 0.25], [1.5, 0.4], [1.35, 0.4], [0, 0.12]], { radius: [0, 0.4, 0.1, 0.05, 0.1, 0] });
  const dabColours = [PALETTE[0], PALETTE[2], PALETTE[7], PALETTE[5], PALETTE[9], PALETTE[1], PALETTE[3], PALETTE[11]];
  for (let i = 0; i < 8; i++) {
    const wx = plateX - 3.1 + (i % 3) * 3.1;
    const wz = -plateD / 2 + 2.6 + Math.floor(i / 3) * 3.4;
    if (i === 8) break;
    lid.add(kit.mesh(well, panWhite, { position: [wx, 1.05, wz] }));
    if (i % 2 === 0 || i === 5) {
      const dab = kit.lathe([[0, 0], [0.8, 0], [0.5, 0.12], [0, 0.18]], { radius: [0, 0.2, 0.2, 0] });
      lid.add(kit.mesh(dab, kit.plastic(dabColours[i], 0.3, { clearcoat: 0.8 }), { position: [wx + 0.1, 1.2, wz - 0.1], scale: [1, 1, 0.8] }));
    }
  }
  // Paint tubes, lying side by side across the lid (crimp end toward the hinge).
  const tubeColours = [PALETTE[0], PALETTE[2], PALETTE[3], PALETTE[5], PALETTE[7], PALETTE[9]];
  const tubeZone = W - wall * 2 - plateW - 3;
  tubeColours.forEach((colour, i) => {
    const tube = new THREE.Group();
    const r0 = 0.62;
    const aluminium = kit.metal(0xe2e2e4, 0.35);
    const len = 6.4;
    const body = kit.squeezeTube(r0, len, (Math.PI * r0) / 2, 64, 48);
    tube.add(kit.mesh(body, aluminium));
    // Colour band round the shoulder half of the body (the paint colour, no label text).
    tube.add(kit.mesh(new THREE.CylinderGeometry(r0 + 0.01, r0 + 0.01, 2.2, 48, 1, true), kit.plastic(colour, 0.45, { clearcoat: 0.3 }), { position: [0, 1.4, 0] }));
    tube.add(kit.mesh(kit.roundedBox(Math.PI * r0 + 0.05, 0.6, 0.08, 0.03, 2), aluminium, { position: [0, len + 0.25, 0] }));
    tube.add(kit.mesh(kit.lathe([[0, 0], [r0, 0], [0.3, -0.5], [0, -0.5]], { radius: [0, 0.1, 0.1, 0] }), aluminium));
    tube.add(kit.mesh(kit.lathe([[0, 0], [0.42, 0], [0.42, 1.1], [0, 1.1]], { radius: [0, 0.05, 0.12, 0], segments: 48 }), kit.plastic(0x151515, 0.4), { position: [0, -1.55, 0] }));
    tube.rotation.x = Math.PI / 2;
    tube.rotation.z = 0;
    tube.position.set(-W / 2 + wall + 1.5 + i * (tubeZone / (tubeColours.length - 0.4)), 0.72 + r0, 3.0);
    lid.add(tube);
  });
  // Hinge pivot: lid's back edge sits on the tray's back edge; rotate open past vertical.
  const openAngle = seed === 4 ? 1.95 : rng.range(1.72, 1.82);
  const pivot = new THREE.Group();
  lid.position.set(0, LH, D / 2);
  lid.rotation.x = Math.PI;
  pivot.add(lid);
  pivot.position.set(0, H, -D / 2);
  pivot.rotation.x = -openAngle;
  group.add(pivot);
  // Brass hinges.
  for (const s of [-1, 1]) {
    group.add(kit.mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.2, 20), kit.metal(0xc9a34f, 0.3), { position: [s * (W / 2 - 5), H, -D / 2 - 0.1], rotation: [0, 0, Math.PI / 2] }));
  }

  group.rotation.y = rng.range(-0.2, 0.05);
  return {
    object: group,
    variant: `${wood.name}, lid ${(openAngle * 57.3).toFixed(0)}°`,
    camera: { azimuth: 22 + rng.range(-6, 6), elevation: 42, fill: 0.86 },
    lighting: { keyElevation: 60, env: 0.95 },
    alt: `Open ${wood.name.split(",")[0].replace(" case", "")} art set case with coloured pencils, oil pastels, watercolour pans, brushes, paint tubes and a mixing palette, on a light grey background`,
  };
}
