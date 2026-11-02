// Maps block type ids to base colour indices of the palette.
// Exact matches first, then keyword rules; results are memoised.
import { BASE } from "./palette.js";

const B = BASE;

const EXACT = {
  grass_block: B.grass,
  grass: B.grass,
  dirt: B.dirt,
  coarse_dirt: B.dirt,
  rooted_dirt: B.dirt,
  farmland: B.dirt,
  dirt_with_roots: B.dirt,
  grass_path: B.path,
  dirt_path: B.path,
  podzol: B.podzol,
  mycelium: B.purple,
  mud: B.terracotta_cyan,
  muddy_mangrove_roots: B.terracotta_brown,
  sand: B.sand,
  suspicious_sand: B.sand,
  red_sand: B.orange,
  gravel: B.light_gray,
  suspicious_gravel: B.light_gray,
  clay: B.clay,
  snow: B.snow,
  snow_layer: B.snow,
  powder_snow: B.snow,
  ice: B.ice,
  packed_ice: B.ice,
  blue_ice: B.ice,
  frosted_ice: B.ice,
  water: B.water,
  flowing_water: B.water,
  bubble_column: B.water,
  lava: B.lava,
  flowing_lava: B.lava,
  magma: B.nether,
  netherrack: B.nether,
  nether_wart_block: B.red,
  warped_wart_block: B.warped_wart,
  crimson_nylium: B.crimson_nylium,
  warped_nylium: B.warped_nylium,
  soul_sand: B.brown,
  soul_soil: B.brown,
  glowstone: B.sand,
  shroomlight: B.orange,
  bedrock: B.gray,
  obsidian: B.black,
  crying_obsidian: B.purple,
  end_stone: B.sand,
  end_stone_bricks: B.sand,
  chorus_plant: B.purple,
  chorus_flower: B.purple,
  purpur_block: B.magenta,
  calcite: B.terracotta_white,
  dripstone_block: B.terracotta_brown,
  pointed_dripstone: B.terracotta_brown,
  moss_block: B.green,
  moss_carpet: B.green,
  pale_moss_block: B.light_gray,
  pale_moss_carpet: B.light_gray,
  sculk: B.cyan,
  amethyst_block: B.purple,
  budding_amethyst: B.purple,
  coal_block: B.black,
  iron_block: B.metal,
  gold_block: B.gold,
  diamond_block: B.diamond,
  emerald_block: B.emerald,
  lapis_block: B.lapis,
  redstone_block: B.red,
  netherite_block: B.black,
  raw_iron_block: B.raw_iron,
  raw_gold_block: B.gold,
  raw_copper_block: B.orange,
  hay_block: B.yellow,
  melon_block: B.lime,
  pumpkin: B.orange,
  carved_pumpkin: B.orange,
  lit_pumpkin: B.orange,
  cactus: B.plant,
  waterlily: B.plant,
  lily_pad: B.plant,
  bamboo: B.plant,
  reeds: B.plant,
  sugar_cane: B.plant,
  glass: B.quartz,
  glass_pane: B.quartz,
  tinted_glass: B.gray,
  bookshelf: B.wood,
  crafting_table: B.wood,
  chest: B.wood,
  barrel: B.wood,
  tnt: B.red,
  slime: B.lime,
  honey_block: B.orange,
  sponge: B.yellow,
  wet_sponge: B.yellow,
  bone_block: B.sand,
  glow_lichen: B.glow_lichen,
  sea_lantern: B.quartz,
  prismarine: B.diamond,
  dark_prismarine: B.diamond,
  prismarine_bricks: B.diamond,
  tuff: B.terracotta_gray,
  basalt: B.gray,
  polished_basalt: B.gray,
  smooth_basalt: B.black,
  blackstone: B.black,
  hardened_clay: B.terracotta_orange,
  terracotta: B.terracotta_orange,
  quartz_block: B.quartz,
  cobweb: B.wool,
  web: B.wool,
  web_block: B.wool,
};

const COLOR_NAMES = [
  "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
  "light_gray", "silver", "cyan", "purple", "blue", "brown", "green", "red", "black",
];
const COLOR_TO_BASE = {
  white: B.snow, orange: B.orange, magenta: B.magenta, light_blue: B.light_blue,
  yellow: B.yellow, lime: B.lime, pink: B.pink, gray: B.gray, light_gray: B.light_gray,
  silver: B.light_gray, cyan: B.cyan, purple: B.purple, blue: B.blue, brown: B.brown,
  green: B.green, red: B.red, black: B.black,
};
const COLOR_TO_TERRACOTTA = {
  white: B.terracotta_white, orange: B.terracotta_orange, magenta: B.terracotta_magenta,
  light_blue: B.terracotta_light_blue, yellow: B.terracotta_yellow, lime: B.terracotta_lime,
  pink: B.terracotta_pink, gray: B.terracotta_gray, light_gray: B.terracotta_light_gray,
  silver: B.terracotta_light_gray, cyan: B.terracotta_cyan, purple: B.terracotta_purple,
  blue: B.terracotta_blue, brown: B.terracotta_brown, green: B.terracotta_green,
  red: B.terracotta_red, black: B.terracotta_black,
};

const WOOD_TYPES = [
  ["dark_oak", B.brown],
  ["pale_oak", B.terracotta_white],
  ["oak", B.wood],
  ["spruce", B.podzol],
  ["birch", B.sand],
  ["jungle", B.dirt],
  ["acacia", B.orange],
  ["mangrove", B.red],
  ["cherry", B.terracotta_white],
  ["bamboo", B.yellow],
  ["crimson", B.crimson_stem],
  ["warped", B.warped_stem],
];

const PLANT_RE =
  /(short_grass|tall_grass|fern|flower|tulip|poppy|dandelion|orchid|allium|azure|daisy|cornflower|lily|rose|peony|lilac|bush|sapling|vine|kelp|seagrass|sea_pickle|wheat|carrots|potatoes|beetroot|stem|sweet_berry|dripleaf|spore_blossom|hanging_roots|azalea|propagule|mushroom|fungus|roots|sprouts|torchflower|pitcher|cocoa|leaf_litter|firefly)/;

const memo = new Map();

function strip(id) {
  const i = id.indexOf(":");
  return i >= 0 ? id.slice(i + 1) : id;
}

function woodColor(name) {
  for (const [w, c] of WOOD_TYPES) if (name.includes(w)) return c;
  return undefined;
}

function compute(typeId) {
  const name = strip(typeId);
  if (name in EXACT) return EXACT[name];

  if (name.includes("water")) return B.water;
  if (name.includes("lava")) return B.lava;

  if (name.includes("leaves")) {
    if (name.includes("cherry")) return B.pink;
    if (name.includes("spruce") || name.includes("dark_oak") || name.includes("mangrove")) return B.leaves_dark;
    if (name.includes("birch")) return B.lime;
    if (name.includes("pale_oak")) return B.light_gray;
    if (name.includes("azalea")) return B.green;
    return B.plant;
  }

  if (/(_log|_wood|_stem|_hyphae|planks|_slab|_stairs|_fence|_door|_trapdoor|_sign|_button|_pressure_plate|bamboo_block|bamboo_mosaic)/.test(name)) {
    const w = woodColor(name);
    if (w !== undefined && !/stone|brick|copper|iron|quartz|purpur|blackstone|deepslate|tuff/.test(name)) return w;
  }

  if (PLANT_RE.test(name)) {
    if (name.includes("crimson")) return B.crimson_nylium;
    if (name.includes("warped")) return B.warped_wart;
    if (name.includes("red_mushroom")) return B.red;
    if (name.includes("brown_mushroom")) return B.brown;
    return B.plant;
  }

  if (name.includes("red_sandstone")) return B.orange;
  if (name.includes("red_nether_brick")) return B.nether;

  // Coloured blocks (wool, concrete, terracotta, glass, carpet, beds, ...)
  for (const c of COLOR_NAMES) {
    if (name.startsWith(c + "_")) {
      if (name.includes("terracotta")) return COLOR_TO_TERRACOTTA[c];
      return COLOR_TO_BASE[c];
    }
  }

  if (name.includes("ore")) return name.includes("deepslate") ? B.deepslate : name.includes("nether") ? B.nether : B.stone;
  if (name.includes("deepslate")) return B.deepslate;
  if (name.includes("copper")) {
    if (name.includes("oxidized")) return B.warped_stem;
    if (name.includes("weathered")) return B.cyan;
    if (name.includes("exposed")) return B.terracotta_light_gray;
    return B.orange;
  }
  if (name.includes("blackstone")) return B.black;
  if (name.includes("nether_brick")) return B.nether;
  if (name.includes("mossy")) return B.green;
  if (name.includes("diorite") || name.includes("quartz")) return B.quartz;
  if (name.includes("granite")) return B.dirt;
  if (name.includes("tuff")) return B.terracotta_gray;
  if (name.includes("prismarine")) return B.diamond;
  if (name.includes("red_sandstone")) return B.orange;
  if (name.includes("sandstone")) return B.sand;
  if (name.includes("mud_brick")) return B.terracotta_light_gray;
  if (name.includes("brick")) return name.includes("stone") ? B.stone : B.red;
  if (name.includes("purpur")) return B.magenta;
  if (name.includes("end_")) return B.sand;
  if (name.includes("terracotta")) return B.terracotta_orange;
  if (name.includes("glass")) return B.quartz;
  if (name.includes("snow")) return B.snow;
  if (name.includes("ice")) return B.ice;
  if (name.includes("sand")) return B.sand;
  if (name.includes("rail")) return B.metal;
  if (name.includes("iron")) return B.metal;
  if (name.includes("gold")) return B.gold;
  if (name.includes("amethyst")) return B.purple;
  if (name.includes("sculk")) return B.cyan;
  if (name.includes("wool") || name.includes("carpet")) return B.wool;
  if (name.includes("concrete")) return B.light_gray;
  if (name.includes("stone") || name.includes("cobble") || name.includes("andesite")) return B.stone;
  if (name.includes("torch") || name.includes("lantern") || name.includes("campfire")) return B.orange;
  return B.stone;
}

/** Returns the palette base colour index for a block type id. */
export function blockColor(typeId) {
  let c = memo.get(typeId);
  if (c === undefined) {
    c = compute(typeId);
    memo.set(typeId, c);
  }
  return c;
}

export function isWater(typeId) {
  return typeId.includes("water") || typeId === "minecraft:bubble_column";
}
