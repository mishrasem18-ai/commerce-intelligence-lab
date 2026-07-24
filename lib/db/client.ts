import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Minimal D1 typings (avoids a hard dependency on @cloudflare/workers-types).
 * Only the surface we use is declared.
 */
export interface D1Result<T> {
  results: T[];
  success: boolean;
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result<unknown>[]>;
}

/**
 * Server-only accessor for the local/remote D1 binding (`DB`, from wrangler.jsonc).
 * The `server-only` import above makes importing this from a client component a
 * build error, so the browser can never reach D1 directly.
 *
 * Uses the async form of getCloudflareContext so it also resolves during
 * `next dev` (paired with initOpenNextCloudflareForDev in next.config.ts).
 */
/**
 * Test seam: automated tests inject an in-memory fake D1 here so the real query
 * code in users.ts / session.ts / orders.ts can be exercised without the
 * Cloudflare runtime. It is null in every production/dev code path.
 */
let testDb: D1Database | null = null;
export function __setTestDb(db: D1Database | null): void {
  testDb = db;
}

export async function getDb(): Promise<D1Database> {
  if (testDb) return testDb;
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) {
    throw new Error(
      "D1 binding 'DB' is not available. Check the d1_databases binding in wrangler.jsonc.",
    );
  }
  return db;
}
