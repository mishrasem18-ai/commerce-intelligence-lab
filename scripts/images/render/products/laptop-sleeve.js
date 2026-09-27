// Laptop Sleeve: a padded sleeve lying flat — wool-felt envelope with a fold-over flap and a
// leather strap + stud, or a neoprene sleeve zipped along two sides. Units: cm.
const VARIANTS = [
  { name: "grey wool felt envelope, tan leather strap", style: "envelope", felt: 0x8d8f93, strap: 0x9a5b2e, stud: 0xc9a34f },
  { name: "navy wool felt envelope, brown leather strap", style: "envelope", felt: 0x2c3a58, strap: 0x5a3a24, stud: 0xc9a34f },
  { name: "charcoal neoprene, two-side zip", style: "zip", felt: 0x333539, zip: 0x1a1a1b, pull: 0xb9bbbf },
  { name: "oatmeal wool felt envelope, black leather strap", style: "envelope", felt: 0xc3b8a4, strap: 0x1f1d1c, stud: 0xb8b8bc },
];

export default function build({ THREE, kit, rng, seed }) {
  const v = VARIANTS[(seed - 1) % VARIANTS.length];
  const W = rng.range(35, 37);
  const L = rng.range(25, 26.5);
  const random = kit.rng(seed * 17);
  const group = new THREE.Group();

  // Felt / neoprene surface: heathered colour variation + fine fibre normal map.
  const size = 512;
  const fibres = kit.fbm(random, size, 64, 3);
  const heather = kit.fbm(random, size, 16, 4);
  const material = kit.rubber(v.felt, v.style === "zip" ? 0.7 : 0.95, {
    map: kit.greyMap(heather, size, 0.93, 1.0, 1 / 12),
    normalMap: kit.normalMap(fibres, size, v.style === "zip" ? 1.2 : 3.5, 1 / 6),
    sheen: v.style === "zip" ? 0.2 : 0.6,
    sheenRoughness: 0.9,
    sheenColor: new THREE.Color(v.felt).offsetHSL(0, 0, 0.15),
  });
  // Extrude UVs are in world units (cm): map repeats every 12 cm, normal every 6 cm.
  material.map.repeat.set(1 / 12, 1 / 12);
  material.normalMap.repeat.set(1 / 6, 1 / 6);

  if (v.style === "envelope") {
    const T = 1.4;
    group.add(kit.mesh(kit.slab(W, L, T, { corner: 1.4, bevel: 0.55 }), material));
    // Fold-over flap along the back (−z) edge: overhangs the edge so it reads as a fold.
    const flapDepth = L * rng.range(0.34, 0.4);
    const flapT = 0.42;
    const flap = kit.mesh(kit.slab(W + 0.1, flapDepth + 0.5, flapT, { corner: 1.4, bevel: 0.2 }), material, {
      position: [0, T - 0.12, -L / 2 + flapDepth / 2 - 0.2],
    });
    group.add(flap);
    const fold = new THREE.CylinderGeometry(T / 2 + 0.26, T / 2 + 0.26, W - 2.2, 48, 1, false, Math.PI / 2, Math.PI);
    group.add(kit.mesh(fold, material, { position: [0, T / 2 + 0.05, -L / 2 + 0.55], rotation: [0, 0, Math.PI / 2] }));

    // Leather strap: over the flap, down its front edge onto the body, ending at a stud.
    const strapMaterial = kit.plastic(v.strap, 0.55, { clearcoat: 0.3, clearcoatRoughness: 0.5, sheen: 0.2 });
    const sw = 2.6;
    const top = T - 0.12 + flapT;
    const flapFront = -L / 2 + flapDepth + 0.05;
    const x = W * rng.range(0.12, 0.2) * (seed % 2 ? 1 : -1);
    const onFlap = flapDepth - 1.5;
    group.add(kit.mesh(kit.roundedBox(sw, 0.2, onFlap, 0.08, 3), strapMaterial, { position: [x, top + 0.08, flapFront - onFlap / 2] }));
    const drop = new THREE.Vector2(1.2, top - T);
    const slope = kit.mesh(kit.roundedBox(sw, 0.2, drop.length() + 0.2, 0.08, 3), strapMaterial);
    slope.position.set(x, (top + T) / 2 + 0.08, flapFront + drop.x / 2);
    slope.rotation.x = Math.atan2(drop.y, drop.x);
    group.add(slope);
    const tail = 3.0;
    const tailShape = kit.roundedRectShape(sw, tail, sw / 2 - 0.01);
    const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 24 });
    tailGeo.rotateX(-Math.PI / 2);
    group.add(kit.mesh(tailGeo, strapMaterial, { position: [x, T + 0.04, flapFront + drop.x + tail / 2 - 0.4] }));
    const stud = kit.lathe([[0, 0], [0.55, 0], [0.55, 0.12], [0.4, 0.3], [0, 0.34]], { radius: [0, 0.03, 0.08, 0.1, 0] });
    group.add(kit.mesh(stud, kit.metal(v.stud, 0.25), { position: [x, T + 0.2, flapFront + drop.x + tail - 1.6] }));
    // Stitch line inset along the flap edge (tiny dashes).
    const stitch = kit.plastic(new THREE.Color(v.felt).offsetHSL(0, 0, -0.12), 0.9);
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.03, 0.06), stitch, Math.floor((W - 3) / 0.7));
    const m = new THREE.Matrix4();
    for (let i = 0; i < dashes.count; i++) {
      m.makeTranslation(-W / 2 + 1.6 + i * 0.7, top + 0.005, flapFront - 0.6);
      dashes.setMatrixAt(i, m);
    }
    group.add(dashes);
  } else {
    const T = 2.0;
    group.add(kit.mesh(kit.slab(W, L, T, { corner: 2.4, bevel: 0.9, bevelSegments: 10 }), material));
    // Zip along the back (−z) edge and round the right (+x) side, at mid-height.
    const r = 2.4;
    const pts = [];
    for (let x = -W / 2 + r; x <= W / 2 - r; x += 0.5) pts.push(new THREE.Vector3(x, T / 2, -L / 2 - 0.02));
    for (let a = -Math.PI / 2; a <= 0; a += 0.08) pts.push(new THREE.Vector3(W / 2 - r + Math.cos(a) * (r + 0.02), T / 2, -L / 2 + r + Math.sin(a) * (r + 0.02)));
    for (let z = -L / 2 + r; z <= L / 2 - r; z += 0.5) pts.push(new THREE.Vector3(W / 2 + 0.02, T / 2, z));
    const path = new THREE.CatmullRomCurve3(pts);
    group.add(kit.mesh(new THREE.TubeGeometry(path, 600, 0.2, 10, false), kit.rubber(v.zip, 0.8)));
    const count = Math.floor(path.getLength() / 0.28);
    const teeth = new THREE.InstancedMesh(kit.roundedBox(0.2, 0.16, 0.5, 0.05, 1), kit.plastic(v.zip, 0.35, { clearcoat: 0.5 }), count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const p = path.getPointAt(t);
      const tangent = path.getTangentAt(t);
      q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent);
      m.compose(p, q, new THREE.Vector3(1, 1, 1));
      teeth.setMatrixAt(i, m);
    }
    group.add(teeth);
    // Slider + pull tab near the corner.
    const at = 0.62;
    const p = path.getPointAt(at);
    const tangent = path.getTangentAt(at);
    const yaw = Math.atan2(-tangent.z, tangent.x);
    const slider = kit.mesh(kit.roundedBox(1.2, 0.5, 0.9, 0.18, 3), kit.metal(v.pull, 0.25));
    slider.position.copy(p);
    slider.rotation.y = yaw;
    group.add(slider);
    const outward = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const pull = kit.mesh(kit.roundedBox(0.9, 0.16, 2.6, 0.08, 3), kit.metal(v.pull, 0.25));
    pull.position.copy(p).addScaledVector(outward, 1.5).setY(0.25);
    pull.rotation.y = yaw + Math.PI / 2;
    pull.rotation.z = 0.0;
    pull.rotateX(-0.35);
    group.add(pull);
  }

  group.rotation.y = rng.range(-0.2, 0.05);
  return {
    object: group,
    variant: v.name,
    camera: { azimuth: 24 + rng.range(-6, 6), elevation: 36, fill: 0.84 },
    alt:
      v.style === "zip"
        ? "Charcoal neoprene laptop sleeve with a two-side zip, lying flat on a light grey background"
        : `${v.name.split(" ")[0][0].toUpperCase() + v.name.split(" ")[0].slice(1)} wool-felt laptop sleeve with a fold-over flap and leather strap, lying flat on a light grey background`,
  };
}
