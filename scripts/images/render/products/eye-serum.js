// Eye Serum: a slim roll-on serum bottle (metal cooling ball in a collar) with its cap laid
// beside it, or a slim airless pump. Units: cm.
const COLOURWAYS = [
  { name: "white opal glass, silver roller", body: { opal: 0xf3f1ec }, serum: null, metal: 0xd9d9dc, cap: { opal: 0xf3f1ec } },
  { name: "clear glass, blush serum, rose-gold roller", body: { glass: 0xfdfbf8 }, serum: 0xf2c9c0, metal: 0xe3b19a, cap: { metal: 0xe3b19a } },
  { name: "lavender frosted glass, silver roller", body: { glass: 0xb8a6d9, frosted: true }, serum: 0xe8e0f4, metal: 0xd9d9dc, cap: { plastic: 0xece8f4 } },
  { name: "white airless pump, silver collar", body: { opal: 0xf6f5f2 }, serum: null, metal: 0xd4d4d8, cap: { plastic: 0xf6f5f2 }, airless: true },
];

export default function build({ THREE, kit, rng, seed }) {
  const c = COLOURWAYS[(seed - 1) % COLOURWAYS.length];
  const R = c.airless ? 1.25 : rng.range(0.95, 1.1);
  const H = c.airless ? rng.range(9.5, 10.5) : rng.range(6.8, 7.8);
  const group = new THREE.Group();

  let bodyMaterial;
  if (c.body.opal) bodyMaterial = kit.plastic(c.body.opal, 0.25, { clearcoat: 0.7, clearcoatRoughness: 0.1 });
  else bodyMaterial = kit.glass({ tint: c.body.glass, distance: c.body.frosted ? 2.5 : 40, roughness: c.body.frosted ? 0.3 : 0.03, thickness: 0.5 });

  const wall = 0.2;
  const neckR = R * 0.55;
  const bodyPoints = c.airless
    ? [[0, 0], [R, 0], [R, H], [0, H]]
    : [[0, 0], [R, 0], [R, H], [neckR, H + 0.45], [neckR, H + 0.9], [neckR - wall, H + 0.9], [neckR - wall, H + 0.45], [R - wall, H - 0.1], [R - wall, 0.5], [0, 0.5]];
  const bodyRadius = c.airless ? [0, 0.25, 0.1, 0] : [0, 0.3, 0.4, 0.1, 0.04, 0.04, 0.1, 0.4, 0.2, 0];
  group.add(kit.mesh(kit.lathe(bodyPoints, { radius: bodyRadius }), bodyMaterial));

  if (c.serum && !c.body.opal) {
    const level = H * rng.range(0.7, 0.8);
    const serum = kit.lathe([[0, 0.51], [R - wall - 0.01, 0.51], [R - wall - 0.01, level], [0, level]], { radius: [0, 0.18, 0.04, 0] });
    group.add(kit.mesh(serum, kit.plastic(c.serum, 0.12, { clearcoat: 1 }), { castShadow: false }));
  }

  const metal = kit.metal(c.metal, 0.18);
  let capR;
  let capH;
  if (c.airless) {
    const collar = kit.lathe([[0, 0], [R + 0.02, 0], [R + 0.02, 0.7], [0, 0.7]], { radius: [0, 0.05, 0.12, 0] });
    group.add(kit.mesh(collar, metal, { position: [0, H - 0.05, 0] }));
    const actuator = kit.lathe([[0, 0], [R * 0.72, 0], [R * 0.72, 1.3], [0, 1.45]], { radius: [0, 0.05, 0.35, 0] });
    group.add(kit.mesh(actuator, metal, { position: [0, H + 0.65, 0] }));
    const nozzle = kit.lathe([[0, 0], [0.16, 0], [0.16, 0.5], [0, 0.5]], { radius: [0, 0, 0.08, 0] });
    group.add(kit.mesh(nozzle, kit.plastic(0x2a2a2a, 0.4), { position: [0, H + 1.45, R * 0.72 - 0.02], rotation: [Math.PI / 2, 0, 0] }));
    capR = R + 0.08;
    capH = 3.2;
  } else {
    // Roller collar with a socket, and the ball.
    const collarH = 1.25;
    const collar = kit.lathe(
      [[0, 0], [neckR + 0.12, 0], [neckR + 0.12, collarH * 0.45], [0.5, collarH], [0.36, collarH], [0, collarH - 0.1]],
      { radius: [0, 0.04, 0.3, 0.12, 0.05, 0] },
    );
    group.add(kit.mesh(collar, metal, { position: [0, H + 0.2, 0] }));
    const ball = new THREE.SphereGeometry(0.42, 96, 64);
    group.add(kit.mesh(ball, kit.metal(0xe6e6e8, 0.05), { position: [0, H + 0.2 + collarH + 0.08, 0] }));
    capR = neckR + 0.3;
    capH = 2.6;
  }

  // Cap, lying on its side beside the bottle.
  const capMaterial = c.cap.metal
    ? kit.metal(c.cap.metal, 0.22)
    : c.cap.opal
      ? bodyMaterial
      : c.cap.clear
        ? kit.glass({ tint: 0xffffff, distance: 50, roughness: 0.05, thickness: 0.2 })
        : kit.plastic(c.cap.plastic, 0.35, { clearcoat: 0.5 });
  const cap = kit.lathe(
    [[0, 0], [capR, 0], [capR, capH], [capR - 0.12, capH], [capR - 0.12, 0.12], [0, 0.12]],
    { radius: [0, 0.25, 0.04, 0.03, 0.1, 0] },
  );
  const angle = rng.range(0.35, 0.8);
  const capMesh = kit.mesh(cap, capMaterial, { position: [R + capR + 1.1, capR, 0.8], rotation: [0, angle, Math.PI / 2] });
  group.add(capMesh);

  return {
    object: group,
    variant: c.name,
    camera: { azimuth: 28 + rng.range(-8, 8), elevation: 14, fill: 0.72 },
    lighting: { key: 2.2, env: 1.0 },
    alt: c.airless
      ? "Slim white airless eye serum pump bottle with a silver collar and its clear cap, on a light grey background"
      : `Slim ${c.body.opal ? "white" : c.body.frosted ? "frosted lavender" : "clear"} glass eye serum roll-on bottle with a metal roller ball, cap beside it, on a light grey background`,
  };
}
