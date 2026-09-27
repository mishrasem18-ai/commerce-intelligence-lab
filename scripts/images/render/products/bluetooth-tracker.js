// Bluetooth Tracker: a small key-finder tag (rounded square or disc with a lanyard hole), shown
// with a steel split ring through the hole, resting tilted on the ring. Units: cm.
const VARIANTS = [
  { name: "white rounded-square tag, steel key ring", shape: "square", face: 0xf6f6f4, edge: 0xd9d9dc, ring: true },
  { name: "graphite rounded-square tag, steel key ring", shape: "square", face: 0x2a2b2e, edge: 0x3a3b3f, ring: true },
  { name: "sage-green round tag with tab, steel key ring", shape: "disc", face: 0xa9c2a6, edge: 0xf4f4f2, ring: true },
  { name: "white rounded-square tag with graphite rim, steel key ring", shape: "square", face: 0xf6f6f4, edge: 0x2a2b2e, ring: true },
];

export default function build({ THREE, kit, rng, seed }) {
  const v = VARIANTS[(seed - 1) % VARIANTS.length];
  const T = 0.72;
  const faceMaterial = kit.plastic(v.face, 0.28, { clearcoat: 0.8, clearcoatRoughness: 0.12 });
  const edgeMaterial = kit.plastic(v.edge, 0.45, { clearcoat: 0.2 });
  const tag = new THREE.Group();
  let hole;
  const holeR = 0.3;

  if (v.shape === "square") {
    const S = rng.range(3.6, 4.0);
    const corner = 1.0;
    hole = new THREE.Vector3(S / 2 - 0.62, T / 2, -(S / 2 - 0.62));
    const holePath = new THREE.Path().absarc(hole.x, -hole.z, holeR + 0.12, 0, Math.PI * 2, true);
    // Two-tone: a coloured rim band and a glossy face shell on top.
    tag.add(kit.mesh(kit.slab(S, S, T * 0.55, { corner, bevel: 0.1, holes: [holePath] }), edgeMaterial));
    const holePath2 = new THREE.Path().absarc(hole.x, -hole.z, holeR + 0.12, 0, Math.PI * 2, true);
    tag.add(kit.mesh(kit.slab(S, S, T * 0.5, { corner, bevel: 0.2, holes: [holePath2] }), faceMaterial, { position: [0, T * 0.5, 0] }));
  } else {
    const D = rng.range(3.3, 3.6);
    const disc = kit.lathe([[0, 0], [D / 2, 0], [D / 2, T * 0.7], [D / 2 - 0.35, T + 0.08], [0, T + 0.12]], { radius: [0, 0.12, 0.25, 0.4, 0] });
    tag.add(kit.mesh(disc, faceMaterial));
    // Lanyard tab, merging into the disc's edge.
    const tabShape = kit.roundedRectShape(1.5, 1.7, 0.7);
    tabShape.holes.push(new THREE.Path().absarc(0, 0.25, holeR + 0.05, 0, Math.PI * 2, true));
    const tab = new THREE.ExtrudeGeometry(tabShape, { depth: T * 0.45, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 5, curveSegments: 32 });
    tab.rotateX(-Math.PI / 2);
    tab.translate(0, 0.08, 0);
    const tabMesh = kit.mesh(tab, edgeMaterial);
    const dir = new THREE.Vector3(1, 0, -1).normalize();
    tabMesh.position.copy(dir.clone().multiplyScalar(D / 2 + 0.2));
    tabMesh.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
    tag.add(tabMesh);
    hole = dir.clone().multiplyScalar(D / 2 + 0.45).setY(0.24);
  }

  const group = new THREE.Group();
  group.add(tag);

  if (v.ring) {
    const Rr = 1.3;
    const d = new THREE.Vector3(hole.x, 0, hole.z).normalize();
    const ringGeo = new THREE.TorusGeometry(Rr, 0.075, 24, 200, Math.PI * 2 * 0.97);
    const ring = kit.mesh(ringGeo, kit.metal(0xdcdcde, 0.18));
    ring.position.copy(hole).addScaledVector(d, Rr);
    ring.rotation.set(0, Math.atan2(-d.z, d.x), 0);
    group.add(ring);
    // Second coil of the split ring, offset slightly.
    const coil = kit.mesh(new THREE.TorusGeometry(Rr, 0.075, 24, 200, Math.PI * 2 * 0.6), kit.metal(0xdcdcde, 0.18));
    coil.position.copy(ring.position);
    coil.rotation.copy(ring.rotation);
    coil.translateZ(0.15);
    coil.rotateZ(Math.PI * 0.9);
    group.add(coil);

    // Tilt the whole assembly about the horizontal axis ⟂ d until tag and ring both touch down.
    const axis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d).normalize();
    const lowest = (object, q) => {
      object.updateMatrixWorld(true);
      const box = new THREE.Box3();
      const probe = object.clone();
      probe.applyQuaternion(q);
      probe.updateMatrixWorld(true);
      box.setFromObject(probe, true);
      return box.min.y;
    };
    let best = 0;
    let bestDiff = Infinity;
    for (let a = 0; a <= 0.6; a += 0.005) {
      const q = new THREE.Quaternion().setFromAxisAngle(axis, a);
      const pivotRing = new THREE.Group();
      pivotRing.add(ring.clone(), coil.clone());
      const diff = Math.abs(lowest(tag, q) - lowest(pivotRing, q));
      if (diff < bestDiff) {
        bestDiff = diff;
        best = a;
      }
    }
    group.quaternion.setFromAxisAngle(axis, best);
  }

  const outer = new THREE.Group();
  outer.add(group);
  outer.rotation.y = rng.range(-0.3, 0.3) + (v.ring ? 0.35 : 0);
  return {
    object: outer,
    variant: v.name,
    camera: { azimuth: 32 + rng.range(-8, 8), elevation: 34, fill: 0.7 },
    lighting: { shadow: 0.6 },
    alt: `${v.shape === "square" ? "Rounded-square" : "Round"} ${v.name.split(" ")[0].replace("-", " ")} Bluetooth tracker tag${v.ring ? " on a steel key ring" : ""}, on a light grey background`,
  };
}
