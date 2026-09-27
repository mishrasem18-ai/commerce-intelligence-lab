// Sunscreen SPF 50: a squeeze tube standing on its flip-top cap, round at the shoulder and
// flattening to a crimped seal; optionally a dollop of lotion beside it. Units: cm.
const COLOURWAYS = [
  { name: "white tube, orange cap", tubeName: "White", capName: "an orange", tube: 0xf7f6f2, cap: 0xf08a24 },
  { name: "sun-yellow tube, white cap", tubeName: "Yellow", capName: "a white", tube: 0xf7cf45, cap: 0xf7f6f2 },
  { name: "sky-blue tube, white cap", tubeName: "Sky-blue", capName: "a white", tube: 0x8cc8ec, cap: 0xf7f6f2 },
  { name: "coral tube, white cap", tubeName: "Coral", capName: "a white", tube: 0xf2876b, cap: 0xf7f6f2 },
];

export default function build({ THREE, kit, rng, seed }) {
  const c = COLOURWAYS[(seed - 1) % COLOURWAYS.length];
  const r0 = rng.range(1.9, 2.1);
  const capH = 2.3;
  const shoulder = 0.6;
  const length = rng.range(12.5, 14);
  const flatHalf = (Math.PI * r0) / 2;
  const group = new THREE.Group();

  // Flip-top cap: a slightly wider rounded cylinder with a hinge seam near the top.
  const capMaterial = kit.plastic(c.cap, 0.38, { clearcoat: 0.35 });
  const capR = r0 + 0.08;
  const cap = kit.lathe(
    [
      [0, 0],
      [capR, 0],
      [capR, capH - 0.62],
      [capR - 0.05, capH - 0.58],
      [capR - 0.05, capH - 0.52],
      [capR, capH - 0.48],
      [capR, capH],
      [0, capH],
    ],
    { radius: [0, 0.2, 0.02, 0.01, 0.01, 0.02, 0.2, 0] },
  );
  group.add(kit.mesh(cap, capMaterial));

  // Shoulder between cap and tube.
  const shoulderGeo = kit.lathe([[0, 0], [capR - 0.04, 0], [r0, shoulder], [0, shoulder]], { radius: [0, 0.1, 0.25, 0] });
  const tubeMaterial = kit.plastic(c.tube, 0.34, { clearcoat: 0.55, clearcoatRoughness: 0.25 });
  group.add(kit.mesh(shoulderGeo, tubeMaterial, { position: [0, capH, 0] }));

  const body = kit.squeezeTube(r0, length, flatHalf);
  group.add(kit.mesh(body, tubeMaterial, { position: [0, capH + shoulder, 0] }));

  // Crimped seal: a thin flat strip with fine horizontal ridges.
  const ridges = new Float32Array(64 * 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) ridges[y * 64 + x] = 0.5 + 0.5 * Math.sin((y / 64) * Math.PI * 2 * 6);
  const sealMaterial = tubeMaterial.clone();
  sealMaterial.normalMap = kit.normalMap(ridges, 64, 2);
  sealMaterial.normalMap.repeat.set(1, 1);
  const seal = kit.roundedBox(flatHalf * 2 + 0.1, 1.1, 0.16, 0.06, 3);
  group.add(kit.mesh(seal, sealMaterial, { position: [0, capH + shoulder + length + 0.45, 0] }));

  const withDollop = seed % 2 === 0;
  if (withDollop) {
    const dollop = kit.lathe(
      [
        [0, 0],
        [1.3, 0],
        [1.25, 0.35],
        [0.7, 0.75],
        [0.25, 1.05],
        [0, 1.25],
      ],
      { radius: [0, 0.2, 0.3, 0.3, 0.2, 0], segments: 200 },
    );
    const p = dollop.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const y = p.getY(i);
      const th = Math.atan2(z, x);
      const k = 1 + 0.08 * Math.sin(th * 3 + y * 5);
      p.setX(i, x * k);
      p.setZ(i, z * k);
      p.setY(i, y * (1 + 0.1 * Math.sin(th * 2)));
    }
    dollop.computeVertexNormals();
    group.add(kit.mesh(dollop, kit.plastic(0xf8f6f1, 0.42, { clearcoat: 0.5, sheen: 0.3 }), { position: [r0 + 3.6, 0, 1.8], scale: 1.7 }));
  }

  group.rotation.y = rng.range(-0.5, -0.25);
  return {
    object: group,
    variant: `${c.name}${withDollop ? ", lotion dollop" : ""}`,
    camera: { azimuth: 30 + rng.range(-6, 6), elevation: 14, fill: 0.72 },
    alt: `${c.tubeName} sunscreen squeeze tube standing on ${c.capName} flip-top cap${withDollop ? " beside a dollop of lotion" : ""}, on a light grey background`,
  };
}
