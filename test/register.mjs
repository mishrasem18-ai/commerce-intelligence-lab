// Loaded via `node --import ./test/register.mjs` to install the resolve hook
// that stubs `server-only` before any application module is imported.
import { register } from "node:module";
register("./hooks.mjs", import.meta.url);
