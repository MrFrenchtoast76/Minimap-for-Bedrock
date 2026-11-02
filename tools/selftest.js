// Offline test of the renderer against a fake world.
// Usage: node tools/selftest.js [preview.png]
import { register } from "node:module";
import fs from "node:fs";
import zlib from "node:zlib";
register("./mock/hooks.js", import.meta.url);

const { render } = await import("../behavior_pack/scripts/renderer.js");
const { beginTick } = await import("../behavior_pack/scripts/terrain.js");
const { getSettings, addWaypoint } = await import("../behavior_pack/scripts/settings.js");
const { blockColor } = await import("../behavior_pack/scripts/blockColors.js");
const { BASE_COLORS, SHADES, MAP_PAGE, ICON_PAGE, BASE } = await import("../behavior_pack/scripts/palette.js");

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error("FAIL:", msg); } else console.log("ok  ", msg); };

// --- block colours
check(blockColor("minecraft:grass_block") === BASE.grass, "grass_block -> grass");
check(blockColor("minecraft:water") === BASE.water, "water -> water");
check(blockColor("minecraft:oak_leaves") === BASE.plant, "oak_leaves -> plant");
check(blockColor("minecraft:red_wool") === BASE.red, "red_wool -> red");
check(blockColor("minecraft:blue_terracotta") === BASE.terracotta_blue, "blue_terracotta");
check(blockColor("minecraft:red_sandstone") === BASE.orange, "red_sandstone -> orange");
check(blockColor("minecraft:spruce_planks") === BASE.podzol, "spruce_planks -> podzol");
check(blockColor("minecraft:deepslate_iron_ore") === BASE.deepslate, "deepslate ore");
check(blockColor("minecraft:white_tulip") === BASE.plant, "white_tulip -> plant");

// --- fake world: hills, a lake, a river
function heightAt(x, z) {
  return Math.round(64 + 6 * Math.sin(x / 9) + 5 * Math.cos(z / 7));
}
function blockAt(x, y, z) {
  const h = heightAt(x, z);
  const lake = (x - 8) ** 2 + (z + 6) ** 2 < 40;
  if (lake && y <= 62 && y > h - 4) return "minecraft:water";
  if (y > h) return "minecraft:air";
  if (y === h) return h > 69 ? "minecraft:stone" : Math.abs(x - z) < 2 ? "minecraft:sand" : "minecraft:grass_block";
  return "minecraft:dirt";
}
let calls = 0;
const mkBlock = (x, y, z) => {
  const typeId = blockAt(x, y, z);
  return { typeId, location: { x, y, z }, isAir: typeId === "minecraft:air", isWaterlogged: false };
};
const dim = {
  id: "minecraft:overworld",
  heightRange: { min: -64, max: 320 },
  getTopmostBlock({ x, z }) {
    calls++;
    for (let y = 80; y > 0; y--) if (blockAt(x, y, z) !== "minecraft:air") return mkBlock(x, y, z);
  },
  getBlock({ x, y, z }) { calls++; return mkBlock(x, y, z); },
  getEntities() {
    return [
      { id: "z1", typeId: "minecraft:zombie", location: { x: 5, y: 64, z: 3 },
        getComponent: (c) => c === "minecraft:health" ? {} : { hasTypeFamily: (f) => f === "monster" } },
      { id: "c1", typeId: "minecraft:cow", location: { x: -4, y: 64, z: -2 },
        getComponent: (c) => c === "minecraft:health" ? {} : { hasTypeFamily: () => false } },
    ];
  },
  getBiome: () => ({ id: "minecraft:plains" }),
};
const store = {};
const player = {
  id: "p1", name: "Tester", dimension: dim,
  location: { x: 0.5, y: 66, z: 0.5 },
  getRotation: () => ({ x: 0, y: 135 }),
  getDynamicProperty: (k) => store[k],
  setDynamicProperty: (k, v) => { store[k] = v; },
};

const st = getSettings(player);
st.showTime = true;
addWaypoint(player, { name: "Home", x: 10, y: 64, z: -8, dim: "minecraft:overworld", color: 2 });
addWaypoint(player, { name: "Far", x: 400, y: 64, z: 300, dim: "minecraft:overworld", color: 7 });
st.tracked = "";

let out;
for (let tick = 1; tick <= 20; tick++) {
  beginTick(tick, 900, 50);
  out = render(player, st, st.size, st.size, st.zoom);
}
const rows = out.map.split("\n");
check(rows.length === st.size, `map has ${st.size} rows`);
check(rows.every((r) => [...r].length === st.size), `every row has ${st.size} glyphs`);
const chars = [...out.map.replace(/\n/g, "")];
check(chars.every((c) => { const p = c.codePointAt(0); return p >= MAP_PAGE && p < ICON_PAGE + 256; }), "only glyph-page characters");
check(chars.filter((c) => c.codePointAt(0) === MAP_PAGE + BASE.void * 4 + 1).length === 0, "all columns scanned (no void cells)");
check(out.info.replace(/§./g, "").includes("0 / 66 / 0"), "info contains coordinates");
console.log("info:\n" + out.info.replace(/§./g, ""));
console.log("block lookups:", calls);

st.rotate = true;
beginTick(21, 900, 50);
const rot = render(player, st, st.size, st.size, st.zoom);
check(rot.map.split("\n").length === st.size, "rotated map renders");

// --- optional PNG preview
const file = process.argv[2];
if (file) {
  const colorOf = (cp) => {
    if (cp >= MAP_PAGE && cp < MAP_PAGE + 256) {
      const i = cp - MAP_PAGE;
      const [, rgb] = BASE_COLORS[i >> 2];
      return rgb.map((v) => Math.round(v * SHADES[i & 3]));
    }
    const i = cp - ICON_PAGE;
    if (i < 16) return [255, 255, 255];
    if (i === 17) return [235, 40, 40];
    if (i === 18) return [90, 230, 70];
    if (i >= 32) return [255, 0, 255];
    return [255, 255, 0];
  };
  const S = 8;
  const draw = (map, ox, img, W) => map.split("\n").forEach((r, y) => [...r].forEach((c, x) => {
    const rgb = colorOf(c.codePointAt(0));
    for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) {
      const i = ((y * S + yy) * W + ox + x * S + xx) * 3;
      img[i] = rgb[0]; img[i + 1] = rgb[1]; img[i + 2] = rgb[2];
    }
  }));
  const W = st.size * S * 2 + S, H = st.size * S;
  const img = Buffer.alloc(W * H * 3);
  draw(out.map, 0, img, W);
  draw(rot.map, st.size * S + S, img, W);
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) img.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
  console.log("preview written to", file);
}

// main.js / ui.js must at least load (syntax + imports)
await import("../behavior_pack/scripts/ui.js");
await import("../behavior_pack/scripts/main.js");
check(true, "main.js and ui.js load");

if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
console.log("all checks passed");
