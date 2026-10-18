/**
 * 程序化地图生成模块。
 * 根据选定区域的地理配置，生成 15-25 个地点（城镇、村庄、野外、关隘），
 * 自动计算邻居关系（基于地理距离与地形通行性），并为每个地点配置地形、产出、生态。
 */

import {
  RegionConfig,
  TerrainType,
  TERRAIN_NAMES,
  TERRAIN_PRODUCTION,
  TERRAIN_DEFENSE_BONUS,
  TERRAIN_MOVE_COST,
} from "./world_regions";
import { GOODS } from "./data";
import { BANNERLORD_TROOPS } from "./troops_bannerlord";
import { CALRADIA_LOCATIONS } from "./calradia";

/** 生成的地点类型 */
export type LocationType = "village" | "town" | "wild" | "pass" | "port";

export interface GeneratedLocation {
  id: string;
  name: string;
  type: LocationType;
  terrain_type: TerrainType;
  x: number;
  y: number;
  faction_id: string;
  owner: string;
  tax_income: number;
  neighbors: string[];
  market: Record<string, { buy_price: number; sell_price: number }>;
  barracks: string[];
  tavern?: string[];
  arena?: boolean;
  slave_market?: boolean;
  facilities?: string[];
  active_quests?: any[];
  /** 产出商品 */
  production: Record<string, number>;
  /** 消耗商品 */
  consumption: Record<string, number>;
  /** 动态库存 */
  stock: Record<string, number>;
  /** 生态状态 */
  ecology: {
    forest_coverage: number;
    soil_fertility: number;
    water_quality: number;
  };
  /** 关隘防守加成 */
  defense_bonus?: number;
  /** 关隘所属势力 (仅 pass 类型) */
  garrison_power?: number;
  /** 是否为港口 */
  is_port?: boolean;
}

/** 地名前缀和后缀池 */
const LOCATION_PREFIXES: Record<TerrainType, string[]> = {
  plain: ["绿野", "沃土", "丰禾", "广袤", "平川", "金穗", "麦丰"],
  forest: ["密林", "苍松", "翠柏", "幽篁", "莽林", "古榕", "桦皮"],
  mountain: ["峭壁", "苍岩", "铁峰", "雪岭", "盘石", "天险", "高崖"],
  desert: ["黄沙", "烈日", "旱海", "沙丘", "蜃楼", "寂漠"],
  grassland: ["苍原", "碧野", "牧歌", "风驰", "驰星", "芳草", "天苍"],
  river: ["河曲", "渡口", "水湾", "清流", "碧波", "汇川", "溪畔"],
  lake: ["镜湖", "碧潭", "月泽", "星渊", "莲池", "烟波"],
  sea: ["海门", "潮汐", "碧海", "沧波", "浪花", "帆影"],
  hill: ["丘陵", "翠岗", "坡陀", "望峰", "梯田", "矮岭"],
  swamp: ["泥沼", "雾泽", "芦荡", "湿地", "淀泊"],
  tundra: ["冻原", "霜地", "冰原", "寒苔", "极昼"],
  jungle: ["莽莽", "藤萝", "蛇径", "密丛", "蛮荒"],
};

const TOWN_SUFFIXES = ["城", "都", "府", "镇", "州", "邑"];
const VILLAGE_SUFFIXES = ["村", "庄", "屯", "寨", "坊", "坞"];
const WILD_SUFFIXES = ["野", "林", "谷", "原", "窟", "穴"];
const PASS_SUFFIXES = ["关", "隘", "口", "门", "峡"];
const PORT_SUFFIXES = ["港", "浦", "渡", "码头", "泊"];

let _loc_counter = 0;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedTerrain(config: RegionConfig): TerrainType {
  const entries = Object.entries(config.terrain.weights) as [TerrainType, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let rand = Math.random() * total;
  for (const [t, w] of entries) {
    if (rand < w) return t;
    rand -= w;
  }
  return entries[0][0];
}


// === 骑砍2 文化兵种映射：区域文化 → 可招募兵种 ===
const CULTURE_RECRUIT: Record<string, string[]> = {
  // 城镇/港口：完整兵种链（初始兵 + 一级进阶）
  empire: ["imperial_recruit", "imperial_infantryman", "imperial_archer"],
  vlandia: ["vlandian_recruit", "vlandian_footman", "vlandian_levy_crossbowman"],
  aserai: ["aserai_recruit", "aserai_tribesman"],
  battania: ["battanian_volunteer", "battanian_clanwarrior", "battanian_woodrunner"],
  khuzait: ["khuzait_nomad", "khuzait_footman", "khuzait_tribal_warrior"],
  sturgia: ["sturgian_recruit", "sturgian_warrior", "sturgian_woodsman"],
};
// 村庄/野外：只招最基础兵
const VILLAGE_RECRUIT: Record<string, string[]> = {
  empire: ["imperial_recruit"],
  vlandia: ["vlandian_recruit"],
  aserai: ["aserai_recruit"],
  battania: ["battanian_volunteer"],
  khuzait: ["khuzait_nomad"],
  sturgia: ["sturgian_recruit"],
};
// 区域 id → 文化（与 REGION_CULTURE 对齐）
function cultureForRegion(region: any): string {
  const id = region?.id || "";
  const map: Record<string, string> = {
    central_plains: "empire", persia: "aserai", nile_valley: "aserai", frankia: "vlandia",
    mongol_steppe: "khuzait", arabia: "aserai", anatolia: "empire", indus_valley: "aserai",
    sahel: "aserai", russia: "sturgia", iberia: "vlandia", scandinavia: "sturgia",
  };
  return map[id] || "empire";
}

function generateName(terrain: TerrainType, type: LocationType): string {
  const prefixes = LOCATION_PREFIXES[terrain] ?? LOCATION_PREFIXES.plain;
  const prefix = randomChoice(prefixes);
  let suffix: string;
  if (type === "town") suffix = randomChoice(TOWN_SUFFIXES);
  else if (type === "village") suffix = randomChoice(VILLAGE_SUFFIXES);
  else if (type === "pass") suffix = randomChoice(PASS_SUFFIXES);
  else if (type === "port") suffix = randomChoice(PORT_SUFFIXES);
  else suffix = randomChoice(WILD_SUFFIXES);
  return `${prefix}${suffix}`;
}

/** 计算两点之间的距离 */
function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** 检查点是否靠近河流 */
function isNearRiver(x: number, y: number, rivers: { x1: number; y1: number; x2: number; y2: number }[]): boolean {
  for (const r of rivers) {
    const dist = pointToLineDistance(x, y, r.x1, r.y1, r.x2, r.y2);
    if (dist < 8) return true;
  }
  return false;
}

function pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return distance({ x: px, y: py }, { x: x1, y: y1 });
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return distance({ x: px, y: py }, { x: x1 + t * dx, y: y1 + t * dy });
}

/** 检查点是否靠近海岸 */
function isNearCoast(x: number, y: number, region: RegionConfig): boolean {
  if (region.terrain.coast_directions.length === 0) return false;
  const w = region.map_width;
  const h = region.map_height;
  const margin = 8;
  for (const dir of region.terrain.coast_directions) {
    if (dir === "east" && x > w - margin) return true;
    if (dir === "west" && x < margin) return true;
    if (dir === "north" && y < margin) return true;
    if (dir === "south" && y > h - margin) return true;
  }
  return false;
}

/** 根据地形和位置决定地点类型 */
function determineType(
  terrain: TerrainType,
  nearRiver: boolean,
  nearCoast: boolean,
  factionCount: number,
  townRatio: number,
): LocationType {
  if (nearCoast && Math.random() < 0.6) return "port";
  if (terrain === "mountain" && Math.random() < 0.15) return "pass";
  if (terrain === "lake" || terrain === "sea") return "wild";
  if (Math.random() < townRatio) return "town";
  if (Math.random() < 0.5) return "village";
  return "wild";
}

/** 根据地形生成本地产出 */
function generateProduction(terrain: TerrainType, specialtyGoods: string[]): Record<string, number> {
  const prod: Record<string, number> = {};
  const baseProd = TERRAIN_PRODUCTION[terrain] ?? [];
  for (const good of baseProd) {
    prod[good] = randomInt(3, 10);
  }
  if (specialtyGoods.length > 0 && Math.random() < 0.4) {
    const specialty = randomChoice(specialtyGoods);
    if (specialty && GOODS[specialty]) {
      prod[specialty] = (prod[specialty] ?? 0) + randomInt(5, 15);
    }
  }
  return prod;
}

/** 根据地点类型生成消耗 */
function generateConsumption(type: LocationType): Record<string, number> {
  const base: Record<string, number> = { wheat: randomInt(5, 15) };
  if (type === "town" || type === "port") {
    base.iron = randomInt(2, 8);
    if (Math.random() < 0.5) base.timber = randomInt(2, 6);
    if (Math.random() < 0.3) base.wine = randomInt(1, 5);
  }
  return base;
}

/** 根据产出/消耗计算初始库存 */
function generateStock(prod: Record<string, number>, cons: Record<string, number>): Record<string, number> {
  const stock: Record<string, number> = {};
  const allGoods = new Set([...Object.keys(prod), ...Object.keys(cons)]);
  for (const g of allGoods) {
    const p = prod[g] ?? 0;
    const c = cons[g] ?? 0;
    stock[g] = Math.max(0, Math.floor((p - c) * 5 + 20 + Math.random() * 10));
  }
  return stock;
}

/** 根据库存计算买卖价格 */
function computePrices(stock: Record<string, number>, goods: string[]): Record<string, { buy_price: number; sell_price: number }> {
  const market: Record<string, { buy_price: number; sell_price: number }> = {};
  for (const g of goods) {
    const base = GOODS[g]?.base_price ?? 10;
    const s = stock[g] ?? 0;
    const scarcity = Math.max(0.3, 2 - s / 30);
    const buy = Math.ceil(base * scarcity);
    const sell = Math.floor(buy * 0.7);
    market[g] = { buy_price: buy, sell_price: sell };
  }
  return market;
}

/**
 * 为指定区域程序化生成完整地图。
 * @param region 区域配置
 * @returns 生成的地点字典 { id: GeneratedLocation }
 */
export function generate_region_map(region: RegionConfig): Record<string, GeneratedLocation> {
  // === 卡拉迪亚模式：直接用骑砍2 官方定居点（真实坐标/名字/文化）===
  if (region.id === "calradia") {
    return generateCalradiaMap();
  }
  const locations: Record<string, GeneratedLocation> = {};
  const locationList: GeneratedLocation[] = [];
  _loc_counter = 0;

  const targetCount = randomInt(15, 22);
  const townCount = Math.max(3, Math.floor(targetCount * 0.25));
  const factionCount = region.factions.length;
  const townRatio = townCount / targetCount;

  let attempts = 0;
  const minDist = Math.min(region.map_width, region.map_height) / Math.sqrt(targetCount) * 0.6;

  while (locationList.length < targetCount && attempts < targetCount * 10) {
    attempts++;
    const x = randomInt(5, region.map_width - 5);
    const y = randomInt(5, region.map_height - 5);

    if (locationList.some(l => distance(l, { x, y }) < minDist)) continue;

    const terrain = weightedTerrain(region);
    const nearRiver = isNearRiver(x, y, region.terrain.rivers);
    const nearCoast = isNearCoast(x, y, region);
    const type = determineType(terrain, nearRiver, nearCoast, factionCount, townRatio);

    _loc_counter++;
    const id = `gen_loc_${_loc_counter}`;
    const name = generateName(terrain, type);
    const faction = randomChoice(region.factions);

    const production = generateProduction(terrain, region.specialty_goods);
    const consumption = generateConsumption(type);
    const stock = generateStock(production, consumption);
    const marketGoods = [...new Set([...Object.keys(stock), ...(TERRAIN_PRODUCTION[terrain] ?? [])])];
    const market = computePrices(stock, marketGoods);

    const loc: GeneratedLocation = {
      id,
      name,
      type,
      terrain_type: terrain,
      x,
      y,
      faction_id: faction.id,
      owner: "neutral",
      tax_income: type === "town" ? randomInt(40, 80) : type === "village" ? randomInt(15, 30) : 0,
      neighbors: [],
      market,
      barracks: type === "town" || type === "port" ? (CULTURE_RECRUIT[cultureForRegion(region)] ?? ["infantry", "archer"]) : type === "village" ? (VILLAGE_RECRUIT[cultureForRegion(region)] ?? ["peasant"]) : [],
      tavern: type === "town" ? ["c1", "c3"] : undefined,
      arena: type === "town" && Math.random() < 0.5 ? true : undefined,
      slave_market: (type === "town" || type === "village") && Math.random() < 0.4 ? true : undefined,
      facilities: type === "town" ? (Math.random() < 0.5 ? ["winery"] : Math.random() < 0.5 ? ["forge"] : undefined) : undefined,
      active_quests: [],
      production,
      consumption,
      stock,
      ecology: {
        forest_coverage: region.ecology_base.forest_coverage + randomInt(-10, 10),
        soil_fertility: region.ecology_base.soil_fertility + randomInt(-10, 10),
        water_quality: region.ecology_base.water_quality + randomInt(-10, 10),
      },
      is_port: type === "port",
    };

    if (type === "pass") {
      loc.defense_bonus = TERRAIN_DEFENSE_BONUS[terrain];
      loc.garrison_power = randomInt(10, 30);
      loc.market = {};
    }

    if (type === "port") {
      loc.barracks = CULTURE_RECRUIT[cultureForRegion(region)] ?? ["infantry", "archer"];
      loc.tavern = ["c1"];
      loc.facilities = ["winery"];
      loc.production.salt = randomInt(3, 8);
      loc.stock.salt = (loc.stock.salt ?? 0) + randomInt(10, 20);
    }

    locations[id] = loc;
    locationList.push(loc);
  }

  /** 自动计算邻居关系：每个地点连接最近的 2-4 个地点 */
  for (const loc of locationList) {
    const candidates = locationList
      .filter(l => l.id !== loc.id)
      .map(l => ({ loc: l, dist: distance(loc, l) }))
      .sort((a, b) => a.dist - b.dist);

    const neighborCount = randomInt(2, 4);
    const maxDist = Math.min(region.map_width, region.map_height) * 0.45;
    const neighbors = candidates
      .filter(c => c.dist < maxDist)
      .slice(0, neighborCount)
      .map(c => c.loc.id);

    loc.neighbors = [...new Set(neighbors)];
  }

  /** 确保图是连通的：将孤立子图连接到最近的大子图 */
  ensureConnectivity(locationList);

  /** 确保每个势力至少有一个城镇 */
  for (const faction of region.factions) {
    const hasTown = locationList.some(l => l.faction_id === faction.id && (l.type === "town" || l.type === "port"));
    if (!hasTown) {
      const factionVillages = locationList.filter(l => l.faction_id === faction.id && l.type === "village");
      if (factionVillages.length > 0) {
        const v = randomChoice(factionVillages);
        v.type = "town";
        v.tax_income = randomInt(40, 60);
        v.barracks = ["infantry", "archer"];
        v.tavern = ["c1", "c3"];
        v.arena = Math.random() < 0.5;
      }
    }
  }

  /** 确保有足够的关隘 */
  const existingPasses = locationList.filter(l => l.type === "pass").length;
  if (existingPasses < region.pass_count) {
    const mountains = locationList.filter(l => l.terrain_type === "mountain" && l.type !== "pass");
    for (let i = existingPasses; i < region.pass_count && i < mountains.length; i++) {
      const m = mountains[i];
      if (m) {
        m.type = "pass";
        m.defense_bonus = TERRAIN_DEFENSE_BONUS.mountain;
        m.garrison_power = randomInt(10, 30);
        m.name = generateName("mountain", "pass");
        m.market = {};
      }
    }
  }

  return locations;
}

/** 确保所有地点互相可达 */
function ensureConnectivity(locations: GeneratedLocation[]): void {
  if (locations.length <= 1) return;

  const visited = new Set<string>();
  const queue: string[] = [locations[0].id];
  visited.add(locations[0].id);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const loc = locations.find(l => l.id === id)!;
    for (const nId of loc.neighbors) {
      if (!visited.has(nId)) {
        visited.add(nId);
        queue.push(nId);
      }
    }
  }

  const unvisited = locations.filter(l => !visited.has(l.id));
  if (unvisited.length === 0) return;

  const visitedLocs = locations.filter(l => visited.has(l.id));
  for (const u of unvisited) {
    const nearest = visitedLocs
      .map(l => ({ loc: l, dist: distance(u, l) }))
      .sort((a, b) => a.dist - b.dist)[0];
    if (nearest) {
      u.neighbors.push(nearest.loc.id);
      nearest.loc.neighbors.push(u.id);
    }
  }

  ensureConnectivity(locations);
}

/** 获取地形通行成本 */
export function get_move_cost(loc: GeneratedLocation): number {
  return TERRAIN_MOVE_COST[loc.terrain_type] ?? 1;
}

/** 获取地形防守加成 */
export function get_defense_bonus(loc: GeneratedLocation): number {
  if (loc.type === "pass" && loc.defense_bonus) return loc.defense_bonus;
  return TERRAIN_DEFENSE_BONUS[loc.terrain_type] ?? 1.0;
}

/** 获取地形名称 */
export function get_terrain_name(loc: GeneratedLocation): string {
  return TERRAIN_NAMES[loc.terrain_type] ?? "未知";
}

/** 卡拉迪亚：从官方数据构建 393 个定居点（城镇/城堡/村庄）。 */
function generateCalradiaMap(): Record<string, GeneratedLocation> {
  const locations: Record<string, GeneratedLocation> = {};
  const list: GeneratedLocation[] = [];
  // 文化 → 势力（卡拉迪亚 6 大军团）
  const cultToFaction: Record<string, string> = {
    empire: "rf1", vlandia: "rf2", aserai: "rf3",
    battania: "rf4", khuzait: "rf5", sturgia: "rf6",
  };
  // 文化 → 兵营兵种
  const CULTURE_RECRUIT_C: Record<string, string[]> = {
    empire: ["imperial_recruit", "imperial_infantryman", "imperial_archer"],
    vlandia: ["vlandian_recruit", "vlandian_footman", "vlandian_levy_crossbowman"],
    aserai: ["aserai_recruit", "aserai_tribesman"],
    battania: ["battanian_volunteer", "battanian_clanwarrior", "battanian_woodrunner"],
    khuzait: ["khuzait_nomad", "khuzait_footman", "khuzait_tribal_warrior"],
    sturgia: ["sturgian_recruit", "sturgian_warrior", "sturgian_woodsman"],
  };
  for (const loc of CALRADIA_LOCATIONS) {
    const culture = loc.culture;
    const factionId = cultToFaction[culture] || "rf1";
    const isTown = loc.type === "town";
    const isCastle = loc.type === "castle";
    const gl: GeneratedLocation = {
      id: loc.id,
      name: loc.name,
      type: isTown ? "town" : (isCastle ? "pass" : "village"),
      terrain_type: "plain",
      x: loc.x,
      y: loc.y,
      faction_id: factionId,
      owner: "neutral",
      tax_income: isTown ? 60 : (isCastle ? 25 : 18),
      neighbors: [],
      market: {},
      barracks: isTown ? (CULTURE_RECRUIT_C[culture] ?? ["infantry", "archer"]) : (["peasant"]),
      tavern: isTown ? ["c1", "c3"] : undefined,
      arena: isTown && Math.random() < 0.5,
      slave_market: isTown && Math.random() < 0.4,
      facilities: isTown ? ["forge"] : undefined,
      active_quests: [],
      production: { wood: isTown ? 3 : 1 },
      consumption: { wood: 1 },
      stock: { wood: 10 },
      ecology: { forest_coverage: 50, soil_fertility: 50, water_quality: 50 },
      defense_bonus: isCastle ? 1.5 : undefined,
      garrison_power: isCastle ? 20 : undefined,
      is_port: isTown && (loc.id.includes("port") || loc.name.toLowerCase().includes("port") || loc.name.toLowerCase().includes("sea")),
    };
    locations[loc.id] = gl;
    list.push(gl);
  }
  // 邻居：最近 3 个定居点
  for (const loc of list) {
    const sorted = list
      .filter(l => l.id !== loc.id)
      .map(l => ({ l, d: Math.hypot(l.x - loc.x, l.y - loc.y) }))
      .sort((a, b) => a.d - b.d);
    loc.neighbors = sorted.slice(0, 3).map(x => x.l.id);
  }
  return locations;
}
