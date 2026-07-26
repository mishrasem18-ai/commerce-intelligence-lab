/**
 * PII protection for canonical analytics payloads.
 *
 * Every envelope passes through `scrubPii` before it reaches the dispatcher,
 * so an accidental `email`/`password`/token field can never leave the
 * canonical layer — it is replaced with `"[redacted]"` and reported as a
 * violation (surfaced in the debugger and a dev-only console warning).
 *
 * Two complementary checks:
 *  1. Key-based — field names that denote PII/credentials are redacted
 *     wherever they appear (keys are normalized: lowercased, `_`/`-` removed).
 *  2. Value-based — any string that looks like an email address is redacted
 *     even under an innocent key.
 *
 * Deliberately NOT key-blocked: `name` (product names are legitimate commerce
 * data) and `customer_id` (internal pseudonymous identifier, non-PII).
 */

export const PII_REDACTED = "[redacted]";

/** Normalized key names that are always redacted. */
const FORBIDDEN_KEYS = new Set([
  "email",
  "emailaddress",
  "contactemail",
  "phone",
  "phonenumber",
  "mobile",
  "contactmobile",
  "firstname",
  "lastname",
  "fullname",
  "surname",
  "givenname",
  "customername",
  "username",
  "address",
  "shippingaddress",
  "billingaddress",
  "street",
  "line1",
  "line2",
  "city",
  "state",
  "postalcode",
  "zipcode",
  "zip",
  "dob",
  "dateofbirth",
  "birthdate",
  "ssn",
  "pan",
  "iban",
  "cardnumber",
  "cvv",
  "cvc",
]);

/** Normalized-key substrings that are always redacted (credentials/secrets). */
const FORBIDDEN_KEY_PATTERNS = [
  "password",
  "passwd",
  "secret",
  "token",
  "cookie",
  "session",
  "credential",
  "authorization",
  "apikey",
  "hash",
];

const EMAIL_VALUE_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_\-\s]/g, "");
}

export function isForbiddenKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (FORBIDDEN_KEYS.has(normalized)) return true;
  return FORBIDDEN_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function looksLikePiiValue(value: string): boolean {
  return EMAIL_VALUE_PATTERN.test(value);
}

export interface PiiScrubResult<T> {
  value: T;
  /** Dotted paths of redacted fields, e.g. "commerce.items.0.email". */
  violations: string[];
}

/**
 * Deep-copy `input`, redacting PII along the way. Never throws; never mutates
 * the input. Non-plain objects (functions, class instances beyond arrays) are
 * dropped rather than traversed.
 */
export function scrubPii<T>(input: T): PiiScrubResult<T> {
  const violations: string[] = [];

  const walk = (value: unknown, path: string): unknown => {
    if (typeof value === "string") {
      if (looksLikePiiValue(value)) {
        violations.push(path);
        return PII_REDACTED;
      }
      return value;
    }
    if (value === null || typeof value !== "object") {
      return typeof value === "function" ? undefined : value;
    }
    if (Array.isArray(value)) {
      return value.map((entry, index) => walk(entry, `${path}.${index}`));
    }
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const entryPath = path ? `${path}.${key}` : key;
      if (isForbiddenKey(key)) {
        violations.push(entryPath);
        output[key] = PII_REDACTED;
        continue;
      }
      output[key] = walk(entry, entryPath);
    }
    return output;
  };

  return { value: walk(input, "") as T, violations };
}
