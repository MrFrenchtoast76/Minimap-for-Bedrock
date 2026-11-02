// Builds the map text (glyph characters) and the info lines for one player.
import { world } from "@minecraft/server";
import { MAP_PAGE, ICON_PAGE, ICON, BASE, WAYPOINT_COLORS } from "./palette.js";
import { getCache, isFresh, hasBudget, sampleSurface, sampleCave, detectCave } from "./terrain.js";
import { getWaypoints } from "./settings.js";
import { t, dimName } from "./lang.js";

const COLOR_GLYPH = Array.from({ length: 256 }, (_, i) => String.fromCharCode(MAP_PAGE + i));
const ICON_GLYPH = Array.from({ length: 256 }, (_, i) => String.fromCharCode(ICON_PAGE + i));
const VOID_GLYPH = COLOR_GLYPH[BASE.void * 4 + 1];

export function iconGlyph(i) {
  return ICON_GLYPH[i];
}

/** Arrow glyph (16 directions) for a compass heading in degrees (0 = north, clockwise). */
export function arrowGlyph(heading) {
  const i = (((Math.round(heading / 22.5) % 16) + 16) % 16);
  return ICON_GLYPH[ICON.ARROW + i];
}

// Cells ordered from the centre outwards so nearby terrain is scanned first.
const spiralCache = new Map();
function spiral(w, h) {
  const key = w * 1000 + h;
  let s = spiralCache.get(key);
  if (s) return s;
  const rx = (w - 1) / 2;
  const ry = (h - 1) / 2;
  s = [];
  for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) s.push([dx, dy, dx * dx + dy * dy]);
  s.sort((a, b) => a[2] - b[2]);
  spiralCache.set(key, s);
  return s;
}

// Entity classification is cached by type id.
const entityKind = new Map();
function classify(entity) {
  const typeId = entity.typeId;
  if (typeId === "minecraft:player") return "player";
  let k = entityKind.get(typeId);
  if (k !== undefined) return k;
  k = "none";
  try {
    if (entity.getComponent("minecraft:health")) {
      const fam = entity.getComponent("minecraft:type_family");
      k = fam && fam.hasTypeFamily("monster") ? "hostile" : "passive";
    }
  } catch {
    k = "none";
  }
  entityKind.set(typeId, k);
  return k;
}

const EXCLUDE_TYPES = [
  "minecraft:item",
  "minecraft:xp_orb",
  "minecraft:arrow",
  "minecraft:painting",
  "minecraft:armor_stand",
  "minecraft:leash_knot",
];

function shadeFor(entry, north) {
  if (entry.d !== undefined) {
    const d = entry.d;
    return d <= 1 ? 2 : d <= 3 ? 1 : d <= 6 ? 0 : 3;
  }
  if (!north || north.u || north.w) return 1;
  const dh = entry.h - north.h;
  if (dh > 0) return 2;
  if (dh === 0) return 1;
  if (dh >= -3) return 0;
  return 3;
}

const DIRS = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
const DIRS_EN = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function headingOf(player) {
  const yaw = player.getRotation().y; // 0 = south, 90 = west, 180 = north
  return (((yaw + 180) % 360) + 360) % 360;
}

/**
 * @returns {{ map: string, info: string }}
 */
export function render(player, st, w, h, zoom) {
  const dim = player.dimension;
  const loc = player.location;
  const s = zoom;
  const rx = (w - 1) / 2;
  const ry = (h - 1) / 2;

  const cave = st.cave === "on" || (st.cave === "auto" && detectCave(dim, loc));
  const refY = Math.floor(loc.y);
  const cache = getCache(dim.id, cave);

  const heading = headingOf(player);
  const yawRad = (player.getRotation().y * Math.PI) / 180;
  const fx = -Math.sin(yawRad);
  const fz = Math.cos(yawRad);
  const rgx = -fz; // right vector = forward rotated 90° clockwise (seen from above)
  const rgz = fx;
  const cx = Math.floor(loc.x / s);
  const cz = Math.floor(loc.z / s);

  // cell -> world column (snapped to the zoom grid so cache entries are shared)
  const colX = new Int32Array(w * h);
  const colZ = new Int32Array(w * h);
  for (let dy = -ry, i = 0; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++, i++) {
      if (st.rotate) {
        const wx = loc.x + (dx * rgx - dy * fx) * s;
        const wz = loc.z + (dx * rgz - dy * fz) * s;
        colX[i] = Math.floor(wx / s) * s;
        colZ[i] = Math.floor(wz / s) * s;
      } else {
        colX[i] = (cx + dx) * s;
        colZ[i] = (cz + dy) * s;
      }
    }
  }

  // 1) scan missing / stale columns, nearest first, as long as budget lasts
  for (const [dx, dy] of spiral(w, h)) {
    if (!hasBudget()) break;
    const i = (dy + ry) * w + (dx + rx);
    const x = colX[i];
    const z = colZ[i];
    const key = x + "," + z;
    const e = cache.get(key);
    if (isFresh(e, cave, refY)) continue;
    cache.set(key, cave ? sampleCave(dim, x, z, refY) : sampleSurface(dim, x, z));
  }

  // 2) overlays: waypoints, entities, the player itself
  const overlay = new Map();
  const toCell = (ex, ez) => {
    if (st.rotate) {
      const relx = (ex - loc.x) / s;
      const relz = (ez - loc.z) / s;
      return [relx * rgx + relz * rgz, -(relx * fx + relz * fz)];
    }
    return [Math.floor(ex / s) - cx, Math.floor(ez / s) - cz];
  };
  const put = (dx, dy, glyph, clamp) => {
    if (Math.abs(dx) > rx || Math.abs(dy) > ry) {
      if (!clamp) return;
      const f = Math.min(rx / Math.abs(dx || 1e-9), ry / Math.abs(dy || 1e-9));
      dx *= f;
      dy *= f;
    }
    dx = Math.max(-rx, Math.min(rx, Math.round(dx)));
    dy = Math.max(-ry, Math.min(ry, Math.round(dy)));
    overlay.set((dy + ry) * w + (dx + rx), glyph);
  };

  const waypoints = getWaypoints(player);
  if (st.showWaypoints) {
    for (const wp of waypoints) {
      if (!wp.visible || wp.dim !== dim.id) continue;
      const [dx, dy] = toCell(wp.x + 0.5, wp.z + 0.5);
      const glyph = wp.type === "death" ? ICON_GLYPH[ICON.DEATH] : ICON_GLYPH[ICON.WAYPOINT + (wp.color & 15)];
      put(dx, dy, glyph, true);
    }
  }

  if (st.showPlayers || st.showHostile || st.showPassive) {
    const maxDist = Math.sqrt(rx * rx + ry * ry) * s + 2;
    let entities = [];
    try {
      entities = dim.getEntities({ location: loc, maxDistance: maxDist, excludeTypes: EXCLUDE_TYPES });
    } catch {
      entities = [];
    }
    const drawn = { passive: [], hostile: [], player: [] };
    for (const en of entities) {
      if (en.id === player.id) continue;
      const kind = classify(en);
      if (kind === "none") continue;
      if (kind === "player" && !st.showPlayers) continue;
      if (kind === "hostile" && !st.showHostile) continue;
      if (kind === "passive" && !st.showPassive) continue;
      if (drawn[kind].length < 150) drawn[kind].push(en);
    }
    for (const [kind, icon] of [
      ["passive", ICON.PASSIVE],
      ["hostile", ICON.HOSTILE],
      ["player", ICON.PLAYER],
    ]) {
      for (const en of drawn[kind]) {
        const l = en.location;
        const [dx, dy] = toCell(l.x, l.z);
        put(dx, dy, ICON_GLYPH[icon], false);
      }
    }
  }

  if (st.rotate) {
    // north marker on the rim
    const [ndx, ndy] = [-rgz * 1000, fz * 1000];
    put(ndx, ndy, ICON_GLYPH[ICON.NORTH], true);
  }
  overlay.set(ry * w + rx, st.rotate ? ICON_GLYPH[ICON.ARROW] : arrowGlyph(heading));

  // 3) compose the glyph rows
  const rows = new Array(h);
  for (let r = 0, i = 0; r < h; r++) {
    let line = "";
    for (let c = 0; c < w; c++, i++) {
      const o = overlay.get(i);
      if (o !== undefined) {
        line += o;
        continue;
      }
      const x = colX[i];
      const z = colZ[i];
      const e = cache.get(x + "," + z);
      if (!e || e.u) {
        line += VOID_GLYPH;
        continue;
      }
      if (e.w) {
        line += COLOR_GLYPH[BASE.void * 4 + 1];
        continue;
      }
      const north = cache.get(x + "," + (z - s));
      line += COLOR_GLYPH[e.b * 4 + shadeFor(e, north)];
    }
    rows[r] = line;
  }

  return { map: rows.join("\n"), info: buildInfo(player, st, dim, loc, heading, cave, waypoints, zoom) };
}

function buildInfo(player, st, dim, loc, heading, cave, waypoints, zoom) {
  const lang = st.lang;
  const lines = [];
  if (st.showCoords) {
    lines.push(`§f${Math.floor(loc.x)} §7/ §f${Math.floor(loc.y)} §7/ §f${Math.floor(loc.z)}`);
  }
  if (st.showDirection) {
    const dirs = lang === "de" ? DIRS : DIRS_EN;
    const d = dirs[Math.round(heading / 45) % 8];
    let line = `§e${d} §7${Math.round(heading)}°  §8x${zoom}`;
    if (cave) line += `  §6${t(lang, "cave_label")}`;
    lines.push(line);
  }
  if (st.showBiome && typeof dim.getBiome === "function") {
    try {
      const biome = dim.getBiome(loc);
      if (biome?.id) {
        const name = biome.id.replace("minecraft:", "").replace(/_/g, " ");
        lines.push(`§a${name.charAt(0).toUpperCase()}${name.slice(1)}`);
      }
    } catch {
      /* biome API not available */
    }
  }
  if (st.showTime) {
    const tod = world.getTimeOfDay();
    const hours = (Math.floor(tod / 1000) + 6) % 24;
    const minutes = Math.floor(((tod % 1000) * 60) / 1000);
    lines.push(`§b${t(lang, "day")} ${world.getDay()} §7${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
  }
  if (st.tracked) {
    const wp = waypoints.find((x) => x.id === st.tracked);
    if (wp) {
      const color = WAYPOINT_COLORS[wp.color & 15][2];
      if (wp.dim === dim.id) {
        const dx = wp.x + 0.5 - loc.x;
        const dz = wp.z + 0.5 - loc.z;
        const dist = Math.round(Math.sqrt(dx * dx + dz * dz + (wp.y - loc.y) ** 2));
        // bearing of the waypoint (0 = north), relative to where the player looks
        const bearing = (Math.atan2(dx, -dz) * 180) / Math.PI;
        const rel = bearing - heading;
        lines.push(`${color}${wp.name} §f${dist}m ${arrowGlyph(rel)}`);
      } else {
        lines.push(`${color}${wp.name} §7(${dimName(lang, wp.dim)})`);
      }
    }
  }
  return lines.length ? lines.join("\n") : " ";
}
