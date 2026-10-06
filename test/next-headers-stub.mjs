// Test stand-in for `next/headers` (mapped by test/hooks.mjs). `cookies()` only
// works inside a Next request, so tests set the request's cookies here and the
// real guard code in lib/auth/guards.ts reads them back.
let jar = {};

/** Replace the cookies of the simulated request, e.g. `{ cil_admin: token }`. */
export function __setTestCookies(next) {
  jar = { ...next };
}

export async function cookies() {
  return {
    get(name) {
      return Object.hasOwn(jar, name) ? { name, value: jar[name] } : undefined;
    },
  };
}
