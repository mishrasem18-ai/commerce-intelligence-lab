import "server-only";
import { getDb } from "@/lib/db/client";
import type { Product, ProductCategory, ProductStatus } from "@/lib/data/products";

/** Raw row shape from the products/categories join. */
interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string;
  category_name: string;
  brand: string;
  price_cents: number;
  cost_cents: number;
  inventory: number;
  status: string;
  rating: number;
  image: string;
  units_sold: number;
  revenue_cents: number;
  created_at: string;
  updated_at: string;
}

const SELECT =
  `SELECT p.id, p.sku, p.name, p.description, c.name AS category_name, p.brand, ` +
  `p.price_cents, p.cost_cents, p.inventory, p.status, p.rating, p.image, ` +
  `p.units_sold, p.revenue_cents, p.created_at, p.updated_at ` +
  `FROM products p JOIN categories c ON p.category_id = c.id`;

/** Map a D1 row to the app's Product domain type (cents → dollars, snake → camel). */
function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category_name as ProductCategory,
    brand: row.brand,
    price: row.price_cents / 100,
    cost: row.cost_cents / 100,
    inventory: row.inventory,
    status: row.status as ProductStatus,
    rating: row.rating,
    image: row.image,
    unitsSold: row.units_sold,
    revenue: row.revenue_cents / 100,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** All products, newest first (stable order by created_at then id). */
export async function getProducts(): Promise<Product[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(`${SELECT} ORDER BY p.created_at DESC, p.id`)
    .all<ProductRow>();
  return results.map(toProduct);
}

/** A single product by id, or null if not found. */
export async function getProductById(id: string): Promise<Product | null> {
  const db = await getDb();
  const row = await db
    .prepare(`${SELECT} WHERE p.id = ?`)
    .bind(id)
    .first<ProductRow>();
  return row ? toProduct(row) : null;
}

/** Products in a given category (by category name, e.g. "Electronics"). */
export async function getProductsByCategory(category: string): Promise<Product[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(`${SELECT} WHERE c.name = ? ORDER BY p.created_at DESC, p.id`)
    .bind(category)
    .all<ProductRow>();
  return results.map(toProduct);
}
