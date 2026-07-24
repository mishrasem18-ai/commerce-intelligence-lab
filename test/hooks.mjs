// Test-only ESM resolve hook. `server-only` is not a real npm package — Next
// aliases it at build time — so importing the server modules in a plain Node
// test would fail at `import "server-only"`. Map it to an empty module.
const ROOT = new URL("../", import.meta.url); // project root

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export%20%7B%7D", shortCircuit: true };
  }
  // Mirror the tsconfig "@/*" -> "./*" path alias (Node has no notion of it).
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2) + (/\.[a-z]+$/.test(specifier) ? "" : ".ts");
    return { url: new URL(rel, ROOT).href, shortCircuit: true };
  }
  return next(specifier, context);
}
