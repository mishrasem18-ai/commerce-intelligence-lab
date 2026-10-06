/**
 * Links to buyer-protected routes (/account*, /checkout) must not prefetch
 * while the visitor is signed out. The middleware answers such a prefetch
 * with a redirect to /login, and the router caches that redirect as the
 * route; after signing in, the navigation to /account then falls back to a
 * document load and the `sign_up` / `login` analytics hits are lost.
 *
 * `components/store/buyer-link.tsx` renders `prefetch={false}` until a buyer
 * session exists. Outside the account area — which only renders for a signed-in
 * buyer — every <Link> to a protected route must be a <BuyerLink>.
 * Run: npm run test:auth
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;

/** Rendered only inside the signed-in account area (the account layout redirects otherwise). */
const ACCOUNT_AREA = new Set([
  "components/store/account-shell.tsx",
  "components/store/account-dashboard.tsx",
  "components/store/buyer-orders-list.tsx",
  "components/store/buyer-order-detail-view.tsx",
  "components/store/buyer-profile-form.tsx",
  "components/store/addresses-manager.tsx",
]);

const PROTECTED_LINK = /<Link\b[^>]*\bhref=(?:"(?:\/account|\/checkout)(?:[/?"]|$)|\{`(?:\/account|\/checkout)[/?`])/g;

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

export function findPlainProtectedLinks(root: string): string[] {
  const offenders: string[] = [];
  for (const dir of ["components", "app"]) {
    for (const file of tsxFiles(join(root, dir))) {
      const rel = relative(root, file);
      if (ACCOUNT_AREA.has(rel) || rel.startsWith("app/(store)/account/")) continue;
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(PROTECTED_LINK)) {
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${rel}:${line}`);
      }
    }
  }
  return offenders.sort();
}

test("no plain <Link> to /account or /checkout outside the account area (use BuyerLink)", () => {
  assert.deepEqual(findPlainProtectedLinks(ROOT), []);
});

test("the scan itself catches the shapes a protected link can take", () => {
  const samples = [
    '<Link href="/account" className="x">',
    '<Link href="/account/orders">',
    '<Link\n  href="/checkout"\n>',
    "<Link href={`/account/orders/${id}`}>",
  ];
  const matches = (text: string) => new RegExp(PROTECTED_LINK.source).test(text);
  for (const sample of samples) assert.ok(matches(sample), sample);
  for (const safe of ['<Link href="/accounting">', '<Link href="/cart">', '<BuyerLink href="/account">']) {
    assert.equal(matches(safe), false, safe);
  }
});
