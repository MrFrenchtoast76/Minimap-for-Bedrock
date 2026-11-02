// Generates every binary/derived asset of the resource pack from palette.js:
//   resource_pack/font/glyph_E1.png        terrain colour glyphs (64 colours x 4 shades)
//   resource_pack/font/glyph_E2.png        icons (arrows, entity dots, waypoints, ...)
//   resource_pack/textures/items/minimap.png
//   resource_pack/textures/ui/minimap_bg.png
//   resource_pack/ui/hud_screen.json       HUD layout that displays the map
//   */pack_icon.png
// Usage: node tools/generate.js   (no dependencies needed)
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import {
  BASE_COLORS,
  SHADES,
  ICON,
  WAYPOINT_COLORS,
  MARKERS,
} from "../behavior_pack/scripts/palette.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RP = path.join(ROOT, "resource_pack");
const BP = path.join(ROOT, "behavior_pack");

// ------------------------------------------------------------------ PNG

function crc32(buf) {
  if (zlib.crc32) return zlib.crc32(buf) >>> 0;
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

class Image {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }
  set(x, y, [r, g, b], a = 255) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }
  fill(x0, y0, w, h, rgb, a = 255) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, rgb, a);
  }
  toPNG() {
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 4 + 1)] = 0;
      Buffer.from(this.data.buffer, y * this.w * 4, this.w * 4).copy(raw, y * (this.w * 4 + 1) + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
  save(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, this.toPNG());
    console.log("wrote", path.relative(ROOT, file));
  }
}

const shade = ([r, g, b], f) => [Math.round(r * f), Math.round(g * f), Math.round(b * f)];

// ------------------------------------------------------------------ glyph helpers

const CELL = 16;
const BG = [38, 38, 42];
const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];

/** Rasterise a mask (fn(x,y) in cell-local coords centred at 0) with 4x4 supersampling. */
function mask(fn) {
  const m = new Float32Array(CELL * CELL);
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      let n = 0;
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) if (fn(x + (sx + 0.5) / 4 - CELL / 2, y + (sy + 0.5) / 4 - CELL / 2)) n++;
      m[y * CELL + x] = n / 16;
    }
  return m;
}

function inPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Draw a shape with fill colour + 1px dark outline on an opaque background into a cell. */
function drawShape(img, cellIndex, m, fill, bg = BG, outline = BLACK) {
  const ox = (cellIndex % 16) * CELL;
  const oy = Math.floor(cellIndex / 16) * CELL;
  const solid = (x, y) => x >= 0 && y >= 0 && x < CELL && y < CELL && m[y * CELL + x] >= 0.4;
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      let c = bg;
      if (solid(x, y)) c = fill;
      else if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) c = outline;
      img.set(ox + x, oy + y, c);
    }
}

// ------------------------------------------------------------------ glyph_E1 (terrain)

function terrainSheet() {
  const img = new Image(256, 256);
  if (BASE_COLORS.length > 64) throw new Error("max 64 base colours");
  BASE_COLORS.forEach(([, rgb], base) => {
    SHADES.forEach((f, s) => {
      const i = base * 4 + s;
      img.fill((i % 16) * CELL, Math.floor(i / 16) * CELL, CELL, CELL, shade(rgb, f));
    });
  });
  img.save(path.join(RP, "font/glyph_E1.png"));
}

// ------------------------------------------------------------------ glyph_E2 (icons)

const LETTER_N = ["10001", "11001", "10101", "10011", "10001", "10001", "10001"];

function iconSheet() {
  const img = new Image(256, 256);
  // player arrows, 16 directions
  const arrow = [
    [0, -7],
    [5.5, 6],
    [0, 2.5],
    [-5.5, 6],
  ];
  for (let d = 0; d < 16; d++) {
    const a = (d * 22.5 * Math.PI) / 180;
    const pts = arrow.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
    drawShape(img, ICON.ARROW + d, mask((x, y) => inPoly(pts, x, y)), WHITE, BG, [200, 30, 30]);
  }
  const dot = mask((x, y) => x * x + y * y <= 25);
  drawShape(img, ICON.PLAYER, dot, WHITE);
  drawShape(img, ICON.HOSTILE, dot, [235, 40, 40]);
  drawShape(img, ICON.PASSIVE, dot, [90, 230, 70]);
  drawShape(img, ICON.NEUTRAL, dot, [240, 220, 60]);
  // death: white cross on dark red
  drawShape(
    img,
    ICON.DEATH,
    mask((x, y) => Math.abs(x - y) < 1.8 || Math.abs(x + y) < 1.8),
    WHITE,
    [110, 10, 10],
    [60, 0, 0]
  );
  // north marker "N"
  drawShape(
    img,
    ICON.NORTH,
    mask((x, y) => {
      const cx = Math.floor((x + 5) / 2);
      const cy = Math.floor((y + 7) / 2);
      return cx >= 0 && cx < 5 && cy >= 0 && cy < 7 && LETTER_N[cy][cx] === "1";
    }),
    WHITE,
    [150, 20, 20],
    [90, 0, 0]
  );
  // waypoints: coloured square with white frame
  WAYPOINT_COLORS.forEach(([, rgb], i) => {
    const idx = ICON.WAYPOINT + i;
    const ox = (idx % 16) * CELL;
    const oy = Math.floor(idx / 16) * CELL;
    img.fill(ox, oy, CELL, CELL, BLACK);
    img.fill(ox + 1, oy + 1, CELL - 2, CELL - 2, WHITE);
    img.fill(ox + 3, oy + 3, CELL - 6, CELL - 6, rgb);
  });
  img.save(path.join(RP, "font/glyph_E2.png"));
}

// ------------------------------------------------------------------ textures

function mapPicture(img, ox, oy, size, scale) {
  // small fake landscape used by the item texture and pack icons
  const P = Object.fromEntries(BASE_COLORS.map(([n, c]) => [n, c]));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const v = Math.sin(nx * 7.1 + 1) + Math.cos(ny * 6.3 + 0.5) + Math.sin((nx + ny) * 9.7);
      let c = v < -0.9 ? P.water : v < -0.6 ? P.sand : v < 0.9 ? P.grass : v < 1.6 ? P.plant : P.stone;
      if ((x + y) % 3 === 0) c = shade(c, 0.9);
      img.fill(ox + x * scale, oy + y * scale, scale, scale, c);
    }
}

function itemTexture() {
  const img = new Image(16, 16);
  img.fill(0, 0, 16, 16, [92, 64, 40]);
  img.fill(1, 1, 14, 14, [214, 196, 150]);
  mapPicture(img, 2, 2, 12, 1);
  // red arrow in the middle
  for (const [x, y] of [[7, 5], [8, 5], [6, 6], [7, 6], [8, 6], [9, 6], [7, 7], [8, 7], [7, 8], [8, 8]])
    img.set(x, y, [220, 30, 30]);
  img.save(path.join(RP, "textures/items/minimap.png"));
}

function packIcon(file) {
  const img = new Image(64, 64);
  img.fill(0, 0, 64, 64, [40, 30, 22]);
  img.fill(3, 3, 58, 58, [214, 196, 150]);
  mapPicture(img, 6, 6, 26, 2);
  // arrow
  const pts = [[32, 18], [42, 44], [32, 37], [22, 44]];
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      if (inPoly(pts, x + 0.5, y + 0.5)) img.set(x, y, WHITE);
      else if (
        inPoly(pts, x + 1.5, y + 0.5) ||
        inPoly(pts, x - 0.5, y + 0.5) ||
        inPoly(pts, x + 0.5, y + 1.5) ||
        inPoly(pts, x + 0.5, y - 0.5)
      )
        img.set(x, y, [200, 30, 30]);
    }
  img.save(file);
}

function uiBackground() {
  const img = new Image(8, 8);
  img.fill(0, 0, 8, 8, [0, 0, 0], 150);
  img.save(path.join(RP, "textures/ui/minimap_bg.png"));
}

// ------------------------------------------------------------------ hud_screen.json

function hudScreen() {
  const has = (marker) => `(not ((#hud_title_text_string - '${marker}') = #hud_title_text_string))`;

  const mapPanel = (marker, anchor, offset, infoAnchor) => ({
    type: "stack_panel",
    orientation: "vertical",
    anchor_from: anchor,
    anchor_to: anchor,
    offset,
    size: ["100%cm", "100%c"],
    layer: 30,
    bindings: [
      { binding_name: "#hud_title_text_string" },
      { binding_type: "view", source_property_name: has(marker), target_property_name: "#visible" },
    ],
    controls: [
      {
        map_frame: {
          type: "image",
          texture: "textures/ui/minimap_bg",
          anchor_from: infoAnchor,
          anchor_to: infoAnchor,
          size: ["100%c + 4px", "100%c + 4px"],
          controls: [
            {
              map_text: {
                type: "label",
                anchor_from: "center",
                anchor_to: "center",
                size: ["default", "default"],
                text: "#text",
                color: [1, 1, 1],
                shadow: false,
                font_scale_factor: 0.5,
                text_alignment: "left",
                layer: 1,
                bindings: [
                  { binding_name: "#hud_title_text_string" },
                  {
                    binding_type: "view",
                    source_property_name: `(#hud_title_text_string - '${marker}')`,
                    target_property_name: "#text",
                  },
                ],
              },
            },
          ],
        },
      },
      {
        info_text: {
          type: "label",
          anchor_from: infoAnchor,
          anchor_to: infoAnchor,
          size: ["default", "default"],
          text: "#text",
          color: [1, 1, 1],
          shadow: true,
          font_scale_factor: 0.8,
          text_alignment: infoAnchor === "top_right" ? "right" : infoAnchor === "top_left" ? "left" : "center",
          bindings: [
            { binding_name: "#hud_subtitle_text_string" },
            {
              binding_type: "view",
              source_property_name: "#hud_subtitle_text_string",
              target_property_name: "#text",
            },
          ],
        },
      },
    ],
  });

  const ui = {
    namespace: "hud",

    // Hide the vanilla title while it carries minimap data.
    hud_title_text: {
      bindings: [
        { binding_name: "#hud_title_text_string" },
        {
          binding_type: "view",
          source_property_name: "((#hud_title_text_string - 'MINIMAP_') = #hud_title_text_string)",
          target_property_name: "#visible",
        },
      ],
    },

    minimap_top_right: mapPanel(MARKERS.TR, "top_right", [-3, 3], "top_right"),
    minimap_top_left: mapPanel(MARKERS.TL, "top_left", [3, 3], "top_left"),
    minimap_large: mapPanel(MARKERS.LARGE, "center", [0, 0], "top_middle"),

    minimap_root: {
      type: "panel",
      size: ["100%", "100%"],
      layer: 30,
      controls: [
        { "minimap_tr@hud.minimap_top_right": {} },
        { "minimap_tl@hud.minimap_top_left": {} },
        { "minimap_lg@hud.minimap_large": {} },
      ],
    },

    root_panel: {
      modifications: [
        {
          array_name: "controls",
          operation: "insert_back",
          value: [{ "minimap_root@hud.minimap_root": {} }],
        },
      ],
    },
  };
  const file = path.join(RP, "ui/hud_screen.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ui, null, 2) + "\n");
  console.log("wrote", path.relative(ROOT, file));
}

terrainSheet();
iconSheet();
itemTexture();
uiBackground();
packIcon(path.join(RP, "pack_icon.png"));
packIcon(path.join(BP, "pack_icon.png"));
hudScreen();
