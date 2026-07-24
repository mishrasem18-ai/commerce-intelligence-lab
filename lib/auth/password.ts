/**
 * PBKDF2-SHA256 password verification (Web Crypto — works in the Cloudflare
 * Worker runtime and in Node). Stored format:
 *   pbkdf2$sha256$<iterations>$<saltBase64>$<hashBase64>
 *
 * Pure (no secrets, no DB) so it is unit-testable and reusable. It is only ever
 * *called* server-side (in /api/admin/login) with the authoritative D1 hash —
 * no hash is shipped to the browser.
 */
const PBKDF2_ITERATIONS = 100000;

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Hash a plaintext password (PBKDF2-SHA256, random 16-byte salt) into the
 * stored format. The plaintext is never persisted or logged.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(derivedBuffer))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[2]);
  const salt = base64ToBytes(parts[3]);
  const expected = base64ToBytes(parts[4]);
  try {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password) as BufferSource,
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const derivedBuffer = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
      keyMaterial,
      expected.length * 8,
    );
    const derived = new Uint8Array(derivedBuffer);
    if (derived.length !== expected.length) return false;
    // Constant-time comparison.
    let diff = 0;
    for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}
