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

/*
 * User-controlled text (URL path segments, query parameters, search terms).
 *
 * Inspected as a browser would read it: percent-decoding is repeated (a
 * double-encoded "%2540" is still an "@"), lenient (a malformed escape
 * elsewhere in the value does not hide the rest) and followed by NFKC, so
 * full-width "＠" and "４１５" normalise to ASCII. Digits are any Unicode
 * decimal digit (\p{Nd}), so a phone typed in Arabic-Indic or Devanagari
 * digits is still a phone.
 */

/** Digit runs that may be phone numbers: optional +, digits and separators. */
const PHONE_RUN_PATTERN = /\+?\p{Nd}[\p{Nd}\s().-]{5,}\p{Nd}/gu;
const DIGIT_GROUP_PATTERN = /\+?\p{Nd}+/gu;
const LOCAL_PHONE_PATTERN = /^\p{Nd}{3}[\s.-]\p{Nd}{4}$/u;
/** A local part followed by "@": catches half-typed emails ("jane@", "jane@gmail"). */
const PARTIAL_EMAIL_PATTERN = /[^\s@/?&=#]+@/;

const countDigits = (value: string) => (value.match(/\p{Nd}/gu) ?? []).length;

/**
 * Whether a run of digits/separators reads as ONE phone number: 7–15 digits
 * and either an international "+" prefix, at least 10 digits, or the local
 * "555-1234" shape. Model numbers and year ranges ("3080 1080",
 * "2024-2025") deliberately do not qualify.
 */
function isPhoneShaped(run: string): boolean {
  const digits = countDigits(run);
  if (digits < 7 || digits > 15) return false;
  return run.startsWith("+") || digits >= 10 || LOCAL_PHONE_PATTERN.test(run.trim());
}

/**
 * Whether a run contains a phone. Neighbouring numbers joined by spaces or
 * dashes form one long run ("415-555-0100 415-555-0101"), so a run over 15
 * digits is also searched for a phone-shaped window of consecutive groups.
 */
function runContainsPhone(run: string): boolean {
  if (isPhoneShaped(run)) return true;
  if (countDigits(run) <= 15) return false;
  const groups = [...run.matchAll(DIGIT_GROUP_PATTERN)];
  for (let i = 0; i < groups.length; i++) {
    for (let j = i; j < groups.length; j++) {
      const window = run.slice(groups[i].index, groups[j].index! + groups[j][0].length);
      if (countDigits(window) > 15) break;
      if (isPhoneShaped(window)) return true;
    }
  }
  return false;
}

function containsPhone(value: string): boolean {
  for (const match of value.matchAll(PHONE_RUN_PATTERN)) {
    if (runContainsPhone(match[0])) return true;
  }
  return false;
}

function containsEmailish(value: string): boolean {
  return looksLikePiiValue(value) || PARTIAL_EMAIL_PATTERN.test(value);
}

/** Percent-decode one level, leniently (malformed escapes are kept as-is). */
function lenientDecodeOnce(value: string): string {
  return value.replace(/(?:%[0-9a-f]{2})+/gi, (run) => {
    try {
      return decodeURIComponent(run);
    } catch {
      // Not valid UTF-8 (e.g. Latin-1 "%E9"): decode byte by byte.
      return run.replace(/%([0-9a-f]{2})/gi, (_, hex: string) =>
        String.fromCharCode(parseInt(hex, 16)),
      );
    }
  });
}

/** How a person (or GA4) would read this URL fragment. */
export function decodeUserText(value: string): string {
  let current = value.replace(/\+/g, " ");
  for (let i = 0; i < 3; i++) {
    const next = lenientDecodeOnce(current);
    if (next === current) break;
    current = next;
  }
  return current.normalize("NFKC");
}

/** Free text (a search term, a query value) that contains an email or phone. */
export function containsContactDetails(value: string): boolean {
  const text = decodeUserText(value);
  return containsEmailish(text) || containsPhone(text);
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
      const text = decodeUserText(segment);
      const wholePhone = /^[+\p{Nd}\s().-]+$/u.test(text) && runContainsPhone(text);
      return containsEmailish(text) || wholePhone ? PII_REDACTED : segment;
    })
    .join("/");
}

/**
 * Attribution and site-structure parameters whose values are machine ids,
 * prices or page numbers. They are still checked for emails, but not for
 * phone-shaped digit runs (a 10–15 digit campaign id is not a phone, and
 * redacting it would break paid-traffic attribution from page_location).
 */
const NON_FREE_TEXT_PARAM =
  /^(utm_[a-z_]+|gad_[a-z_]+|gclid|gbraid|wbraid|dclid|gclsrc|msclkid|fbclid|ttclid|twclid|li_fat_id|igshid|yclid|srsltid|mc_cid|mc_eid|_gl|_ga|category|price|sort|page)$/i;

/**
 * Redact query parameters whose NAME contains or denotes PII (email=, a
 * pasted "jane@x.com" key…) or whose VALUE contains contact details. Other
 * parameters are kept verbatim (no re-encoding), so
 * "category=home&q=jane%40x.com" → "category=home&q=[redacted]".
 */
export function redactQueryString(queryString: string): string {
  if (!queryString) return queryString;
  return queryString
    .split("&")
    .map((pair) => {
      const eq = pair.indexOf("=");
      const rawKey = eq === -1 ? pair : pair.slice(0, eq);
      const key = decodeUserText(rawKey);
      if (containsEmailish(key) || containsPhone(key)) return PII_REDACTED;
      if (eq === -1) return pair;
      const value = decodeUserText(pair.slice(eq + 1));
      const leaks =
        isForbiddenKey(key) ||
        containsEmailish(value) ||
        (!NON_FREE_TEXT_PARAM.test(key.trim()) && containsPhone(value));
      return leaks ? `${rawKey}=${PII_REDACTED}` : pair;
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
