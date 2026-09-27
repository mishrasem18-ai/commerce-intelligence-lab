// RGB Mousepad: a cloth-top gaming mouse pad on a rubber base with an edge-lit RGB light strip
// all round and a small USB controller block at the back corner. Units: cm.
const VARIANTS = [
  { name: "square pad, rainbow edge", w: 36, d: 30, cloth: 0x1b1c1f, hueStart: 0, hueSpan: 1 },
  { name: "extended desk mat, rainbow edge", w: 80, d: 30, cloth: 0x18191c, hueStart: 0.1, hueSpan: 1 },
  { name: "square pad, cyan-to-magenta edge", w: 36, d: 30, cloth: 0x1e1f23, hueStart: 0.5, hueSpan: 0.35 },
  { name: "medium pad, rainbow edge", w: 45, d: 40, cloth: 0x1b1c1f, hueStart: 0.6, hueSpan: 1 },
];

export default function build({ THREE, kit, rng, seed }) {
  const v = VARIANTS[(seed - 1) % VARIANTS.length];
  const { w: W, d: D } = v;
  const corner = 1.6;
  const random = kit.rng(seed * 13);
  const group = new THREE.Group();
  const hueAt = (x, z) => {
    const a = (Math.atan2(-z / D, x / W) / (Math.PI * 2) + 1) % 1;
    const t = v.hueSpan === 1 ? a : 1 - Math.abs(1 - 2 * a);
    return (v.hueStart + t * v.hueSpan) % 1;
  };

  // Rubber base.
  group.add(kit.mesh(kit.slab(W, D, 0.3, { corner, bevel: 0.08 }), kit.rubber(0x111113, 0.9)));

  // Micro-weave cloth top, with a faint glow of the edge light bleeding onto it.
  const size = 512;
  const weave = kit.weave(random, size, 128);
  const glow = kit.canvasTexture(512, Math.round((512 * D) / W), (ctx, cw, ch) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);
    ctx.filter = `blur(${Math.round(cw / 40)}px)`;
    ctx.lineWidth = cw / 30;
    for (let i = 0; i < 180; i++) {
      const a0 = (i / 180) * Math.PI * 2;
      const a1 = ((i + 1.2) / 180) * Math.PI * 2;
      const px = (a) => [cw / 2 + Math.cos(a) * cw, ch / 2 - Math.sin(a) * ch];
      const [x0, y0] = px(a0);
      const [x1, y1] = px(a1);
      ctx.strokeStyle = `hsl(${hueAt(Math.cos(a0) * W, -Math.sin(a0) * D) * 360}, 100%, 50%)`;
      ctx.beginPath();
      ctx.moveTo(cw / 2, ch / 2);
      ctx.lineTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.closePath();
      ctx.save();
      ctx.clip();
      ctx.strokeRect(2, 2, cw - 4, ch - 4);
      ctx.restore();
    }
  });
  glow.repeat.set(1 / W, 1 / D);
  glow.offset.set(0.5, 0.5);
  const cloth = kit.rubber(v.cloth, 0.92, {
    normalMap: kit.normalMap(weave, size, 1.5),
    emissive: 0xffffff,
    emissiveMap: glow,
    emissiveIntensity: 0.35,
    sheen: 0.35,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0x4a4d55),
  });
  cloth.normalMap.repeat.set(1 / 8, 1 / 8);
  group.add(kit.mesh(kit.slab(W - 0.9, D - 0.9, 0.12, { corner: corner - 0.4, bevel: 0.03 }), cloth, { position: [0, 0.28, 0] }));

  // Edge light strip: a frosted rim around the cloth, coloured per vertex (unlit — it is the light).
  const inner = kit.roundedRectShape(W - 1.0, D - 1.0, corner - 0.45);
  const rimShape = kit.roundedRectShape(W, D, corner);
  rimShape.holes.push(new THREE.Path(inner.getPoints(48).reverse()));
  const rim = new THREE.ExtrudeGeometry(rimShape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 4, curveSegments: 48 });
  rim.rotateX(-Math.PI / 2);
  rim.translate(0, 0.24, 0);
  const colors = [];
  const pos = rim.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.setHSL(hueAt(pos.getX(i), pos.getZ(i)), 1, 0.55, THREE.SRGBColorSpace);
    colors.push(c.r * 1.25, c.g * 1.25, c.b * 1.25);
  }
  rim.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  group.add(kit.mesh(rim, new THREE.MeshBasicMaterial({ vertexColors: true }), { castShadow: false }));

  // USB controller block (with a small button) at the back-left corner, cable out the back.
  const block = new THREE.Group();
  block.add(kit.mesh(kit.slab(4.2, 2.6, 0.9, { corner: 0.6, bevel: 0.2 }), kit.plastic(0x141416, 0.5)));
  block.add(kit.mesh(kit.lathe([[0, 0], [0.35, 0], [0.35, 0.1], [0, 0.14]], { radius: [0, 0.02, 0.04, 0] }), kit.plastic(0x2b2c30, 0.3), { position: [1.1, 0.9, 0.2] }));
  block.position.set(-W / 2 + 4.5, 0.25, -D / 2 - 0.2);
  group.add(block);
  const cableMaterial = kit.rubber(0x151517, 0.6);
  const start = new THREE.Vector3(-W / 2 + 4.5, 0.6, -D / 2 - 1.5);
  const path = new THREE.CatmullRomCurve3([
    start,
    start.clone().add(new THREE.Vector3(0, -0.2, -1.5)),
    start.clone().add(new THREE.Vector3(1.5, -0.4, -4.5)),
    start.clone().add(new THREE.Vector3(5, -0.4, -6.5)),
    start.clone().add(new THREE.Vector3(9, -0.4, -6.8)),
  ]);
  group.add(kit.mesh(new THREE.TubeGeometry(path, 120, 0.22, 16, false), cableMaterial));
  const tip = path.getPoint(1);
  const dir = path.getTangent(1).setY(0).normalize();
  const plug = kit.mesh(kit.roundedBox(1.6, 0.8, 3.0, 0.25, 4), cableMaterial);
  plug.position.copy(tip).addScaledVector(dir, 1.4).setY(0.4);
  plug.rotation.y = Math.atan2(dir.x, dir.z);
  const pin = kit.mesh(kit.roundedBox(1.25, 0.5, 1.3, 0.04, 2), kit.metal(0xc0c0c4, 0.25));
  pin.position.copy(tip).addScaledVector(dir, 3.5).setY(0.4);
  pin.rotation.y = plug.rotation.y;
  group.add(plug, pin);

  group.rotation.y = rng.range(-0.15, 0.1);
  return {
    object: group,
    variant: v.name,
    camera: { azimuth: 22 + rng.range(-6, 6), elevation: W > 60 ? 30 : 38, fill: 0.86 },
    lighting: { key: 2.0, env: 0.8 },
    alt: `Black cloth ${v.w > 60 ? "extended RGB desk mat" : "RGB gaming mouse pad"} with a glowing ${v.hueSpan === 1 ? "rainbow" : "cyan-to-magenta"} light strip around the edge, on a light grey background`,
  };
}
