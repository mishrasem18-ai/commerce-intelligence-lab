// Polite, serialized HTTP for the product-image sourcing scripts.
//
// Every network request made by scripts/images/* MUST go through `request()`:
//  - fixed User-Agent (Wikimedia/Flickr UA policy),
//  - a GLOBAL cross-process lock per host (atomic mkdir), so concurrent agents
//    hit a host strictly one request at a time,
//  - a persisted minimum interval per host (stamp file, shared across processes),
//  - retries with backoff on 429/5xx/network errors, honouring Retry-After (max 3),
//  - Openverse budget guard (header-reported anonymous limits + 2 queries/noun).
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const USER_AGENT =
  "commerce-intelligence-lab/1.0 (https://github.com/mishrasem18-ai/commerce-intelligence-lab)";

/** Candidate previews, locks and request state (never committed). Override with IMAGES_SCRATCH. */
export const SCRATCH_ROOT = process.env.IMAGES_SCRATCH || path.join(os.tmpdir(), "cil-product-images");
export const LOCK_DIR = path.join(SCRATCH_ROOT, ".locks");
export const STATE_DIR = path.join(SCRATCH_ROOT, ".state");
export const STAMP_DIR = path.join(STATE_DIR, "stamps");
export const REQUEST_LOG = path.join(STATE_DIR, "requests.log");
export const OPENVERSE_STATE = path.join(STATE_DIR, "openverse.json");

export const OPENVERSE_HOST = "api.openverse.org";
export const OPENVERSE_MIN_SUSTAINED = 12;
export const OPENVERSE_MAX_QUERIES_PER_NOUN = 2;

const STALE_LOCK_MS = 60_000;
const HEARTBEAT_MS = 10_000;
const LOCK_ACQUIRE_TIMEOUT_MS = 20 * 60_000;
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 3;
const MAX_RETRY_AFTER_MS = 120_000;
const MAX_REDIRECTS = 5;

const MIN_INTERVAL_MS = {
  "api.openverse.org": 3500,
  "commons.wikimedia.org": 1000,
  "www.flickr.com": 1000,
  "upload.wikimedia.org": 400,
  "thumb.wikimedia.org": 400,
  "live.staticflickr.com": 400,
};

export function minIntervalFor(host) {
  if (MIN_INTERVAL_MS[host] != null) return MIN_INTERVAL_MS[host];
  if (/\.staticflickr\.com$/.test(host)) return 400;
  if (/\.wikimedia\.org$/.test(host) || /\.wikipedia\.org$/.test(host)) return 1000;
  return 1000; // conservative default for anything unexpected
}

export class BudgetError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "BudgetError";
  }
}

export class HttpError extends Error {
  constructor(msg, status, url) {
    super(msg);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safeHost = (host) => host.replace(/[^a-zA-Z0-9.-]/g, "_");

function ensureDirs() {
  for (const d of [LOCK_DIR, STATE_DIR, STAMP_DIR]) fs.mkdirSync(d, { recursive: true });
}

// ---------------------------------------------------------------- locking --

const heldLocks = new Set();
function releaseAllSync() {
  for (const dir of heldLocks) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
  heldLocks.clear();
}
process.on("exit", releaseAllSync);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    releaseAllSync();
    process.exit(130);
  });
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

async function lockAge(dir) {
  try {
    const st = await fsp.stat(dir);
    return { age: Date.now() - st.mtimeMs };
  } catch {
    return null;
  }
}

async function readOwner(dir) {
  try {
    return JSON.parse(await fsp.readFile(path.join(dir, "owner.json"), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Acquire a named global lock (atomic mkdir). Returns a release() function.
 * Stale recovery: lock older than 60s without heartbeat, or owner pid dead.
 */
export async function acquireLock(name) {
  ensureDirs();
  const dir = path.join(LOCK_DIR, `${safeHost(name)}.lock`);
  const started = Date.now();
  for (;;) {
    try {
      await fsp.mkdir(dir);
      heldLocks.add(dir);
      await fsp.writeFile(
        path.join(dir, "owner.json"),
        JSON.stringify({ pid: process.pid, since: new Date().toISOString() }),
      );
      const hb = setInterval(() => {
        const now = new Date();
        fs.utimes(dir, now, now, () => {});
      }, HEARTBEAT_MS);
      hb.unref();
      return async () => {
        clearInterval(hb);
        heldLocks.delete(dir);
        await fsp.rm(dir, { recursive: true, force: true });
      };
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
    // Lock is held by someone. Stale?
    const info = await lockAge(dir);
    if (info) {
      const owner = await readOwner(dir);
      const dead = owner && owner.pid !== process.pid && !pidAlive(owner.pid);
      const stale = info.age > STALE_LOCK_MS;
      if (dead || stale) {
        // Atomic steal: only one contender's rename succeeds.
        const graveyard = `${dir}.stale.${process.pid}.${Math.random().toString(36).slice(2)}`;
        try {
          const again = await lockAge(dir);
          if (again && (dead || again.age > STALE_LOCK_MS)) {
            await fsp.rename(dir, graveyard);
            await fsp.rm(graveyard, { recursive: true, force: true });
            process.stderr.write(
              `[net] recovered ${dead ? "dead-owner" : "stale"} lock ${path.basename(dir)}\n`,
            );
          }
        } catch {}
        continue;
      }
    }
    if (Date.now() - started > LOCK_ACQUIRE_TIMEOUT_MS) {
      throw new Error(`timed out waiting for lock ${dir}`);
    }
    await sleep(120 + Math.random() * 180);
  }
}

export async function withLock(name, fn) {
  const release = await acquireLock(name);
  try {
    return await fn();
  } finally {
    await release();
  }
}

// ------------------------------------------------------------- stamps ------

function stampPath(host) {
  return path.join(STAMP_DIR, `${safeHost(host)}.json`);
}
async function readStamp(host) {
  try {
    return JSON.parse(await fsp.readFile(stampPath(host), "utf8"));
  } catch {
    return { last: 0, notBefore: 0 };
  }
}
async function writeStamp(host, stamp) {
  const p = stampPath(host);
  const tmp = `${p}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(stamp));
  await fsp.rename(tmp, p);
}

// -------------------------------------------------------- openverse state --

export function readOpenverseStateSync() {
  try {
    return JSON.parse(fs.readFileSync(OPENVERSE_STATE, "utf8"));
  } catch {
    return { per_noun: {} };
  }
}
async function writeOpenverseState(state) {
  ensureDirs();
  const tmp = `${OPENVERSE_STATE}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(state, null, 2));
  await fsp.rename(tmp, OPENVERSE_STATE);
}

/** Why Openverse may not be used for this noun right now (null = allowed). */
export function openverseRefusal(nounSlug, state = readOpenverseStateSync()) {
  const now = Date.now();
  if (state.blocked_until && Date.parse(state.blocked_until) > now) {
    return `openverse blocked until ${state.blocked_until}`;
  }
  const fresh = state.updated_at && now - Date.parse(state.updated_at) < 24 * 3600_000;
  if (fresh && state.sustained_available != null && state.sustained_available < OPENVERSE_MIN_SUSTAINED) {
    return `openverse sustained budget low (${state.sustained_available} < ${OPENVERSE_MIN_SUSTAINED})`;
  }
  if (nounSlug) {
    const used = (state.per_noun || {})[nounSlug] || 0;
    if (used >= OPENVERSE_MAX_QUERIES_PER_NOUN) {
      return `openverse per-noun cap reached for "${nounSlug}" (${used}/${OPENVERSE_MAX_QUERIES_PER_NOUN})`;
    }
  }
  return null;
}

function parseRateHeaders(headers) {
  const n = (k) => {
    const v = headers.get(k);
    return v == null || v === "" ? null : Number(v);
  };
  return {
    burst: n("x-ratelimit-available-anon_burst"),
    sustained: n("x-ratelimit-available-anon_sustained"),
    burstLimit: headers.get("x-ratelimit-limit-anon_burst"),
    sustainedLimit: headers.get("x-ratelimit-limit-anon_sustained"),
  };
}

// ------------------------------------------------------------- request -----

function retryAfterMs(res, attempt) {
  const ra = res?.headers?.get("retry-after");
  if (ra) {
    const secs = Number(ra);
    if (Number.isFinite(secs)) return secs * 1000;
    const date = Date.parse(ra);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 2000 * 2 ** attempt + Math.random() * 500;
}

function logLine(line) {
  try {
    ensureDirs();
    fs.appendFileSync(REQUEST_LOG, line + "\n");
  } catch {}
  if (process.env.IMAGES_NET_QUIET !== "1") process.stderr.write(`[net] ${line}\n`);
}

// Serializes requests to the same host inside one process (the mkdir lock
// already serializes across processes; this just avoids self-contention).
const localChains = new Map();

/**
 * One HTTP hop under the host lock. Returns {status, headers, body:Buffer, url}.
 */
async function hop(url, { accept, openverseNoun }) {
  const host = new URL(url).host;
  const prev = localChains.get(host) || Promise.resolve();
  let done;
  const mine = new Promise((r) => (done = r));
  localChains.set(host, prev.then(() => mine));
  await prev;
  try {
    return await withLock(`host-${host}`, async () => {
      if (host === OPENVERSE_HOST) {
        const st = readOpenverseStateSync();
        const why = openverseRefusal(openverseNoun, st);
        if (why) throw new BudgetError(why);
      }
      const stamp = await readStamp(host);
      const waitUntil = Math.max(stamp.last + minIntervalFor(host), stamp.notBefore || 0);
      const wait = waitUntil - Date.now();
      if (wait > 0) {
        if (wait > MAX_RETRY_AFTER_MS) throw new BudgetError(`${host} backoff in effect until ${new Date(waitUntil).toISOString()}`);
        await sleep(wait);
      }
      const t0 = Date.now();
      let res, body, err;
      try {
        res = await fetch(url, {
          headers: { "User-Agent": USER_AGENT, Accept: accept || "*/*" },
          redirect: "manual",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        body = Buffer.from(await res.arrayBuffer());
      } catch (e) {
        err = e;
      }
      const t1 = Date.now();
      const newStamp = { last: t1, notBefore: stamp.notBefore || 0 };
      if (res && (res.status === 429 || res.status === 503)) {
        newStamp.notBefore = t1 + Math.min(retryAfterMs(res, 0), MAX_RETRY_AFTER_MS * 5);
      }
      await writeStamp(host, newStamp);
      logLine(
        `${new Date(t0).toISOString()} -> ${new Date(t1).toISOString()} pid=${process.pid} ${host} ${
          res ? res.status : "ERR"
        } ${t1 - t0}ms ${url.length > 160 ? url.slice(0, 157) + "..." : url}`,
      );
      if (host === OPENVERSE_HOST && res) {
        const rh = parseRateHeaders(res.headers);
        const st = readOpenverseStateSync();
        if (rh.sustained != null) st.sustained_available = rh.sustained;
        if (rh.burst != null) st.burst_available = rh.burst;
        if (rh.sustainedLimit) st.sustained_limit = rh.sustainedLimit;
        if (rh.burstLimit) st.burst_limit = rh.burstLimit;
        st.updated_at = new Date().toISOString();
        if (res.status === 429) {
          const ms = retryAfterMs(res, 0);
          if (ms > 60_000) st.blocked_until = new Date(Date.now() + ms).toISOString();
        }
        if (openverseNoun) {
          st.per_noun = st.per_noun || {};
          st.per_noun[openverseNoun] = (st.per_noun[openverseNoun] || 0) + 1;
        }
        st.total_requests = (st.total_requests || 0) + 1;
        await writeOpenverseState(st);
      }
      if (err) throw err;
      return { status: res.status, headers: res.headers, body, url };
    });
  } finally {
    done();
  }
}

/**
 * GET `url` politely. Options:
 *   accept: Accept header
 *   openverseNoun: noun slug (required for api.openverse.org; used for the per-noun cap)
 *   allowStatus: array of non-2xx statuses to return instead of throwing
 * Returns {status, headers, body: Buffer, url (final)}.
 */
export async function request(url, opts = {}) {
  let current = url;
  let redirects = 0;
  let isOpenverse = new URL(url).host === OPENVERSE_HOST;
  if (isOpenverse && !opts.openverseNoun) throw new Error("openverseNoun is required for Openverse requests");
  let countedNoun = opts.openverseNoun; // count the per-noun query only once
  for (let attempt = 0; ; ) {
    let res;
    try {
      res = await hop(current, { accept: opts.accept, openverseNoun: countedNoun });
      if (new URL(current).host === OPENVERSE_HOST) countedNoun = undefined;
    } catch (e) {
      if (e instanceof BudgetError) throw e;
      if (new URL(current).host === OPENVERSE_HOST) countedNoun = undefined;
      if (attempt >= MAX_RETRIES) throw e;
      const ms = 2000 * 2 ** attempt;
      process.stderr.write(`[net] network error (${e.message}); retry ${attempt + 1}/${MAX_RETRIES} in ${ms}ms\n`);
      attempt++;
      await sleep(ms);
      continue;
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (++redirects > MAX_REDIRECTS) throw new HttpError("too many redirects", res.status, current);
      current = new URL(res.headers.get("location"), current).toString();
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const ms = retryAfterMs(res, attempt);
      if (attempt >= MAX_RETRIES || ms > MAX_RETRY_AFTER_MS) {
        if (new URL(current).host === OPENVERSE_HOST && res.status === 429) {
          throw new BudgetError(`openverse 429 (retry-after ${Math.round(ms / 1000)}s)`);
        }
        throw new HttpError(`HTTP ${res.status} after ${attempt} retries: ${current}`, res.status, current);
      }
      process.stderr.write(`[net] HTTP ${res.status}; retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(ms)}ms\n`);
      attempt++;
      await sleep(ms);
      continue;
    }
    if (res.status >= 400 && !(opts.allowStatus || []).includes(res.status)) {
      const snippet = res.body.toString("utf8", 0, 300).replace(/\s+/g, " ");
      throw new HttpError(`HTTP ${res.status} for ${current}: ${snippet}`, res.status, current);
    }
    return res;
  }
}

export async function getJson(url, opts = {}) {
  const res = await request(url, { accept: "application/json", ...opts });
  try {
    return JSON.parse(res.body.toString("utf8"));
  } catch {
    throw new HttpError(`invalid JSON from ${url}: ${res.body.toString("utf8", 0, 200)}`, res.status, url);
  }
}

export async function getBuffer(url, opts = {}) {
  const res = await request(url, opts);
  return { buffer: res.body, contentType: res.headers.get("content-type") || "", finalUrl: res.url };
}
