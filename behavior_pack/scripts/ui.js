// Menus (server-ui forms): main menu, settings, waypoint management.
import { system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData, FormCancelationReason } from "@minecraft/server-ui";
import {
  getSettings,
  saveSettings,
  getWaypoints,
  saveWaypoints,
  addWaypoint,
  removeWaypoint,
  SIZES,
  ZOOMS,
  LARGE_SIZES,
  INTERVALS,
} from "./settings.js";
import { t, dimName, LANGS, LANG_NAMES } from "./lang.js";
import { WAYPOINT_COLORS } from "./palette.js";

const DIMENSIONS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

/** Show a form, retrying while the player still has the chat/another screen open. */
async function show(player, form) {
  for (let i = 0; i < 40; i++) {
    const res = await form.show(player);
    if (res.canceled && res.cancelationReason === FormCancelationReason.UserBusy) {
      await new Promise((r) => system.runTimeout(r, 5));
      continue;
    }
    return res;
  }
  return { canceled: true };
}

function fmtPos(wp) {
  return `${wp.x} ${wp.y} ${wp.z}`;
}

function canTeleport(player) {
  try {
    if (typeof player.playerPermissionLevel === "number") return player.playerPermissionLevel >= 2;
  } catch {
    /* ignore */
  }
  try {
    if (typeof player.commandPermissionLevel === "number") return player.commandPermissionLevel >= 1;
  } catch {
    /* ignore */
  }
  return false;
}

export function changeZoom(player, dir) {
  const st = getSettings(player);
  const key = st.large ? "largeZoom" : "zoom";
  const i = ZOOMS.indexOf(st[key]);
  const n = Math.max(0, Math.min(ZOOMS.length - 1, i + dir));
  st[key] = ZOOMS[n];
  saveSettings(player);
  player.onScreenDisplay.setActionBar(t(st.lang, "zoom_msg", st[key]));
}

export async function openMainMenu(player) {
  const st = getSettings(player);
  const L = st.lang;
  const form = new ActionFormData()
    .title(t(L, "title"))
    .body(t(L, "menu_body"))
    .button(st.enabled ? t(L, "toggle_off") : t(L, "toggle_on"))
    .button(st.large ? t(L, "large_off") : t(L, "large_on"))
    .button(t(L, "waypoints"))
    .button(t(L, "settings"))
    .button(t(L, "zoom_in"))
    .button(t(L, "zoom_out"))
    .button(t(L, "close"));
  const res = await show(player, form);
  if (res.canceled) return;
  switch (res.selection) {
    case 0:
      st.enabled = !st.enabled;
      saveSettings(player);
      break;
    case 1:
      st.large = !st.large;
      break;
    case 2:
      await openWaypointList(player);
      break;
    case 3:
      await openSettings(player);
      break;
    case 4:
      changeZoom(player, -1);
      break;
    case 5:
      changeZoom(player, 1);
      break;
  }
}

export async function openSettings(player) {
  const st = getSettings(player);
  const L = st.lang;
  const caveModes = ["auto", "off", "on"];
  const positions = ["TR", "TL"];
  const form = new ModalFormData()
    .title(t(L, "settings"))
    .dropdown(t(L, "set_lang"), LANG_NAMES, { defaultValueIndex: Math.max(0, LANGS.indexOf(L)) })
    .dropdown(t(L, "set_position"), [t(L, "pos_tr"), t(L, "pos_tl")], {
      defaultValueIndex: Math.max(0, positions.indexOf(st.position)),
    })
    .dropdown(t(L, "set_size"), SIZES.map(String), { defaultValueIndex: Math.max(0, SIZES.indexOf(st.size)) })
    .dropdown(t(L, "set_zoom"), ZOOMS.map(String), { defaultValueIndex: Math.max(0, ZOOMS.indexOf(st.zoom)) })
    .toggle(t(L, "set_rotate"), { defaultValue: st.rotate })
    .dropdown(t(L, "set_cave"), [t(L, "cave_auto"), t(L, "cave_off"), t(L, "cave_on")], {
      defaultValueIndex: Math.max(0, caveModes.indexOf(st.cave)),
    })
    .toggle(t(L, "set_players"), { defaultValue: st.showPlayers })
    .toggle(t(L, "set_hostile"), { defaultValue: st.showHostile })
    .toggle(t(L, "set_passive"), { defaultValue: st.showPassive })
    .toggle(t(L, "set_waypoints"), { defaultValue: st.showWaypoints })
    .toggle(t(L, "set_coords"), { defaultValue: st.showCoords })
    .toggle(t(L, "set_direction"), { defaultValue: st.showDirection })
    .toggle(t(L, "set_biome"), { defaultValue: st.showBiome })
    .toggle(t(L, "set_time"), { defaultValue: st.showTime })
    .toggle(t(L, "set_death"), { defaultValue: st.deathWaypoints })
    .dropdown(t(L, "set_interval"), INTERVALS.map(String), {
      defaultValueIndex: Math.max(0, INTERVALS.indexOf(st.interval)),
    })
    .dropdown(
      t(L, "set_large_size"),
      LARGE_SIZES.map(([w, h]) => `${w} x ${h}`),
      { defaultValueIndex: st.largeSize }
    )
    .dropdown(t(L, "set_large_zoom"), ZOOMS.map(String), {
      defaultValueIndex: Math.max(0, ZOOMS.indexOf(st.largeZoom)),
    })
    .submitButton("OK");
  const res = await show(player, form);
  if (res.canceled || !res.formValues) return;
  const v = res.formValues;
  let i = 0;
  st.lang = LANGS[v[i++]] ?? "de";
  st.position = positions[v[i++]] ?? "TR";
  st.size = SIZES[v[i++]] ?? st.size;
  st.zoom = ZOOMS[v[i++]] ?? st.zoom;
  st.rotate = !!v[i++];
  st.cave = caveModes[v[i++]] ?? "auto";
  st.showPlayers = !!v[i++];
  st.showHostile = !!v[i++];
  st.showPassive = !!v[i++];
  st.showWaypoints = !!v[i++];
  st.showCoords = !!v[i++];
  st.showDirection = !!v[i++];
  st.showBiome = !!v[i++];
  st.showTime = !!v[i++];
  st.deathWaypoints = !!v[i++];
  st.interval = INTERVALS[v[i++]] ?? st.interval;
  st.largeSize = typeof v[i] === "number" ? v[i] : st.largeSize;
  i++;
  st.largeZoom = ZOOMS[v[i++]] ?? st.largeZoom;
  saveSettings(player);
  player.sendMessage(t(st.lang, "saved"));
}

function distanceTo(player, wp) {
  if (wp.dim !== player.dimension.id) return "-";
  const l = player.location;
  return Math.round(Math.hypot(wp.x + 0.5 - l.x, wp.y - l.y, wp.z + 0.5 - l.z)) + "m";
}

export async function openWaypointList(player) {
  const st = getSettings(player);
  const L = st.lang;
  const list = getWaypoints(player);
  const form = new ActionFormData()
    .title(t(L, "waypoints"))
    .body(list.length ? t(L, "wp_list_body", list.length) : t(L, "wp_empty"))
    .button(t(L, "wp_add_here"))
    .button(t(L, "wp_add_custom"));
  for (const wp of list) {
    const color = WAYPOINT_COLORS[wp.color & 15][2];
    const tracked = st.tracked === wp.id ? " §l»§r" : "";
    const hidden = wp.visible ? "" : " §8(-)";
    form.button(`${color}■ §r${wp.name}${tracked}${hidden}\n§8${dimName(L, wp.dim)} · ${distanceTo(player, wp)}`);
  }
  form.button(t(L, "back"));
  const res = await show(player, form);
  if (res.canceled) return;
  const sel = res.selection;
  if (sel === 0) return addHere(player);
  if (sel === 1) return openWaypointEditor(player, undefined);
  const wp = list[sel - 2];
  if (wp) return openWaypointDetails(player, wp);
  return openMainMenu(player);
}

export function addHere(player, name) {
  const st = getSettings(player);
  const l = player.location;
  const list = getWaypoints(player);
  const wp = addWaypoint(player, {
    name: name || t(st.lang, "wp_default_name", list.length + 1),
    x: Math.floor(l.x),
    y: Math.floor(l.y),
    z: Math.floor(l.z),
    dim: player.dimension.id,
    color: list.length % WAYPOINT_COLORS.length,
  });
  if (!wp) {
    player.sendMessage(t(st.lang, "wp_full"));
    return;
  }
  player.sendMessage(t(st.lang, "wp_added", wp.name, fmtPos(wp)));
}

async function openWaypointDetails(player, wp) {
  const st = getSettings(player);
  const L = st.lang;
  const actions = [];
  const form = new ActionFormData()
    .title(`${WAYPOINT_COLORS[wp.color & 15][2]}${wp.name}`)
    .body(t(L, "wp_details", fmtPos(wp), dimName(L, wp.dim), distanceTo(player, wp)));
  const add = (label, fn) => {
    form.button(label);
    actions.push(fn);
  };
  add(st.tracked === wp.id ? t(L, "wp_untrack") : t(L, "wp_track_btn"), () => {
    st.tracked = st.tracked === wp.id ? "" : wp.id;
    saveSettings(player);
  });
  add(t(L, "wp_edit"), () => openWaypointEditor(player, wp));
  if (canTeleport(player)) {
    add(t(L, "wp_teleport"), () => {
      try {
        player.teleport({ x: wp.x + 0.5, y: wp.y, z: wp.z + 0.5 }, { dimension: world.getDimension(wp.dim) });
      } catch (e) {
        player.sendMessage(`§c${e}`);
      }
    });
  }
  add(t(L, "wp_share"), () => {
    world.sendMessage(t(L, "wp_shared", player.name, wp.name, fmtPos(wp), dimName(L, wp.dim)));
  });
  add(`§c${t(L, "wp_delete")}`, () => {
    removeWaypoint(player, wp.id);
    player.sendMessage(t(L, "wp_deleted", wp.name));
  });
  add(t(L, "back"), () => openWaypointList(player));
  const res = await show(player, form);
  if (res.canceled) return;
  await actions[res.selection]?.();
}

async function openWaypointEditor(player, wp) {
  const st = getSettings(player);
  const L = st.lang;
  const l = player.location;
  const isNew = !wp;
  const base = wp ?? {
    name: t(L, "wp_default_name", getWaypoints(player).length + 1),
    x: Math.floor(l.x),
    y: Math.floor(l.y),
    z: Math.floor(l.z),
    dim: player.dimension.id,
    color: getWaypoints(player).length % WAYPOINT_COLORS.length,
    visible: true,
  };
  const form = new ModalFormData()
    .title(t(L, "waypoints"))
    .textField(t(L, "wp_name"), "Name", { defaultValue: base.name })
    .textField(t(L, "wp_x"), "0", { defaultValue: String(base.x) })
    .textField(t(L, "wp_y"), "64", { defaultValue: String(base.y) })
    .textField(t(L, "wp_z"), "0", { defaultValue: String(base.z) })
    .dropdown(
      t(L, "wp_dimension"),
      DIMENSIONS.map((d) => dimName(L, d)),
      { defaultValueIndex: Math.max(0, DIMENSIONS.indexOf(base.dim)) }
    )
    .dropdown(
      t(L, "wp_color"),
      WAYPOINT_COLORS.map(([name, , code]) => `${code}■ §r${name}`),
      { defaultValueIndex: base.color & 15 }
    )
    .toggle(t(L, "wp_visible"), { defaultValue: base.visible !== false })
    .toggle(t(L, "wp_track"), { defaultValue: st.tracked !== "" && st.tracked === base.id })
    .submitButton("OK");
  const res = await show(player, form);
  if (res.canceled || !res.formValues) return;
  const [name, xs, ys, zs, dimIdx, color, visible, track] = res.formValues;
  const x = parseInt(String(xs), 10);
  const y = parseInt(String(ys), 10);
  const z = parseInt(String(zs), 10);
  if (![x, y, z].every(Number.isFinite)) {
    player.sendMessage(t(L, "wp_invalid"));
    return;
  }
  const data = {
    name: String(name).trim().slice(0, 32) || base.name,
    x,
    y,
    z,
    dim: DIMENSIONS[dimIdx] ?? base.dim,
    color: Number(color) & 15,
    visible: !!visible,
  };
  let target;
  if (isNew) {
    target = addWaypoint(player, data);
    if (!target) {
      player.sendMessage(t(L, "wp_full"));
      return;
    }
    player.sendMessage(t(L, "wp_added", target.name, fmtPos(target)));
  } else {
    Object.assign(wp, data);
    target = wp;
    saveWaypoints(player);
  }
  if (track) st.tracked = target.id;
  else if (st.tracked === target.id) st.tracked = "";
  saveSettings(player);
}
