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
const DESCRIPTORS = [
  "Precision-engineered", "Thoughtfully designed", "Built to last", "Studio-grade",
  "Everyday-ready", "Premium-quality", "Ergonomically refined", "Effortlessly modern",
];
const BENEFITS = [
  "for people who care about the details.",
  "that balances form and function.",
  "with materials chosen to endure.",
  "for a workspace that works harder.",
  "designed to feel good in daily use.",
  "trusted by teams and creators alike.",
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

function buildProduct(index: number): Product {
  const rng = mulberry32(index * 2654435761 + 101);
  const category = PRODUCT_CATEGORIES[index % PRODUCT_CATEGORIES.length];
  const blueprint = BLUEPRINTS[category];

  const brand = pick(rng, blueprint.brands);
  const noun = pick(rng, blueprint.nouns);
  const qualifier = pick(rng, MODEL_QUALIFIERS);

  const isBook = category === "Books";
  const baseName = isBook ? noun : `${brand} ${noun}`;
  const name = qualifier ? `${baseName} ${qualifier}` : baseName;

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

  const descriptor = pick(rng, DESCRIPTORS);
  const benefit = pick(rng, BENEFITS);
  const description = `${descriptor} ${noun.toLowerCase()} ${benefit}`;

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
    image: `https://picsum.photos/seed/${encodeURIComponent(sku)}/640/640`,
    unitsSold,
    revenue,
    createdAt: new Date(createdMs).toISOString(),
    updatedAt: new Date(updatedMs).toISOString(),
  };
}

export const products: Product[] = Array.from(
  { length: TOTAL_PRODUCTS },
  (_, index) => buildProduct(index),
);

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
