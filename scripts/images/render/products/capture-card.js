// Capture Card: a compact external video-capture box — HDMI in / HDMI out / USB-C on the
// front, a glossy top panel with a light bar — with HDMI cables plugged in. Units: cm.
const VARIANTS = [
  { name: "matte black, white light bar, one HDMI cable", body: 0x1d1e21, panel: 0x0b0b0c, light: 0xeaf4ff, cables: 1 },
  { name: "white, blue light bar, two HDMI cables", body: 0xf1f1ef, panel: 0x1a1a1c, light: 0x3aa0ff, cables: 2 },
  { name: "gunmetal, violet light bar, no cable", body: 0x3b3e44, panel: 0x101113, light: 0xa070ff, cables: 0 },
  { name: "matte black, cyan light bar, two HDMI cables", body: 0x1d1e21, panel: 0x0b0b0c, light: 0x40e0e8, cables: 2 },
];

function hdmiShape(THREE, w, h, inset = 0) {
  const s = new THREE.Shape();
  const x = w / 2 - inset;
  const top = h / 2 - inset;
  const bottom = -h / 2 + inset;
  const chamfer = h * 0.45;
  s.moveTo(-x, top);
  s.lineTo(x, top);
  s.lineTo(x, bottom + chamfer);
  s.lineTo(x - chamfer, bottom);
  s.lineTo(-x + chamfer, bottom);
  s.lineTo(-x, bottom + chamfer);
  s.closePath();
  return s;
}

export default function build({ THREE, kit, rng, seed }) {
  const v = VARIANTS[(seed - 1) % VARIANTS.length];
  const W = rng.range(10.5, 11.5);
  const D = rng.range(7.2, 7.8);
  const H = 2.2;
  const group = new THREE.Group();

  const bodyMaterial = kit.plastic(v.body, 0.55, { clearcoat: 0.1 });
  group.add(kit.mesh(kit.slab(W, D, H, { corner: 1.2, bevel: 0.35 }), bodyMaterial));
  // Glossy top panel (inset) and light bar along its front edge.
  group.add(kit.mesh(kit.slab(W - 1.2, D - 1.2, 0.08, { corner: 0.7, bevel: 0.03 }), kit.plastic(v.panel, 0.08, { clearcoat: 1, clearcoatRoughness: 0.03 }), { position: [0, H - 0.04, 0] }));
  group.add(
    kit.mesh(kit.roundedBox(W * 0.42, 0.04, 0.18, 0.02, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: v.light, emissiveIntensity: 2.2 }), {
      position: [0, H + 0.045, D / 2 - 1.05],
    }),
  );

  // Front ports: HDMI in, HDMI out, USB-C.
  const face = D / 2;
  const shellMaterial = kit.metal(0xb9bbbf, 0.28);
  const holeMaterial = kit.plastic(0x050505, 0.7);
  const ports = [-W * 0.27, -W * 0.05];
  for (const x of ports) {
    const outline = hdmiShape(THREE, 1.45, 0.5);
    outline.holes.push(hdmiShape(THREE, 1.45, 0.5, 0.05));
    const shell = new THREE.ExtrudeGeometry(outline, { depth: 0.1, bevelEnabled: false });
    group.add(kit.mesh(shell, shellMaterial, { position: [x, H * 0.45, face - 0.07] }));
    const cavity = new THREE.ExtrudeGeometry(hdmiShape(THREE, 1.45, 0.5, 0.04), { depth: 0.05, bevelEnabled: false });
    group.add(kit.mesh(cavity, holeMaterial, { position: [x, H * 0.45, face - 0.09] }));
    group.add(kit.mesh(kit.roundedBox(1.05, 0.12, 0.06, 0.02, 2), kit.plastic(0x202020, 0.5), { position: [x, H * 0.47, face - 0.02] }));
  }
  const usb = new THREE.ExtrudeGeometry(kit.roundedRectShape(0.9, 0.32, 0.16), { depth: 0.06, bevelEnabled: false, curveSegments: 16 });
  group.add(kit.mesh(usb, holeMaterial, { position: [W * 0.2, H * 0.45, face - 0.04] }));
  group.add(kit.mesh(kit.roundedBox(0.62, 0.07, 0.04, 0.02, 2), kit.metal(0x9a9a9a, 0.3), { position: [W * 0.2, H * 0.45, face + 0.02] }));
  // Status LED next to the USB-C port.
  group.add(kit.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: v.light, emissiveIntensity: 2 }), { position: [W * 0.33, H * 0.45, face + 0.005], rotation: [Math.PI / 2, 0, 0] }));

  // HDMI cables: plug body + connector in the port, cable curving away across the floor.
  const cableMaterial = kit.rubber(0x1a1a1c, 0.6);
  for (let k = 0; k < v.cables; k++) {
    const x = ports[k];
    const plugY = H * 0.45;
    group.add(kit.mesh(kit.roundedBox(1.35, 0.42, 0.7, 0.06, 2), shellMaterial, { position: [x, plugY, face + 0.3] }));
    const bodyLen = 3.2;
    group.add(kit.mesh(kit.roundedBox(2.1, 0.95, bodyLen, 0.35, 5), cableMaterial, { position: [x, plugY, face + 0.65 + bodyLen / 2] }));
    const start = face + 0.65 + bodyLen;
    const side = k === 0 ? -1 : 1;
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, plugY, start - 0.2),
      new THREE.Vector3(x, plugY * 0.8, start + 1.2),
      new THREE.Vector3(x + side * 0.6, 0.3, start + 3.2),
      new THREE.Vector3(x + side * 2.2, 0.3, start + 4.4),
      new THREE.Vector3(x + side * 4.8, 0.3, start + 5.0),
    ]);
    group.add(kit.mesh(new THREE.TubeGeometry(path, 200, 0.3, 20, false), cableMaterial));
    // Far-end plug lying on the floor, in line with the cable's end.
    const tip = path.getPoint(1);
    const dir = path.getTangent(1).setY(0).normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    const farBody = kit.mesh(kit.roundedBox(2.1, 0.95, bodyLen, 0.35, 5), cableMaterial);
    farBody.position.copy(tip).addScaledVector(dir, bodyLen / 2 - 0.2).setY(0.475);
    farBody.rotation.y = yaw;
    const farPin = kit.mesh(kit.roundedBox(1.35, 0.42, 0.9, 0.06, 2), shellMaterial);
    farPin.position.copy(tip).addScaledVector(dir, bodyLen + 0.2).setY(0.475);
    farPin.rotation.y = yaw;
    group.add(farBody, farPin);
  }

  group.rotation.y = rng.range(-0.25, 0.05);
  return {
    object: group,
    variant: v.name,
    camera: { azimuth: 24 + rng.range(-6, 6), elevation: 30, fill: v.cables ? 0.8 : 0.74 },
    alt: `Compact ${v.name.split(",")[0]} external video capture card with HDMI in and out ports${v.cables ? " and HDMI cable" + (v.cables > 1 ? "s" : "") + " plugged in" : ""}, on a light grey background`,
  };
}
