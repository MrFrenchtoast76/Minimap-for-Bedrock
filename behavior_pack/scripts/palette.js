// Shared palette definition.
// This file is imported both by the in-game script AND by tools/generate.js,
// which bakes the colours into the glyph font (resource_pack/font/glyph_E1.png).
// It must therefore not import anything from @minecraft/*.
//
// Glyph page U+E100..U+E1FF : terrain colours. index = base * 4 + shade
// Glyph page U+E200..U+E2FF : icons (player arrow, entity dots, waypoints, ...)

export const MAP_PAGE = 0xe100;
export const ICON_PAGE = 0xe200;

// Brightness multipliers per shade (like vanilla map colours).
// 0 = lower than north neighbour, 1 = flat, 2 = higher, 3 = steep drop.
export const SHADES = [0.71, 0.86, 1.0, 0.53];

// Max 64 entries (64 * 4 shades = 256 glyphs).
export const BASE_COLORS = [
  ["void", [14, 14, 18]],
  ["grass", [118, 178, 66]],
  ["sand", [247, 233, 163]],
  ["wool", [199, 199, 199]],
  ["lava", [230, 100, 20]],
  ["ice", [160, 160, 255]],
  ["metal", [167, 167, 167]],
  ["plant", [0, 124, 0]],
  ["snow", [255, 255, 255]],
  ["clay", [164, 168, 184]],
  ["dirt", [151, 109, 77]],
  ["stone", [112, 112, 112]],
  ["water", [52, 82, 230]],
  ["wood", [143, 119, 72]],
  ["quartz", [255, 252, 245]],
  ["orange", [216, 127, 51]],
  ["magenta", [178, 76, 216]],
  ["light_blue", [102, 153, 216]],
  ["yellow", [229, 229, 51]],
  ["lime", [127, 204, 25]],
  ["pink", [242, 127, 165]],
  ["gray", [76, 76, 76]],
  ["light_gray", [153, 153, 153]],
  ["cyan", [76, 127, 153]],
  ["purple", [127, 63, 178]],
  ["blue", [51, 76, 178]],
  ["brown", [102, 76, 51]],
  ["green", [102, 127, 51]],
  ["red", [153, 51, 51]],
  ["black", [25, 25, 25]],
  ["gold", [250, 238, 77]],
  ["diamond", [92, 219, 213]],
  ["lapis", [74, 128, 255]],
  ["emerald", [0, 217, 58]],
  ["podzol", [129, 86, 49]],
  ["nether", [112, 2, 0]],
  ["terracotta_white", [209, 177, 161]],
  ["terracotta_orange", [159, 82, 36]],
  ["terracotta_magenta", [149, 87, 108]],
  ["terracotta_light_blue", [112, 108, 138]],
  ["terracotta_yellow", [186, 133, 36]],
  ["terracotta_lime", [103, 117, 53]],
  ["terracotta_pink", [160, 77, 78]],
  ["terracotta_gray", [57, 41, 35]],
  ["terracotta_light_gray", [135, 107, 98]],
  ["terracotta_cyan", [87, 92, 92]],
  ["terracotta_purple", [122, 73, 88]],
  ["terracotta_blue", [76, 62, 92]],
  ["terracotta_brown", [76, 50, 35]],
  ["terracotta_green", [76, 82, 42]],
  ["terracotta_red", [142, 60, 46]],
  ["terracotta_black", [37, 22, 16]],
  ["crimson_nylium", [189, 48, 49]],
  ["crimson_stem", [148, 63, 97]],
  ["crimson_hyphae", [92, 25, 29]],
  ["warped_nylium", [22, 126, 134]],
  ["warped_stem", [58, 142, 140]],
  ["warped_hyphae", [86, 44, 62]],
  ["warped_wart", [20, 180, 133]],
  ["deepslate", [90, 90, 96]],
  ["raw_iron", [216, 175, 147]],
  ["glow_lichen", [127, 167, 150]],
  ["leaves_dark", [38, 96, 22]],
  ["path", [148, 122, 65]],
];

export const BASE = Object.fromEntries(BASE_COLORS.map(([name], i) => [name, i]));

// Icon glyph indices on page U+E2xx.
export const ICON = {
  ARROW: 0, // 0..15 : player arrow, 16 directions clockwise from north
  PLAYER: 16,
  HOSTILE: 17,
  PASSIVE: 18,
  NEUTRAL: 19,
  DEATH: 20,
  NORTH: 21,
  WAYPOINT: 32, // 32..47 : waypoint markers in 16 colours
};

export const WAYPOINT_COLORS = [
  ["red", [230, 40, 40], "§c"],
  ["gold", [255, 170, 0], "§6"],
  ["yellow", [255, 235, 60], "§e"],
  ["lime", [100, 240, 60], "§a"],
  ["green", [20, 140, 40], "§2"],
  ["aqua", [60, 230, 230], "§b"],
  ["cyan", [20, 150, 160], "§3"],
  ["blue", [60, 90, 255], "§9"],
  ["dark_blue", [30, 30, 170], "§1"],
  ["purple", [170, 60, 230], "§5"],
  ["pink", [255, 110, 220], "§d"],
  ["white", [250, 250, 250], "§f"],
  ["gray", [150, 150, 150], "§7"],
  ["dark_gray", [80, 80, 80], "§8"],
  ["brown", [140, 90, 50], "§6"],
  ["black", [20, 20, 20], "§0"],
];

// Markers that prefix the title string; the JSON UI in the resource pack
// filters on them (see tools/generate.js -> hud_screen.json).
export const MARKERS = {
  TR: "MINIMAP_TR:",
  TL: "MINIMAP_TL:",
  LARGE: "MINIMAP_LG:",
  OFF: "MINIMAP_OFF:",
};
