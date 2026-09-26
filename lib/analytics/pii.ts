/**
 * PII protection for canonical analytics payloads.
 *
 * Every envelope passes through `scrubPii` before it reaches the dispatcher,
 * so an accidental `email`/`password`/token field can never leave the
 * canonical layer — it is replaced with `"[redacted]"` and reported as a
 * violation (surfaced in the debugger and a dev-only console warning).
 *
 * Three complementary checks:
 *  1. Key-based — field names that denote PII/credentials are redacted
 *     wherever they appear (keys are normalized: lowercased, `_`/`-` removed).
 *  2. Value-based — any string that looks like an email address is redacted
 *     even under an innocent key.
 *  3. User-controlled text — the URL and the search term are typed by users,
 *     so they get targeted, finer-grained redaction that also covers phone
 *     numbers and percent-encoding: `page.path` per segment
 *     ("/account/orders/[redacted]"), `page.query_string` per parameter
 *     ("q=[redacted]&category=home") and `search.query` as a whole. Phone
 *     detection is deliberately NOT applied everywhere — timestamps, event
 *     ids and prices are digit runs too.
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

/** Digit runs that may be phone numbers: optional +, digits and separators. */
const PHONE_RUN_PATTERN = /\+?\d[\d\s().-]{5,}\d/g;
const LOCAL_PHONE_PATTERN = /^\d{3}[\s.-]\d{4}$/;

/**
 * Whether a run of digits/separators reads as a phone number: 7–15 digits
 * and either an international "+" prefix, at least 10 digits, or the local
 * "555-1234" shape. Model numbers and year ranges ("3080 1080", "2024-2025")
 * deliberately do not qualify.
 */
function isPhoneRun(run: string): boolean {
  const digits = run.replace(/\D/g, "").length;
  if (digits < 7 || digits > 15) return false;
  return run.startsWith("+") || digits >= 10 || LOCAL_PHONE_PATTERN.test(run.trim());
}

/** Free text (a search term, a query value) that contains an email or phone. */
export function containsContactDetails(value: string): boolean {
  if (looksLikePiiValue(value)) return true;
  for (const match of value.matchAll(PHONE_RUN_PATTERN)) {
    if (isPhoneRun(match[0])) return true;
  }
  return false;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/**
 * Redact path segments that are, or contain, contact details. A segment must
 * be phone-shaped AS A WHOLE to count as a phone, so identifiers such as
 * "ORD-1234567" or "prod-1000" survive.
 */
export function redactPath(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      const decoded = safeDecode(segment);
      const wholePhone = /^[+\d\s().-]+$/.test(decoded) && isPhoneRun(decoded);
      return looksLikePiiValue(decoded) || wholePhone ? PII_REDACTED : segment;
    })
    .join("/");
}

/**
 * Redact query parameters whose NAME is PII (email=, phone=…) or whose VALUE
 * contains contact details. Other parameters are kept verbatim (no
 * re-encoding), so "category=home&q=jane%40x.com" → "category=home&q=[redacted]".
 */
export function redactQueryString(queryString: string): string {
  if (!queryString) return queryString;
  return queryString
    .split("&")
    .map((pair) => {
      const eq = pair.indexOf("=");
      const key = eq === -1 ? pair : pair.slice(0, eq);
      if (eq === -1) return containsContactDetails(safeDecode(key)) ? PII_REDACTED : pair;
      const value = safeDecode(pair.slice(eq + 1));
      return isForbiddenKey(safeDecode(key)) || containsContactDetails(value)
        ? `${key}=${PII_REDACTED}`
        : pair;
    })
    .join("&");
}

/** A search term is redacted as a whole if it contains contact details. */
export function redactSearchTerm(term: string): string {
  return containsContactDetails(term) ? PII_REDACTED : term;
}

/** Targeted sanitizers for user-controlled envelope fields (dotted paths). */
const USER_TEXT_SANITIZERS: Record<string, (value: string) => string> = {
  "page.path": redactPath,
  "page.query_string": redactQueryString,
  "search.query": redactSearchTerm,
};

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
      const sanitize = USER_TEXT_SANITIZERS[path];
      if (sanitize) {
        const cleaned = sanitize(value);
        if (cleaned !== value) violations.push(path);
        return cleaned;
      }
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
