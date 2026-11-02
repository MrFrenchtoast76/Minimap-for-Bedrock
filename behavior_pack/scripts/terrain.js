// Terrain sampling with a per-dimension column cache and a per-tick work budget.
//
// Each cache entry describes one world column:
//   b: base colour index, h: height of the visible block,
//   d: water depth (only for water), t: tick sampled, r: reference Y (cave mode)
import { blockColor, isWater } from "./blockColors.js";
import { BASE } from "./palette.js";

const SURFACE_TTL = 600; // re-scan surface columns after 30 s
const CAVE_TTL = 300;
const RETRY_TTL = 60; // unloaded / unknown columns are retried quickly
const CAVE_UP = 2; // cave scan starts this many blocks above the feet
const CAVE_DOWN = 24; // and goes this far down
const MAX_WATER_DEPTH = 10;

const caches = new Map(); // "dimId|s" or "dimId|c" -> Map<string, entry>

let now = 0;
let ops = 0;
let deadline = 0;

/** Called once per tick before rendering. */
export function beginTick(tick, opBudget, msBudget) {
  now = tick;
  ops = opBudget;
  deadline = Date.now() + msBudget;
}

export function hasBudget() {
  return ops > 0 && Date.now() < deadline;
}

export function getCache(dimId, cave) {
  const key = dimId + (cave ? "|c" : "|s");
  let c = caches.get(key);
  if (!c) {
    c = new Map();
    caches.set(key, c);
  }
  return c;
}

export function isFresh(entry, cave, refY) {
  if (!entry) return false;
  const age = now - entry.t;
  if (entry.u) return age < RETRY_TTL;
  if (cave) return age < CAVE_TTL && Math.abs(entry.r - refY) <= 2;
  return age < SURFACE_TTL;
}

function unknown() {
  return { b: BASE.void, h: -9999, t: now, u: 1 };
}

export function sampleSurface(dim, x, z) {
  ops--;
  let block;
  try {
    block = dim.getTopmostBlock({ x, z });
  } catch {
    return unknown();
  }
  if (!block) return { b: BASE.void, h: -9999, t: now, u: 1 };
  const typeId = block.typeId;
  const y = block.location.y;
  const entry = { b: blockColor(typeId), h: y, t: now };
  if (isWater(typeId)) {
    let d = 1;
    try {
      for (; d < MAX_WATER_DEPTH; d++) {
        ops--;
        const below = dim.getBlock({ x, y: y - d, z });
        if (!below || !(isWater(below.typeId) || below.isWaterlogged)) break;
      }
    } catch {
      /* ignore */
    }
    entry.d = d;
  }
  return entry;
}

export function sampleCave(dim, x, z, refY) {
  let sawAir = false;
  const top = refY + CAVE_UP;
  const bottom = Math.max(refY - CAVE_DOWN, dim.heightRange?.min ?? -64);
  try {
    for (let y = top; y >= bottom; y--) {
      ops--;
      const block = dim.getBlock({ x, y, z });
      if (!block) return unknown();
      if (block.isAir) {
        sawAir = true;
        continue;
      }
      const typeId = block.typeId;
      if (!sawAir) continue;
      // non-solid decorations: keep looking if it is just a torch etc.? Show them.
      const entry = { b: blockColor(typeId), h: y, t: now, r: refY };
      if (isWater(typeId)) entry.d = 2;
      return entry;
    }
  } catch {
    return unknown();
  }
  // solid rock (or nothing found): dark
  return { b: BASE.void, h: top, t: now, r: refY, w: 1 };
}

/** Decide whether the player is underground (for automatic cave mode). */
export function detectCave(dim, loc) {
  if (dim.id === "minecraft:nether") return true;
  if (dim.id === "minecraft:the_end") return false;
  try {
    const x = Math.floor(loc.x);
    const z = Math.floor(loc.z);
    const top = dim.getTopmostBlock({ x, z });
    if (!top) return false;
    // More than 8 blocks of something above our head -> treat as cave.
    return top.location.y - loc.y > 8;
  } catch {
    return false;
  }
}

/** Drop far-away entries when caches grow too big. */
export function pruneCaches(playerPositions) {
  for (const [key, cache] of caches) {
    if (cache.size < 40000) continue;
    const dimId = key.slice(0, key.lastIndexOf("|"));
    const near = playerPositions.filter((p) => p.dim === dimId);
    for (const [k, e] of cache) {
      const i = k.indexOf(",");
      const x = +k.slice(0, i);
      const z = +k.slice(i + 1);
      let keep = false;
      for (const p of near) {
        if (Math.abs(p.x - x) < 300 && Math.abs(p.z - z) < 300) {
          keep = true;
          break;
        }
      }
      if (!keep || now - e.t > SURFACE_TTL * 4) cache.delete(k);
    }
  }
}
