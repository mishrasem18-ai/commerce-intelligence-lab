/**
 * Static demo catalog for the Products module.
 *
 * The dataset is generated deterministically (a seeded PRNG — no `Math.random`
 * or `Date.now`) so the exact same values are produced on the server and the
 * client, avoiding hydration mismatches. No backend, no APIs.
 */

export const PRODUCT_CATEGORIES = [
  "Electronics",
  "Fashion",
  "Home",
  "Sports",
  "Books",
  "Beauty",
  "Furniture",
  "Accessories",
  "Gaming",
  "Toys",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_STATUSES = ["Active", "Draft", "Archived"] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** Inventory at or below this (and above zero) is considered "low stock". */
export const LOW_STOCK_THRESHOLD = 25;

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: ProductCategory;
  brand: string;
  price: number;
  cost: number;
  inventory: number;
  status: ProductStatus;
  rating: number;
  image: string;
  unitsSold: number;
  revenue: number;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Deterministic generation                                                  */
/* -------------------------------------------------------------------------- */

/** mulberry32 — small, fast, deterministic PRNG seeded per product index. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function intBetween(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

interface CategoryBlueprint {
  brands: string[];
  nouns: string[];
  priceRange: [number, number];
}

const BLUEPRINTS: Record<ProductCategory, CategoryBlueprint> = {
  Electronics: {
    brands: ["Aurora", "Nimbus", "Vertex", "Lumen", "Cobalt", "Zenith", "Halcyon", "Pulse"],
    nouns: [
      "Wireless Headphones", "Smart Speaker", "4K Webcam", "Noise-Cancelling Earbuds",
      "Portable SSD", "Mechanical Keyboard", "USB-C Hub", "Bluetooth Tracker",
      "Smartwatch", "Action Camera", "Power Bank", "Wireless Charger",
    ],
    priceRange: [39, 499],
  },
  Fashion: {
    brands: ["Meridian", "Atelier", "Nord", "Ember", "Vela", "Loom"],
    nouns: [
      "Merino Sweater", "Oxford Shirt", "Slim Chinos", "Wool Overcoat", "Linen Blazer",
      "Denim Jacket", "Cashmere Scarf", "Leather Belt", "Silk Tie", "Knit Beanie",
    ],
    priceRange: [29, 289],
  },
  Home: {
    brands: ["Halo", "Terra", "Hearth", "Nook", "Loft"],
    nouns: [
      "Desk Lamp", "Ceramic Vase", "Throw Blanket", "Scented Candle", "Wall Clock",
      "Area Rug", "Picture Frame", "Storage Basket", "Table Runner", "Planter Set",
    ],
    priceRange: [18, 199],
  },
  Sports: {
    brands: ["Apex", "Summit", "Torque", "Stride", "Vanta"],
    nouns: [
      "Yoga Mat", "Resistance Bands", "Dumbbell Set", "Running Shoes", "Cycling Helmet",
      "Foam Roller", "Water Bottle", "Jump Rope", "Training Gloves", "Compression Tee",
    ],
    priceRange: [15, 249],
  },
  Books: {
    brands: ["Inkwell", "Chapterhouse", "Paperbound", "Marginalia"],
    nouns: [
      "The Silent Ledger", "Atlas of Small Things", "Notes on Momentum", "A Field of Signals",
      "The Long Quarter", "Systems & Seasons", "Blueprints for Nothing", "The Analog Mind",
      "Ledgers & Legends", "Quiet Machines",
    ],
    priceRange: [9, 45],
  },
  Beauty: {
    brands: ["Lumiere", "Botanica", "Dewpoint", "Velvet", "Aura"],
    nouns: [
      "Vitamin C Serum", "Hydrating Cleanser", "Matte Lipstick", "Facial Roller",
      "Night Cream", "Sunscreen SPF 50", "Hair Oil", "Clay Mask", "Lip Balm Trio", "Eye Serum",
    ],
    priceRange: [12, 129],
  },
  Furniture: {
    brands: ["Oakcraft", "Nordhaus", "Timbre", "Loft & Co", "Basswood"],
    nouns: [
      "Lounge Chair", "Oak Coffee Table", "Bookshelf", "Bar Stool", "Bed Frame",
      "Sideboard", "Writing Desk", "Ottoman", "Nightstand", "Console Table",
    ],
    priceRange: [89, 899],
  },
  Accessories: {
    brands: ["Cobalt", "Drift", "Carryall", "Field", "Ridge"],
    nouns: [
      "Leather Wallet", "Canvas Backpack", "Sunglasses", "Watch Strap", "Card Holder",
      "Travel Pouch", "Keychain", "Phone Case", "Laptop Sleeve", "Weekender Bag",
    ],
    priceRange: [14, 199],
  },
  Gaming: {
    brands: ["Vortex", "Nova", "Raster", "Glitch", "Reflex"],
    nouns: [
      "Gaming Mouse", "Mechanical Keypad", "Headset", "Controller", "RGB Mousepad",
      "Capture Card", "Console Stand", "Arcade Stick", "Streaming Mic", "Racing Wheel",
    ],
    priceRange: [24, 349],
  },
  Toys: {
    brands: ["Tinker", "Bloom", "Puzzly", "Rumpus", "Sprout"],
    nouns: [
      "Wooden Blocks", "Plush Bear", "Building Kit", "Puzzle Cube", "RC Car",
      "Board Game", "Art Set", "Dollhouse", "Marble Run", "Play Tent",
    ],
    priceRange: [11, 119],
  },
};

const MODEL_QUALIFIERS = ["", "", "Pro", "Max", "Lite", "Mini", "V2", "S3", "Plus", "Studio"];
// Category-appropriate copy so descriptions describe the actual product and
// never borrow phrasing that belongs to a different category (e.g. no
// "workspace" copy on a lip balm). For non-books: "<descriptor> <noun> <benefit>".
// Books read as two short sentences (the product name is the title).
const CATEGORY_DESCRIPTORS: Record<ProductCategory, string[]> = {
  Electronics: ["Precision-engineered", "Feature-packed", "Studio-grade", "Reliably fast"],
  Fashion: ["Tailored", "Effortlessly modern", "Premium-quality", "Everyday-ready"],
  Home: ["Thoughtfully designed", "Warm and inviting", "Handsomely crafted", "Everyday-ready"],
  Sports: ["Performance-built", "Lightweight", "Durable", "Training-ready"],
  Books: ["A compelling read.", "An absorbing story.", "A thoughtful, well-crafted book.", "A memorable read."],
  Beauty: ["Gentle", "Nourishing", "Skin-loving", "Everyday-essential"],
  Furniture: ["Handsomely crafted", "Solidly built", "Timeless", "Space-smart"],
  Accessories: ["Everyday-carry", "Handsomely made", "Durable", "Effortlessly modern"],
  Gaming: ["Performance-tuned", "Precision-built", "Responsive", "Tournament-ready"],
  Toys: ["Playfully designed", "Imagination-sparking", "Durable", "Kid-approved"],
};
const CATEGORY_BENEFITS: Record<ProductCategory, string[]> = {
  Electronics: ["for a setup that keeps up.", "built for seamless daily use.", "tuned for crisp performance.", "with tech that keeps up with you."],
  Fashion: ["cut for a clean, modern look.", "in fabrics chosen to last.", "that layers into any wardrobe.", "for comfort that lasts all day."],
  Home: ["that elevates any room.", "made to feel at home anywhere.", "with materials chosen to endure.", "for cozy, considered spaces."],
  Sports: ["built for your next session.", "that moves with you.", "for training that pushes further.", "engineered for everyday workouts."],
  Books: ["One you won't want to put down.", "Told with care from start to finish.", "A worthy addition to any shelf.", "Perfect for quiet afternoons."],
  Beauty: ["for a healthy, radiant glow.", "that cares for your skin.", "made with skin-loving ingredients.", "for a simple daily ritual."],
  Furniture: ["that anchors the room.", "in materials chosen to endure.", "for a home that feels considered.", "built to last for years."],
  Accessories: ["for the essentials you carry daily.", "in materials chosen to endure.", "that pairs with anything.", "built for life on the move."],
  Gaming: ["built for your next match.", "tuned for low-latency play.", "for setups that demand more.", "engineered for long sessions."],
  Toys: ["for hours of open-ended play.", "built to survive playtime.", "that sparks curiosity.", "made for creative fun."],
};

/* -------------------------------------------------------------------------- */
/*  Category-appropriate imagery                                              */
/*                                                                            */
/*  Product images are self-contained SVG data URIs themed per category (a    */
/*  category colour + glyph + the product name). This guarantees every image  */
/*  visually represents the correct product type, is deterministic, needs no  */
/*  external host (safe on the Cloudflare Worker), and never 404s — unlike    */
/*  the previous random stock-photo service which showed unrelated scenery.   */
/* -------------------------------------------------------------------------- */

const CATEGORY_HEX: Record<ProductCategory, string> = {
  Electronics: "#0ea5e9",
  Fashion: "#f43f5e",
  Home: "#f59e0b",
  Sports: "#10b981",
  Books: "#8b5cf6",
  Beauty: "#d946ef",
  Furniture: "#78716c",
  Accessories: "#6366f1",
  Gaming: "#06b6d4",
  Toys: "#84cc16",
};

const CATEGORY_EMOJI: Record<ProductCategory, string> = {
  Electronics: "🎧",
  Fashion: "👕",
  Home: "🏠",
  Sports: "🏋️",
  Books: "📚",
  Beauty: "💄",
  Furniture: "🛋️",
  Accessories: "👜",
  Gaming: "🎮",
  Toys: "🧸",
};

// Per-product-TYPE glyph so the image visually represents the actual product
// (a keyboard shows a keyboard, headphones show headphones, a book shows a
// book), keyed by the blueprint noun. Falls back to the category glyph.
const NOUN_EMOJI: Record<string, string> = {
  // Electronics
  "Wireless Headphones": "🎧", "Smart Speaker": "🔊", "4K Webcam": "📷",
  "Noise-Cancelling Earbuds": "🎧", "Portable SSD": "💾", "Mechanical Keyboard": "⌨️",
  "USB-C Hub": "🔌", "Bluetooth Tracker": "📍", "Smartwatch": "⌚",
  "Action Camera": "📹", "Power Bank": "🔋", "Wireless Charger": "⚡",
  // Fashion
  "Merino Sweater": "🧥", "Oxford Shirt": "👔", "Slim Chinos": "👖",
  "Wool Overcoat": "🧥", "Linen Blazer": "🧥", "Denim Jacket": "🧥",
  "Cashmere Scarf": "🧣", "Leather Belt": "👖", "Silk Tie": "👔", "Knit Beanie": "🧢",
  // Home
  "Desk Lamp": "💡", "Ceramic Vase": "🏺", "Throw Blanket": "🛏️", "Scented Candle": "🕯️",
  "Wall Clock": "🕰️", "Area Rug": "🧶", "Picture Frame": "🖼️", "Storage Basket": "🧺",
  "Table Runner": "🍽️", "Planter Set": "🪴",
  // Sports
  "Yoga Mat": "🧘", "Resistance Bands": "💪", "Dumbbell Set": "🏋️", "Running Shoes": "👟",
  "Cycling Helmet": "⛑️", "Foam Roller": "🧻", "Water Bottle": "🥤", "Jump Rope": "🪢",
  "Training Gloves": "🧤", "Compression Tee": "👕",
  // Books (each title is a book)
  "The Silent Ledger": "📕", "Atlas of Small Things": "📗", "Notes on Momentum": "📓",
  "A Field of Signals": "📘", "The Long Quarter": "📙", "Systems & Seasons": "📚",
  "Blueprints for Nothing": "📖", "The Analog Mind": "📔", "Ledgers & Legends": "📒",
  "Quiet Machines": "📖",
  // Beauty
  "Vitamin C Serum": "🧴", "Hydrating Cleanser": "🧴", "Matte Lipstick": "💄",
  "Facial Roller": "💆", "Night Cream": "🧴", "Sunscreen SPF 50": "🧴", "Hair Oil": "🧴",
  "Clay Mask": "🧖", "Lip Balm Trio": "💄", "Eye Serum": "👁️",
  // Furniture (emoji coverage for tables is limited; nearest household glyph used)
  "Lounge Chair": "🪑", "Oak Coffee Table": "🛋️", "Bookshelf": "📚", "Bar Stool": "🪑",
  "Bed Frame": "🛏️", "Sideboard": "🗄️", "Writing Desk": "🪑", "Ottoman": "🛋️",
  "Nightstand": "🗄️", "Console Table": "🗄️",
  // Accessories
  "Leather Wallet": "👛", "Canvas Backpack": "🎒", "Sunglasses": "🕶️", "Watch Strap": "⌚",
  "Card Holder": "💳", "Travel Pouch": "👜", "Keychain": "🔑", "Phone Case": "📱",
  "Laptop Sleeve": "💻", "Weekender Bag": "🧳",
  // Gaming
  "Gaming Mouse": "🖱️", "Mechanical Keypad": "⌨️", "Headset": "🎧", "Controller": "🎮",
  "RGB Mousepad": "🖱️", "Capture Card": "🎥", "Console Stand": "🎮", "Arcade Stick": "🕹️",
  "Streaming Mic": "🎤", "Racing Wheel": "🏎️",
  // Toys
  "Wooden Blocks": "🧱", "Plush Bear": "🧸", "Building Kit": "🧱", "Puzzle Cube": "🧩",
  "RC Car": "🚗", "Board Game": "🎲", "Art Set": "🎨", "Dollhouse": "🏠",
  "Marble Run": "🔵", "Play Tent": "⛺",
};

function darkenHex(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const channel = (start: number) =>
    Math.round(parseInt(h.slice(start, start + 2), 16) * factor)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function productImage(category: ProductCategory, noun: string, name: string): string {
  const base = CATEGORY_HEX[category];
  const dark = darkenHex(base, 0.72);
  const emoji = NOUN_EMOJI[noun] ?? CATEGORY_EMOJI[category];
  const label = escapeXml(category);
  const title = escapeXml(name.length > 26 ? `${name.slice(0, 25)}…` : name);
  const font =
    "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='640' viewBox='0 0 640 640'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${base}'/><stop offset='1' stop-color='${dark}'/>` +
    `</linearGradient></defs>` +
    `<rect width='640' height='640' fill='url(#g)'/>` +
    `<text x='320' y='260' font-size='210' text-anchor='middle' dominant-baseline='central'>${emoji}</text>` +
    `<text x='320' y='432' font-size='30' font-family='${font}' font-weight='700' fill='#ffffff' text-anchor='middle'>${label}</text>` +
    `<text x='320' y='476' font-size='24' font-family='${font}' fill='#ffffff' fill-opacity='0.85' text-anchor='middle'>${title}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Public helper to build a category-appropriate placeholder image for products
 * created at runtime (e.g. the admin "add product" form), where the specific
 * product-type noun isn't known — falls back to the category glyph.
 */
export function categoryPlaceholderImage(
  category: ProductCategory,
  name: string,
): string {
  return productImage(category, "", name);
}

/** Qualifiers used to disambiguate products whose generated name would collide. */
const DEDUPE_QUALIFIERS = [
  "Pro", "Max", "Lite", "Mini", "V2", "S3", "Plus", "Studio", "Neo", "Prime", "XL", "Go",
];

const DAY = 86_400_000;
/** Fixed "now" — Date.UTC is a pure function, identical on server and client. */
const EPOCH = Date.UTC(2026, 6, 24);

function statusFor(rng: () => number): ProductStatus {
  const roll = rng();
  if (roll < 0.74) return "Active";
  if (roll < 0.89) return "Draft";
  return "Archived";
}

function inventoryFor(rng: () => number): number {
  const roll = rng();
  if (roll < 0.08) return 0; // out of stock
  if (roll < 0.22) return intBetween(rng, 1, LOW_STOCK_THRESHOLD); // low stock
  return intBetween(rng, LOW_STOCK_THRESHOLD + 1, 640);
}

function priceFor(rng: () => number, [min, max]: [number, number]): number {
  const raw = min + rng() * (max - min);
  // Charm pricing: round to the nearest whole unit and drop a cent.
  return Math.max(min, Math.round(raw)) - 0.01;
}

const TOTAL_PRODUCTS = 120;

function buildProduct(index: number, usedNames: Set<string>): Product {
  const rng = mulberry32(index * 2654435761 + 101);
  const category = PRODUCT_CATEGORIES[index % PRODUCT_CATEGORIES.length];
  const blueprint = BLUEPRINTS[category];

  const brand = pick(rng, blueprint.brands);
  const noun = pick(rng, blueprint.nouns);
  const qualifier = pick(rng, MODEL_QUALIFIERS);

  const isBook = category === "Books";
  const baseName = isBook ? noun : `${brand} ${noun}`;
  // Ensure globally-unique display names. Disambiguation is deterministic and
  // consumes no RNG, so prices/inventory/ratings are unaffected by dedupe.
  let name = qualifier ? `${baseName} ${qualifier}` : baseName;
  if (usedNames.has(name)) {
    let unique = "";
    for (const qual of DEDUPE_QUALIFIERS) {
      const candidate = `${baseName} ${qual}`;
      if (!usedNames.has(candidate)) {
        unique = candidate;
        break;
      }
    }
    if (!unique) {
      let k = 2;
      do {
        unique = `${baseName} ${k}`;
        k += 1;
      } while (usedNames.has(unique));
    }
    name = unique;
  }
  usedNames.add(name);

  const skuNoun = noun
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  const sku = `${brand.slice(0, 3).toUpperCase()}-${skuNoun}-${String(1000 + index)}`;

  const price = priceFor(rng, blueprint.priceRange);
  const cost = Math.round(price * (0.34 + rng() * 0.26) * 100) / 100;
  const inventory = inventoryFor(rng);
  const status = statusFor(rng);
  const rating = Math.round((3.5 + rng() * 1.5) * 10) / 10;
  const unitsSold = status === "Draft" ? intBetween(rng, 0, 120) : intBetween(rng, 40, 5200);
  const revenue = Math.round(unitsSold * price);

  const createdMs = EPOCH - intBetween(rng, 20, 700) * DAY;
  const updatedMs = Math.min(EPOCH, createdMs + intBetween(rng, 1, 120) * DAY);

  const descriptor = pick(rng, CATEGORY_DESCRIPTORS[category]);
  const benefit = pick(rng, CATEGORY_BENEFITS[category]);
  // Books read as two sentences (the name is the title); other categories weave
  // in the product noun so the copy always describes the actual product.
  const description = isBook
    ? `${descriptor} ${benefit}`
    : `${descriptor} ${noun.toLowerCase()} ${benefit}`;

  return {
    id: `prod-${1000 + index}`,
    sku,
    name,
    description,
    category,
    brand,
    price,
    cost,
    inventory,
    status,
    rating,
    image: productImage(category, noun, name),
    unitsSold,
    revenue,
    createdAt: new Date(createdMs).toISOString(),
    updatedAt: new Date(updatedMs).toISOString(),
  };
}

export const products: Product[] = (() => {
  const usedNames = new Set<string>();
  const list: Product[] = [];
  for (let index = 0; index < TOTAL_PRODUCTS; index += 1) {
    list.push(buildProduct(index, usedNames));
  }
  return list;
})();

/* -------------------------------------------------------------------------- */
/*  Derivations & lookups                                                     */
/* -------------------------------------------------------------------------- */

export type InventoryState = "out" | "low" | "in";

export function getInventoryState(inventory: number): InventoryState {
  if (inventory <= 0) return "out";
  if (inventory <= LOW_STOCK_THRESHOLD) return "low";
  return "in";
}

export function getProductById(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

export interface ProductStats {
  total: number;
  active: number;
  lowStock: number;
  outOfStock: number;
  revenue: number;
  unitsSold: number;
}

export function getProductStats(list: Product[] = products): ProductStats {
  return list.reduce<ProductStats>(
    (acc, product) => {
      acc.total += 1;
      if (product.status === "Active") acc.active += 1;
      const state = getInventoryState(product.inventory);
      if (state === "low") acc.lowStock += 1;
      if (state === "out") acc.outOfStock += 1;
      acc.revenue += product.revenue;
      acc.unitsSold += product.unitsSold;
      return acc;
    },
    { total: 0, active: 0, lowStock: 0, outOfStock: 0, revenue: 0, unitsSold: 0 },
  );
}

/* -------------------------------------------------------------------------- */
/*  Filtering / sorting option sources                                        */
/* -------------------------------------------------------------------------- */

export interface PriceBucket {
  id: string;
  label: string;
  min: number;
  max: number;
}

export const PRICE_BUCKETS: PriceBucket[] = [
  { id: "under-25", label: "Under $25", min: 0, max: 25 },
  { id: "25-100", label: "$25 – $100", min: 25, max: 100 },
  { id: "100-250", label: "$100 – $250", min: 100, max: 250 },
  { id: "250-500", label: "$250 – $500", min: 250, max: 500 },
  { id: "over-500", label: "Over $500", min: 500, max: Infinity },
];

export type ProductSortKey =
  | "newest"
  | "price"
  | "revenue"
  | "inventory"
  | "unitsSold";

export interface SortOption {
  id: ProductSortKey;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { id: "newest", label: "Newest" },
  { id: "revenue", label: "Revenue" },
  { id: "price", label: "Price" },
  { id: "inventory", label: "Inventory" },
  { id: "unitsSold", label: "Units Sold" },
];

/* -------------------------------------------------------------------------- */
/*  Product activity timeline (derived, deterministic)                        */
/* -------------------------------------------------------------------------- */

export type ActivityType =
  | "created"
  | "price"
  | "inventory"
  | "status"
  | "milestone"
  | "review";

export interface ProductActivity {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  date: string;
}

export function getProductActivity(product: Product): ProductActivity[] {
  const rng = mulberry32(product.id.length + product.sku.length * 31 + 7);
  const createdMs = Date.parse(product.createdAt);
  const updatedMs = Date.parse(product.updatedAt);
  const span = Math.max(DAY, updatedMs - createdMs);

  const at = (fraction: number) =>
    new Date(createdMs + span * fraction).toISOString();

  const events: ProductActivity[] = [
    {
      id: `${product.id}-created`,
      type: "created",
      title: "Product created",
      detail: `${product.name} added to the ${product.category} catalog.`,
      date: product.createdAt,
    },
    {
      id: `${product.id}-price`,
      type: "price",
      title: "Price updated",
      detail: `List price set to $${product.price.toFixed(2)}.`,
      date: at(0.25 + rng() * 0.15),
    },
    {
      id: `${product.id}-inventory`,
      type: "inventory",
      title:
        getInventoryState(product.inventory) === "out"
          ? "Marked out of stock"
          : "Inventory restocked",
      detail:
        getInventoryState(product.inventory) === "out"
          ? "Available units dropped to 0."
          : `${product.inventory} units received into the warehouse.`,
      date: at(0.55 + rng() * 0.15),
    },
    {
      id: `${product.id}-milestone`,
      type: "milestone",
      title: "Sales milestone reached",
      detail: `Passed ${product.unitsSold.toLocaleString("en-US")} units sold.`,
      date: at(0.78 + rng() * 0.1),
    },
    {
      id: `${product.id}-status`,
      type: "status",
      title: `Status set to ${product.status}`,
      detail: `Product is currently ${product.status.toLowerCase()}.`,
      date: product.updatedAt,
    },
  ];

  return events.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}
