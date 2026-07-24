/**
 * PBKDF2-SHA256 password verification (Web Crypto — works in the Cloudflare
 * Worker runtime and in Node). Stored format:
 *   pbkdf2$sha256$<iterations>$<saltBase64>$<hashBase64>
 *
 * Pure (no secrets, no DB) so it is unit-testable and reusable. It is only ever
 * *called* server-side (in /api/admin/login) with the authoritative D1 hash —
 * no hash is shipped to the browser.
 */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
