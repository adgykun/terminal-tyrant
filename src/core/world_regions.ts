import { CALRADIA_REGION } from "./calradia";
/**
 * 区域定义模块（仅卡拉迪亚）。
 * 当前只保留卡拉迪亚大陆作为唯一可游玩区域，get_region 仅返回 calradia 配置。
 */

export type TerrainType =
  | "plain" | "forest" | "mountain" | "desert" | "grassland"
  | "river" | "lake" | "sea" | "hill" | "swamp" | "tundra" | "jungle";

export interface RegionTerrainConfig {
  /** 地形类型 → 在地图上的生成权重 (0~1) */
  weights: Partial<Record<TerrainType, number>>;
  /** 主要河流走向 (起止坐标百分比) */
  rivers: { x1: number; y1: number; x2: number; y2: number; name: string }[];
  /** 海岸线方向 */
  coast_directions: string[];
}

export interface RegionFaction {
  id: string;
  name: string;
  color: string;
  currency_id: string;
  personality: string;
  start_renown: number;
}

export interface RegionCurrency {
  id: string;
  name: string;
  symbol: string;
  /** 对基础金币的初始汇率 */
  base_rate: number;
}

export interface RegionConfig {
  id: string;
  name: string;
  /** 真实世界对应区域 */
  real_world: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** 地图尺寸 (逻辑坐标范围) */
  map_width: number;
  map_height: number;
  /** 地形配置 */
  terrain: RegionTerrainConfig;
  /** 势力 (2-4个) */
  factions: RegionFaction[];
  /** 货币体系 */
  currencies: RegionCurrency[];
  /** 关隘数量 */
  pass_count: number;
  /** 生态特征 */
  ecology_base: {
    forest_coverage: number;
    soil_fertility: number;
    water_quality: number;
  };
  /** 特色商品 (该区域产出丰富的商品) */
  specialty_goods: string[];
  /** 背景文本 */
  lore: string;
}

/** 所有地形类型的中文名称 */
export const TERRAIN_NAMES: Record<TerrainType, string> = {
  plain: "平原",
  forest: "森林",
  mountain: "山脉",
  desert: "沙漠",
  grassland: "草原",
  river: "河流",
  lake: "湖泊",
  sea: "海洋",
  hill: "丘陵",
  swamp: "沼泽",
  tundra: "冻土",
  jungle: "丛林",
};

/** 地形对通行的影响 */
export const TERRAIN_MOVE_COST: Record<TerrainType, number> = {
  plain: 1,
  forest: 1.5,
  mountain: 2,
  desert: 1.5,
  grassland: 1,
  river: 1,
  lake: 0,
  sea: 0,
  hill: 1.5,
  swamp: 2,
  tundra: 2,
  jungle: 2,
};

/** 地形对防守的加成 */
export const TERRAIN_DEFENSE_BONUS: Record<TerrainType, number> = {
  plain: 1.0,
  forest: 1.2,
  mountain: 1.5,
  desert: 0.9,
  grassland: 1.0,
  river: 1.1,
  lake: 1.0,
  sea: 1.0,
  hill: 1.3,
  swamp: 1.1,
  tundra: 1.0,
  jungle: 1.3,
};

/** 地形可产出的商品 */
export const TERRAIN_PRODUCTION: Partial<Record<TerrainType, string[]>> = {
  plain: ["wheat"],
  forest: ["timber", "hides"],
  mountain: ["iron", "stone"],
  grassland: ["hides", "wheat"],
  river: ["wheat", "fish_goods"],
  lake: ["fish_goods"],
  sea: ["fish_goods", "salt"],
  hill: ["iron", "stone"],
  swamp: ["hides"],
  jungle: ["timber", "hides"],
  desert: ["salt"],
  tundra: ["hides"],
};

/** 地形图标 (lucide图标名) */
export const TERRAIN_ICONS: Record<TerrainType, string> = {
  plain: "Sprout",
  forest: "TreePine",
  mountain: "Mountain",
  desert: "Sun",
  grassland: "Wind",
  river: "Waves",
  lake: "Droplet",
  sea: "Sailboat",
  hill: "Mountain",
  swamp: "Droplets",
  tundra: "Snowflake",
  jungle: "Trees",
};

/** 地形背景色 (CSS) */
export const TERRAIN_COLORS: Record<TerrainType, string> = {
  plain: "#6b8f3a",
  forest: "#3d6b2a",
  mountain: "#8a8a7a",
  desert: "#d4b878",
  grassland: "#7ba84a",
  river: "#4a7cb8",
  lake: "#3a6ba8",
  sea: "#2a5a98",
  hill: "#9a9a8a",
  swamp: "#5a6b4a",
  tundra: "#c0d0d8",
  jungle: "#2a5b1a",
};

/** 获取区域配置（当前仅卡拉迪亚） */
export function get_region(id: string): RegionConfig | undefined {
  if (id === "calradia") {
    return {
      id: CALRADIA_REGION.id,
      name: CALRADIA_REGION.name,
      lore: CALRADIA_REGION.lore,
      map_width: CALRADIA_REGION.map_width,
      map_height: CALRADIA_REGION.map_height,
      difficulty: 3,
      real_world: "卡拉迪亚大陆",
      description: "旧帝国疆域，六方势力争霸的卡拉迪亚大陆。",
      terrain: {
        weights: { plain: 0.4, forest: 0.2, mountain: 0.15, river: 0.1, desert: 0.05, coast: 0.1 },
        rivers: [],
        coast_directions: ["north", "west", "south"],
      },
      ecology_base: { forest_coverage: 50, soil_fertility: 50, water_quality: 50 },
      factions: [
        { id: "rf1", name: "北帝国", color: "purple", currency_id: "gold", personality: "honorable", start_renown: 0 },
        { id: "rf2", name: "瓦兰迪亚", color: "blue", currency_id: "gold", personality: "generous", start_renown: 0 },
        { id: "rf3", name: "阿塞莱", color: "red", currency_id: "gold", personality: "treacherous", start_renown: 0 },
        { id: "rf4", name: "巴塔尼亚", color: "green", currency_id: "gold", personality: "honorable", start_renown: 0 },
        { id: "rf5", name: "库赛特", color: "brown", currency_id: "gold", personality: "stingy", start_renown: 0 },
        { id: "rf6", name: "斯特吉亚", color: "cyan", currency_id: "gold", personality: "generous", start_renown: 0 },
      ],
      currencies: [{ id: "gold", name: "金币", symbol: "金", base_rate: 1.0 }],
      specialty_goods: ["wood", "iron"],
      pass_count: 8,
    } as RegionConfig;
  }
  return undefined;
}
/** 获取区域的所有货币 */
export function get_region_currencies(regionId: string): RegionCurrency[] {
  const region = get_region(regionId);
  return region?.currencies ?? [];
}
/** 获取区域的主要货币 (第一个) */
export function get_region_primary_currency(regionId: string): RegionCurrency | null {
  const currencies = get_region_currencies(regionId);
  return currencies[0] ?? null;
}