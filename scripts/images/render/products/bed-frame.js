// Bed Frame: a modern queen platform bed frame — side and foot rails on legs, a slatted base
// with a centre support, and a headboard (wood panel, channel-tufted upholstery or metal
// spindles). Shown bare so the slats read as a frame. Units: cm.
const VARIANTS = [
  { name: "natural oak frame, oak panel headboard", style: "wood", light: "#d8b98e", dark: "#9a7448" },
  { name: "grey upholstered frame, channel-tufted headboard", style: "upholstered", fabric: 0x8e9095, legs: "#3a2a1f", legsDark: "#20160f" },
  { name: "black metal frame, spindle headboard", style: "metal", metal: 0x1f2023 },
  { name: "walnut frame, cream upholstered headboard", style: "upholstered", fabric: 0xd9d2c4, rails: { light: "#7e5236", dark: "#442a18" }, legs: "#7e5236", legsDark: "#442a18" },
];

export default function build({ THREE, kit, rng, seed }) {
  const v = VARIANTS[(seed - 1) % VARIANTS.length];
  const random = kit.rng(seed * 11);
  const W = 160;
  const L = rng.range(203, 208);
  const legH = v.style === "metal" ? 22 : 14;
  const railH = v.style === "metal" ? 4 : 18;
  const railT = v.style === "metal" ? 4 : 4.5;
  const railY = legH + railH / 2;
  const group = new THREE.Group();

  const woodMaterials = (light, dark) => {
    const map = kit.woodTexture(random, light, dark, 1024, 256, 0.07);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    const along = new THREE.MeshPhysicalMaterial({ map, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4 });
    const across = along.clone();
    across.map = map.clone();
    across.map.rotation = Math.PI / 2;
    across.map.needsUpdate = true;
    return { along, across };
  };

  // Upholstery: woven fabric normal map; roundedBox UVs are 0–1 per face, so repeat per mesh.
  const weave = kit.weave(random, 256, 64);
  const fabric = (repeatX, repeatY) => {
    const normalMap = kit.normalMap(weave, 256, 1.2);
    normalMap.repeat.set(repeatX, repeatY);
    return kit.rubber(v.fabric, 0.92, { normalMap, sheen: 0.5, sheenRoughness: 0.7, sheenColor: new THREE.Color(v.fabric).offsetHSL(0, 0, 0.1) });
  };

  let railSide;
  let railEnd;
  let slatMaterial;
  let legMaterial;
  if (v.style === "wood") {
    const wood = woodMaterials(v.light, v.dark);
    railSide = wood.across;
    railEnd = wood.along;
    slatMaterial = wood.along;
    legMaterial = wood.across;
  } else if (v.style === "metal") {
    railSide = railEnd = legMaterial = new THREE.MeshPhysicalMaterial({ color: v.metal, metalness: 0.6, roughness: 0.45, clearcoat: 0.3 });
    slatMaterial = woodMaterials("#c9a87c", "#8e6a42").along;
  } else {
    railSide = fabric(40, 4);
    railEnd = fabric(30, 4);
    if (v.rails) {
      const wood = woodMaterials(v.rails.light, v.rails.dark);
      railSide = wood.across;
      railEnd = wood.along;
    }
    legMaterial = woodMaterials(v.legs, v.legsDark).across;
    slatMaterial = woodMaterials("#d9c09a", "#a2865c").along;
  }

  const r = v.style === "metal" ? 0.8 : 1.2;
  // Side rails and foot rail.
  for (const s of [-1, 1]) group.add(kit.mesh(kit.roundedBox(railT, railH, L, r, 3), railSide, { position: [s * (W / 2 + railT / 2), railY, 0] }));
  group.add(kit.mesh(kit.roundedBox(W + railT * 2, railH, railT, r, 3), railEnd, { position: [0, railY, L / 2 + railT / 2] }));

  // Slats on ledgers, with a centre support beam.
  const slatTop = v.style === "metal" ? legH + railH : legH + railH - 3;
  for (const s of [-1, 1]) group.add(kit.mesh(kit.roundedBox(3, 3, L - 2, 0.5, 2), slatMaterial, { position: [s * (W / 2 - 1.5), slatTop - 3.5, 0] }));
  group.add(kit.mesh(kit.roundedBox(5, 6, L - 2, 0.6, 2), v.style === "metal" ? railSide : slatMaterial, { position: [0, slatTop - 5, 0] }));
  const slats = 17;
  const pitch = (L - 8) / (slats - 1);
  for (let i = 0; i < slats; i++) {
    group.add(kit.mesh(kit.roundedBox(W - 1, 1.8, 7.5, 0.5, 2), slatMaterial, { position: [0, slatTop - 0.9, -L / 2 + 4 + i * pitch] }));
  }

  // Legs: corners, plus a centre leg under the support.
  const legPositions = [
    [-(W / 2 + railT / 2), L / 2 + railT / 2 - 3],
    [W / 2 + railT / 2, L / 2 + railT / 2 - 3],
    [-(W / 2 + railT / 2), -L / 2 + 4],
    [W / 2 + railT / 2, -L / 2 + 4],
    [0, 0],
  ];
  for (const [x, z] of legPositions) {
    const leg =
      v.style === "metal"
        ? kit.roundedBox(4, legH, 4, 0.6, 2)
        : kit.lathe([[0, 0], [2.0, 0], [3.0, legH], [0, legH]], { radius: [0, 0.3, 0.4, 0], segments: 48 });
    group.add(kit.mesh(leg, legMaterial, { position: [x, v.style === "metal" ? legH / 2 : 0, z] }));
  }

  // Headboard at the back (−z).
  const hbZ = -L / 2 - 4;
  const hbTop = rng.range(112, 122);
  if (v.style === "wood") {
    const wood = woodMaterials(v.light, v.dark);
    group.add(kit.mesh(kit.roundedBox(W + 12, hbTop - legH, 5, 1.5, 3), wood.along, { position: [0, legH + (hbTop - legH) / 2, hbZ] }));
    for (const s of [-1, 1]) group.add(kit.mesh(kit.roundedBox(6, hbTop + 2, 6, 1.2, 3), legMaterial, { position: [s * (W / 2 + 6), (hbTop + 2) / 2, hbZ] }));
  } else if (v.style === "metal") {
    for (const s of [-1, 1]) group.add(kit.mesh(kit.roundedBox(4, hbTop, 4, 0.8, 2), railSide, { position: [s * (W / 2 + 2), hbTop / 2, hbZ] }));
    group.add(kit.mesh(kit.roundedBox(W + 8, 4, 4, 0.8, 2), railSide, { position: [0, hbTop - 2, hbZ] }));
    group.add(kit.mesh(kit.roundedBox(W + 8, 3, 3, 0.6, 2), railSide, { position: [0, legH + railH + 18, hbZ] }));
    const spindles = 13;
    for (let i = 0; i < spindles; i++) {
      const x = -W / 2 + ((i + 1) * W) / (spindles + 1);
      group.add(kit.mesh(new THREE.CylinderGeometry(0.9, 0.9, hbTop - legH - railH - 20, 16), railSide, { position: [x, (hbTop + legH + railH + 18) / 2, hbZ] }));
    }
    // Foot posts.
    for (const s of [-1, 1]) group.add(kit.mesh(kit.roundedBox(4, legH + railH + 12, 4, 0.8, 2), railSide, { position: [s * (W / 2 + 2), (legH + railH + 12) / 2, L / 2 + 2] }));
  } else {
    // Channel-tufted panel: vertical padded channels on a frame.
    const hbH = hbTop - legH - 8;
    const channels = 9;
    const cw = (W + 14) / channels;
    for (let i = 0; i < channels; i++) {
      const x = -(W + 14) / 2 + cw * (i + 0.5);
      group.add(kit.mesh(kit.roundedBox(cw - 0.6, hbH, 9, 4, 5), fabric(3, 14), { position: [x, legH + 8 + hbH / 2, hbZ] }));
    }
    group.add(kit.mesh(kit.roundedBox(W + 14, 8.5, 7, 1.5, 3), railEnd, { position: [0, legH + 4.2, hbZ] }));
    for (const s of [-1, 1]) group.add(kit.mesh(kit.lathe([[0, 0], [2.0, 0], [3.0, legH], [0, legH]], { radius: [0, 0.3, 0.4, 0], segments: 48 }), legMaterial, { position: [s * (W / 2 + 4), 0, hbZ] }));
  }

  group.rotation.y = rng.range(-0.08, 0.04);
  return {
    object: group,
    variant: v.name,
    camera: { azimuth: 38 + rng.range(-5, 5), elevation: 30, fill: 0.82 },
    lighting: { keyElevation: 58, softness: 0.3 },
    alt: `${v.name.split(",")[0].replace(/^\w/, (ch) => ch.toUpperCase())} queen platform bed frame with ${v.name.split(", ")[1].replace(/^oak |^cream /, "a ")} and wooden slats, shown bare on a light grey background`,
  };
}
