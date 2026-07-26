/**
 * Consent model tests.
 * Run: npm run test:analytics
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONSENT_STORAGE_KEY,
  createConsentStore,
  defaultConsentRecord,
  normalizeConsentRecord,
  withPreferences,
  type ConsentStorage,
} from "./consent.ts";

function memoryStorage(): ConsentStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

test("default consent: only necessary is enabled and no decision is recorded", () => {
  const store = createConsentStore(memoryStorage());
  assert.deepEqual(store.getState(), {
    necessary: true,
    analytics: false,
    advertising: false,
    personalization: false,
  });
  assert.equal(store.hasDecision(), false);
  assert.equal(store.get().method, "default");
});

test("Accept All enables every category and records the decision", () => {
  const store = createConsentStore(memoryStorage());
  const record = store.acceptAll();
  assert.deepEqual(record.state, {
    necessary: true,
    analytics: true,
    advertising: true,
    personalization: true,
  });
  assert.equal(record.method, "accept_all");
  assert.equal(store.hasDecision(), true);
});

test("Reject All disables everything except necessary", () => {
  const store = createConsentStore(memoryStorage());
  store.acceptAll();
  const record = store.rejectAll();
  assert.deepEqual(record.state, {
    necessary: true,
    analytics: false,
    advertising: false,
    personalization: false,
  });
  assert.equal(record.method, "reject_all");
});

test("granular preferences apply exactly as chosen", () => {
  const store = createConsentStore(memoryStorage());
  const record = store.setPreferences({ analytics: true, personalization: true });
  assert.deepEqual(record.state, {
    necessary: true,
    analytics: true,
    advertising: false,
    personalization: true,
  });
  assert.equal(record.method, "custom");
});

test("necessary cannot be disabled through any path", () => {
  // Direct preference attempt…
  assert.equal(withPreferences({ necessary: false } as never).necessary, true);
  const store = createConsentStore(memoryStorage());
  assert.equal(
    store.setPreferences({ necessary: false } as never).state.necessary,
    true,
  );
  // …and a tampered persisted record.
  const normalized = normalizeConsentRecord({
    version: 1,
    state: { necessary: false, analytics: true },
    method: "custom",
    decidedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(normalized.state.necessary, true);
});

test("consent persists to storage and is restored by a new store", () => {
  const storage = memoryStorage();
  const first = createConsentStore(storage);
  first.setPreferences({ analytics: true });
  assert.ok(storage.data.has(CONSENT_STORAGE_KEY));

  const second = createConsentStore(storage);
  assert.equal(second.getState().analytics, true);
  assert.equal(second.getState().advertising, false);
  assert.equal(second.hasDecision(), true);
  assert.equal(second.get().method, "custom");
});

test("malformed persisted consent falls back to the safe default", () => {
  const storage = memoryStorage();
  storage.setItem(CONSENT_STORAGE_KEY, "{not valid json");
  const store = createConsentStore(storage);
  assert.deepEqual(store.get(), defaultConsentRecord());

  storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ version: 99 }));
  assert.deepEqual(createConsentStore(storage).get(), defaultConsentRecord());
});

test("subscribers are notified of changes and can unsubscribe", () => {
  const store = createConsentStore(memoryStorage());
  const seen: string[] = [];
  const unsubscribe = store.subscribe((record) => seen.push(record.method));
  store.acceptAll();
  store.rejectAll();
  unsubscribe();
  store.acceptAll();
  assert.deepEqual(seen, ["accept_all", "reject_all"]);
});

test("a throwing subscriber does not break other subscribers", () => {
  const store = createConsentStore(memoryStorage());
  let delivered = false;
  store.subscribe(() => {
    throw new Error("bad listener");
  });
  store.subscribe(() => {
    delivered = true;
  });
  store.acceptAll();
  assert.equal(delivered, true);
});

test("a store without storage still works in memory (SSR safety)", () => {
  const store = createConsentStore(null);
  store.acceptAll();
  assert.equal(store.getState().analytics, true);
});
