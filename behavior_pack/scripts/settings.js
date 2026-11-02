// Per-player settings and waypoints, persisted as player dynamic properties.

const SETTINGS_KEY = "minimap:settings";
const WAYPOINTS_KEY = "minimap:waypoints";
export const MAX_WAYPOINTS = 100;

export const SIZES = [17, 21, 25, 29, 33, 41];
export const ZOOMS = [1, 2, 4, 8, 16];
export const LARGE_SIZES = [
  [41, 29],
  [61, 41],
  [81, 51],
];
export const INTERVALS = [1, 2, 4, 8];

export const DEFAULT_SETTINGS = {
  enabled: true,
  lang: "de",
  position: "TR", // TR | TL
  size: 25,
  zoom: 1,
  rotate: false,
  cave: "auto", // auto | off | on
  showPlayers: true,
  showHostile: true,
  showPassive: true,
  showWaypoints: true,
  showCoords: true,
  showDirection: true,
  showBiome: true,
  showTime: false,
  deathWaypoints: true,
  interval: 2,
  large: false,
  largeSize: 1,
  largeZoom: 4,
  tracked: "", // waypoint id
};

const settingsCache = new Map();
const waypointCache = new Map();

export function getSettings(player) {
  let s = settingsCache.get(player.id);
  if (s) return s;
  s = { ...DEFAULT_SETTINGS };
  try {
    const raw = player.getDynamicProperty(SETTINGS_KEY);
    if (typeof raw === "string") Object.assign(s, JSON.parse(raw));
  } catch (e) {
    console.warn(`[minimap] could not read settings: ${e}`);
  }
  if (!SIZES.includes(s.size)) s.size = DEFAULT_SETTINGS.size;
  if (!ZOOMS.includes(s.zoom)) s.zoom = DEFAULT_SETTINGS.zoom;
  if (!ZOOMS.includes(s.largeZoom)) s.largeZoom = DEFAULT_SETTINGS.largeZoom;
  if (!LARGE_SIZES[s.largeSize]) s.largeSize = DEFAULT_SETTINGS.largeSize;
  if (!INTERVALS.includes(s.interval)) s.interval = DEFAULT_SETTINGS.interval;
  s.large = false; // never restore the big map on join
  settingsCache.set(player.id, s);
  return s;
}

export function saveSettings(player) {
  const s = getSettings(player);
  try {
    player.setDynamicProperty(SETTINGS_KEY, JSON.stringify(s));
  } catch (e) {
    console.warn(`[minimap] could not save settings: ${e}`);
  }
}

export function getWaypoints(player) {
  let w = waypointCache.get(player.id);
  if (w) return w;
  w = [];
  try {
    const raw = player.getDynamicProperty(WAYPOINTS_KEY);
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) w = parsed;
    }
  } catch (e) {
    console.warn(`[minimap] could not read waypoints: ${e}`);
  }
  waypointCache.set(player.id, w);
  return w;
}

export function saveWaypoints(player) {
  const w = getWaypoints(player);
  try {
    player.setDynamicProperty(WAYPOINTS_KEY, JSON.stringify(w));
  } catch (e) {
    console.warn(`[minimap] could not save waypoints: ${e}`);
  }
}

export function newWaypointId() {
  return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

export function addWaypoint(player, wp) {
  const list = getWaypoints(player);
  if (list.length >= MAX_WAYPOINTS) return undefined;
  const full = {
    id: newWaypointId(),
    name: "Waypoint",
    color: 0,
    visible: true,
    type: "normal",
    ...wp,
  };
  list.push(full);
  saveWaypoints(player);
  return full;
}

export function removeWaypoint(player, id) {
  const list = getWaypoints(player);
  const i = list.findIndex((w) => w.id === id);
  if (i >= 0) list.splice(i, 1);
  const s = getSettings(player);
  if (s.tracked === id) {
    s.tracked = "";
    saveSettings(player);
  }
  saveWaypoints(player);
}

export function forgetPlayer(id) {
  settingsCache.delete(id);
  waypointCache.delete(id);
}
