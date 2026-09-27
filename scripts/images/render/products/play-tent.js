// Play Tent: a children's teepee — four wooden poles crossing and tied near the top, cotton
// canvas panels sagging slightly between them, a front door with its flaps rolled back, a
// padded floor mat inside and (in some variants) a garland of plain pennants. Units: cm.
const VARIANTS = [
  { name: "natural canvas, pale-wood poles", canvas: 0xefe8da, stripe: null, pennants: [0xe8a0a0, 0xf2d27a, 0x9cc5b4, 0x9db6d9], mat: 0xd9cbb4 },
  { name: "grey-and-white striped canvas", canvas: 0xf2f2f0, stripe: 0x8f949b, pennants: null, mat: 0xa9adb3 },
  { name: "blush-pink canvas", canvas: 0xefc9c4, stripe: null, pennants: [0xffffff, 0xd98f89, 0xf2e3c9], mat: 0xf4ece4 },
  { name: "sage-green canvas", canvas: 0xb9c9b0, stripe: null, pennants: [0xf4efe4, 0xe0b86a, 0x8fa988], mat: 0xece6d8 },
];

export default function build({ THREE, kit, rng, seed }) {
  const v = VARIANTS[(seed - 1) % VARIANTS.length];
  const random = kit.rng(seed * 23);
  const S = rng.range(108, 116); // base square side
  const cross = rng.range(150, 160); // height where the poles cross
  const group = new THREE.Group();

  const base = [
    new THREE.Vector3(-S / 2, 0, S / 2), // front-left
    new THREE.Vector3(S / 2, 0, S / 2), // front-right
    new THREE.Vector3(S / 2, 0, -S / 2), // back-right
    new THREE.Vector3(-S / 2, 0, -S / 2), // back-left
  ];
  const apex = new THREE.Vector3(0, cross, 0);
  const along = (p, t) => p.clone().lerp(apex, t);

  // Poles: from each base corner through the crossing and ~20 % beyond.
  const woodMap = kit.woodTexture(random, "#e0c8a2", "#b08f62", 512, 64);
  const poleMaterial = new THREE.MeshPhysicalMaterial({ map: woodMap, roughness: 0.6, clearcoat: 0.2 });
  for (const p of base) {
    const end = along(p, 1.2);
    const len = p.distanceTo(end);
    const pole = kit.mesh(new THREE.CylinderGeometry(1.3, 1.4, len, 20), poleMaterial);
    pole.position.copy(p).lerp(end, 0.5);
    pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(p).normalize());
    group.add(pole);
  }
  // Rope lashing at the crossing.
  for (let i = 0; i < 5; i++) {
    group.add(kit.mesh(new THREE.TorusGeometry(2.6, 0.45, 12, 48), kit.rubber(0xcdb996, 0.9), { position: [0, cross - 5 + i * 1.1, 0], rotation: [Math.PI / 2, 0, 0] }));
  }

  // Canvas: weave normal map, optional vertical stripes (u runs across a panel).
  const weave = kit.weave(random, 256, 64);
  const normalMap = kit.normalMap(weave, 256, 1.0);
  normalMap.repeat.set(30, 40);
  const stripeMap = v.stripe
    ? kit.canvasTexture(512, 8, (ctx, w, h) => {
        const hex = (c) => `#${new THREE.Color(c).getHexString()}`;
        for (let i = 0; i < 16; i++) {
          ctx.fillStyle = i % 2 ? hex(v.stripe) : hex(v.canvas);
          ctx.fillRect((i * w) / 16, 0, w / 16, h);
        }
      })
    : null;
  const canvas = kit.rubber(v.stripe ? 0xffffff : v.canvas, 0.9, {
    map: stripeMap,
    normalMap,
    side: THREE.DoubleSide,
    sheen: 0.4,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0xffffff),
  });

  const top = 0.84; // canvas stops below the crossing
  const door = { height: 0.68, width: 0.78 }; // fraction of panel height / half-width at the floor
  // Panel between corners a (left) and b (right). `u0(v)`/`u1(v)` bound the fabric across the
  // panel at height fraction v, so the door is simply a narrower span.
  function panel(a, b, spans) {
    const segU = 40;
    const segV = 48;
    const centre = new THREE.Vector3();
    for (const [u0, u1] of spans) {
      const positions = [];
      const uvs = [];
      const index = [];
      for (let j = 0; j <= segV; j++) {
        const t = (j / segV) * top;
        const pa = along(a, t);
        const pb = along(b, t);
        const lo = u0(t / top);
        const hi = u1(t / top);
        for (let i = 0; i <= segU; i++) {
          const u = lo + ((hi - lo) * i) / segU;
          const p = pa.clone().lerp(pb, u);
          // Sag inward between the poles, more near the floor where the span is wide.
          centre.set(0, p.y, 0);
          const inward = centre.sub(p).setY(0).normalize();
          const sag = Math.sin(Math.PI * u) * (3.2 * (1 - t / top) + 0.8);
          p.addScaledVector(inward, sag);
          // Hem flare at the floor.
          if (t < 0.02) p.addScaledVector(inward, -0.8);
          positions.push(p.x, p.y, p.z);
          uvs.push(u, t);
        }
      }
      for (let j = 0; j < segV; j++) {
        for (let i = 0; i < segU; i++) {
          const k = j * (segU + 1) + i;
          index.push(k, k + segU + 1, k + 1, k + 1, k + segU + 1, k + segU + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(index);
      g.computeVertexNormals();
      group.add(kit.mesh(g, canvas));
    }
  }
  const full = [[() => 0, () => 1]];
  const halfOpen = (h) => (h < door.height ? door.width * 0.5 * (1 - h / door.height) ** 0.9 : 0);
  panel(base[0], base[1], [
    [() => 0, (h) => 0.5 - halfOpen(h)],
    [(h) => 0.5 + halfOpen(h), () => 1],
  ]);
  panel(base[1], base[2], full);
  panel(base[2], base[3], full);
  panel(base[3], base[0], full);

  // Rolled-back door flaps along both door edges, tied at mid-height.
  const rollMaterial = canvas.clone();
  rollMaterial.side = THREE.FrontSide;
  for (const s of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 20; k++) {
      const h = (k / 20) * door.height;
      const t = h * top;
      const u = 0.5 + s * halfOpen(h);
      const p = along(base[0], t).lerp(along(base[1], t), u);
      p.z += 2.5;
      p.x += s * 2.5;
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    group.add(kit.mesh(new THREE.TubeGeometry(curve, 60, 3.2, 16, false), rollMaterial));
    const tie = curve.getPoint(0.45);
    group.add(kit.mesh(new THREE.TorusGeometry(3.6, 0.5, 10, 32), kit.rubber(v.pennants ? v.pennants[1] : 0x6d7178, 0.8), { position: [tie.x, tie.y, tie.z], rotation: [Math.PI / 2, 0, 0] }));
  }

  // Padded round floor mat, visible through the door.
  const mat = kit.lathe([[0, 0], [S * 0.42, 0], [S * 0.44, 2.5], [S * 0.42, 5], [0, 5.5]], { radius: [0, 1.5, 2.5, 2, 0], segments: 120 });
  group.add(kit.mesh(mat, kit.rubber(v.mat, 0.9, { sheen: 0.5 }), { position: [0, 0.2, 4] }));

  // Pennant garland across the front, just below the canvas top.
  if (v.pennants) {
    const y0 = cross * 0.66;
    const left = along(base[0], y0 / cross);
    const right = along(base[1], y0 / cross);
    left.z += 1.2;
    right.z += 1.2;
    const mid = left.clone().lerp(right, 0.5);
    mid.y -= 6;
    mid.z += 1;
    const string = new THREE.QuadraticBezierCurve3(left, mid, right);
    group.add(kit.mesh(new THREE.TubeGeometry(string, 40, 0.18, 6, false), kit.rubber(0xe9e2d2, 0.8)));
    const n = 5;
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const p = string.getPoint(t);
      const shape = new THREE.Shape();
      shape.moveTo(-4.6, 0);
      shape.lineTo(4.6, 0);
      shape.lineTo(0, -9.5);
      shape.closePath();
      const flag = kit.mesh(new THREE.ShapeGeometry(shape), kit.rubber(v.pennants[i % v.pennants.length], 0.85, { side: THREE.DoubleSide }), { position: [p.x, p.y, p.z + 0.3] });
      group.add(flag);
    }
  }

  group.rotation.y = rng.range(0.12, 0.26);
  return {
    object: group,
    variant: v.name,
    camera: { azimuth: 26 + rng.range(-6, 6), elevation: 12, fill: 0.8 },
    lighting: { keyElevation: 50, softness: 0.3 },
    alt: `Children's teepee play tent in ${v.name.replace(", pale-wood poles", "")} on wooden poles, door flaps tied back to show a padded floor mat, on a light grey background`,
  };
}
