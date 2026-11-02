// Minimap for Bedrock - entry point.
import {
  world,
  system,
  ItemStack,
  Player,
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
} from "@minecraft/server";
import { MARKERS } from "./palette.js";
import { beginTick, pruneCaches } from "./terrain.js";
import { render } from "./renderer.js";
import {
  getSettings,
  saveSettings,
  getWaypoints,
  saveWaypoints,
  addWaypoint,
  forgetPlayer,
  LARGE_SIZES,
  ZOOMS,
} from "./settings.js";
import { openMainMenu, openSettings, openWaypointList, addHere, changeZoom } from "./ui.js";
import { t } from "./lang.js";

const ITEM_ID = "minimap:minimap";
const GOT_ITEM_KEY = "minimap:got_item";

// Work budget for terrain scanning, shared by all players each tick.
const OPS_PER_TICK = 900;
const MS_PER_TICK = 6;
const RESEND_TICKS = 80; // re-send an unchanged map at least this often

const TITLE_OPTS = { fadeInDuration: 0, fadeOutDuration: 0, stayDuration: 200 };

/** Runtime (non-persistent) state per player. */
const runtime = new Map();
function state(player) {
  let s = runtime.get(player.id);
  if (!s) {
    s = { hidden: false, phase: Math.floor(Math.random() * 8), last: "", lastTick: 0 };
    runtime.set(player.id, s);
  }
  return s;
}

let tick = 0;
let errorLogged = false;

function hide(player, rt) {
  if (rt.hidden) return;
  player.onScreenDisplay.setTitle(MARKERS.OFF, { fadeInDuration: 0, fadeOutDuration: 0, stayDuration: 1 });
  rt.hidden = true;
  rt.last = "";
}

function update(player) {
  const st = getSettings(player);
  const rt = state(player);
  if (!st.enabled && !st.large) {
    hide(player, rt);
    return;
  }
  if ((tick + rt.phase) % st.interval !== 0) return;

  const [w, h] = st.large ? LARGE_SIZES[st.largeSize] : [st.size, st.size];
  const zoom = st.large ? st.largeZoom : st.zoom;
  const { map, info } = render(player, st, w, h, zoom);
  const marker = st.large ? MARKERS.LARGE : MARKERS[st.position] ?? MARKERS.TR;
  const text = marker + map;

  if (text + info === rt.last && tick - rt.lastTick < RESEND_TICKS) return;
  rt.last = text + info;
  rt.lastTick = tick;
  rt.hidden = false;
  player.onScreenDisplay.setTitle(text, { ...TITLE_OPTS, subtitle: info });
}

function mainLoop() {
  tick++;
  beginTick(tick, OPS_PER_TICK, MS_PER_TICK);
  const players = world.getAllPlayers();
  const n = players.length;
  if (!n) return;
  const start = tick % n; // rotate order so every player gets scan budget
  for (let k = 0; k < n; k++) {
    const p = players[(start + k) % n];
    try {
      if (p.isValid === false) continue;
      update(p);
    } catch (e) {
      if (!errorLogged) {
        console.error(`[minimap] update failed: ${e}\n${e?.stack ?? ""}`);
        errorLogged = true;
      }
    }
  }
  if (tick % 600 === 0) {
    pruneCaches(
      players.map((p) => ({ dim: p.dimension.id, x: p.location.x, z: p.location.z }))
    );
  }
}

// ---------------------------------------------------------------- events

world.afterEvents.worldLoad.subscribe(() => {
  system.runInterval(mainLoop, 1);
});

world.afterEvents.itemUse.subscribe((ev) => {
  if (ev.itemStack?.typeId !== ITEM_ID) return;
  const player = ev.source;
  if (player.isSneaking) {
    const st = getSettings(player);
    st.large = !st.large;
    state(player).last = "";
  } else {
    system.run(() => openMainMenu(player));
  }
});

world.afterEvents.entityDie.subscribe(
  (ev) => {
    const player = ev.deadEntity;
    if (!(player instanceof Player)) return;
    try {
      const st = getSettings(player);
      if (!st.deathWaypoints) return;
      const l = player.location;
      const list = getWaypoints(player);
      for (let i = list.length - 1; i >= 0; i--) if (list[i].type === "death") list.splice(i, 1);
      saveWaypoints(player);
      const wp = addWaypoint(player, {
        name: t(st.lang, "wp_death_name"),
        x: Math.floor(l.x),
        y: Math.floor(l.y),
        z: Math.floor(l.z),
        dim: player.dimension.id,
        color: 0,
        type: "death",
      });
      if (wp) player.sendMessage(t(st.lang, "wp_death_msg", `${wp.x} ${wp.y} ${wp.z}`));
    } catch (e) {
      console.warn(`[minimap] death waypoint failed: ${e}`);
    }
  },
  { entityTypes: ["minecraft:player"] }
);

world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  const player = ev.player;
  const st = getSettings(player);
  state(player).last = "";
  player.sendMessage(t(st.lang, "welcome"));
  try {
    if (!player.getDynamicProperty(GOT_ITEM_KEY)) {
      const inv = player.getComponent("minecraft:inventory");
      inv?.container?.addItem(new ItemStack(ITEM_ID, 1));
      player.setDynamicProperty(GOT_ITEM_KEY, true);
    }
  } catch (e) {
    console.warn(`[minimap] could not give item: ${e}`);
  }
});

world.afterEvents.playerLeave.subscribe((ev) => {
  runtime.delete(ev.playerId);
  forgetPlayer(ev.playerId);
});

// ---------------------------------------------------------------- commands

function playerOnly(origin, fn) {
  const p = origin.sourceEntity ?? origin.initiator;
  if (!(p instanceof Player)) return { status: CustomCommandStatus.Failure, message: "Only players can use this." };
  system.run(() => fn(p));
  return { status: CustomCommandStatus.Success };
}

system.beforeEvents.startup.subscribe(({ customCommandRegistry: reg }) => {
  const any = CommandPermissionLevel.Any;
  reg.registerCommand(
    { name: "minimap:menu", description: "Open the minimap menu", permissionLevel: any },
    (o) => playerOnly(o, (p) => openMainMenu(p))
  );
  reg.registerCommand(
    { name: "minimap:settings", description: "Open the minimap settings", permissionLevel: any },
    (o) => playerOnly(o, (p) => openSettings(p))
  );
  reg.registerCommand(
    { name: "minimap:waypoints", description: "Open the waypoint list", permissionLevel: any },
    (o) => playerOnly(o, (p) => openWaypointList(p))
  );
  reg.registerCommand(
    { name: "minimap:toggle", description: "Show / hide the minimap", permissionLevel: any },
    (o) =>
      playerOnly(o, (p) => {
        const st = getSettings(p);
        st.enabled = !st.enabled;
        saveSettings(p);
      })
  );
  reg.registerCommand(
    { name: "minimap:large", description: "Open / close the large map", permissionLevel: any },
    (o) =>
      playerOnly(o, (p) => {
        const st = getSettings(p);
        st.large = !st.large;
      })
  );
  reg.registerCommand(
    {
      name: "minimap:zoom",
      description: "Set zoom in blocks per cell (1, 2, 4, 8, 16); without value: zoom out",
      permissionLevel: any,
      optionalParameters: [{ name: "blocks", type: CustomCommandParamType.Integer }],
    },
    (o, blocks) =>
      playerOnly(o, (p) => {
        if (blocks === undefined) return changeZoom(p, 1);
        const st = getSettings(p);
        const z = ZOOMS.reduce((a, b) => (Math.abs(b - blocks) < Math.abs(a - blocks) ? b : a));
        if (st.large) st.largeZoom = z;
        else st.zoom = z;
        saveSettings(p);
        p.onScreenDisplay.setActionBar(t(st.lang, "zoom_msg", z));
      })
  );
  reg.registerCommand(
    {
      name: "minimap:waypoint",
      description: "Add a waypoint at your position",
      permissionLevel: any,
      optionalParameters: [{ name: "name", type: CustomCommandParamType.String }],
    },
    (o, name) => playerOnly(o, (p) => addHere(p, name))
  );
});
