import { CALRADIA_REGION } from "./calradia";
/**
 * 亚欧非大陆区域定义模块。
 * 每个区域对应真实世界的一个地理板块，包含地形分布、势力、货币和生态配置。
 * 玩家开始游戏时选择一个区域作为游玩地图，所有内容在该区域内程序化生成。
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

/** 亚欧非大陆 12 个可游玩区域 */
export const WORLD_REGIONS: RegionConfig[] = [
  {
    id: "central_plains",
    name: "中原",
    real_world: "中国中原",
    description: "黄河与长江之间的肥沃平原，四方辐辏，沃野千里。城池林立，商路纵横，乃兵家必争之地。",
    difficulty: 2,
    map_width: 100,
    map_height: 100,
    terrain: {
      weights: { plain: 0.45, forest: 0.15, hill: 0.12, river: 0.1, mountain: 0.08, grassland: 0.1 },
      rivers: [
        { x1: 20, y1: 10, x2: 50, y2: 90, name: "黄河" },
        { x1: 60, y1: 15, x2: 80, y2: 85, name: "长江" },
      ],
      coast_directions: ["east"],
    },
    factions: [
      { id: "rf1", name: "大梁", color: "blue", currency_id: "tongbao", personality: "honorable", start_renown: 0 },
      { id: "rf2", name: "南楚", color: "green", currency_id: "tongbao", personality: "generous", start_renown: 0 },
      { id: "rf3", name: "北燕", color: "red", currency_id: "tongbao", personality: "treacherous", start_renown: 0 },
    ],
    currencies: [
      { id: "tongbao", name: "通宝", symbol: "通", base_rate: 1.0 },
    ],
    pass_count: 3,
    ecology_base: { forest_coverage: 40, soil_fertility: 70, water_quality: 75 },
    specialty_goods: ["wheat", "silk"],
    lore: "中原大地，皇权倾覆，群雄并起。你在这乱世之中，只有一腔热血和百枚通宝……",
  },
  {
    id: "persia",
    name: "波斯",
    real_world: "伊朗高原",
    description: "扎格罗斯山脉横亘其间，高原荒漠广布，绿洲城市如珍珠般串联在丝路之上。",
    difficulty: 3,
    map_width: 100,
    map_height: 100,
    terrain: {
      weights: { desert: 0.35, mountain: 0.25, hill: 0.2, plain: 0.1, grassland: 0.1 },
      rivers: [
        { x1: 15, y1: 30, x2: 85, y2: 50, name: "卡伦河" },
      ],
      coast_directions: ["south"],
    },
    factions: [
      { id: "rf1", name: "萨珊", color: "red", currency_id: "dinar", personality: "honorable", start_renown: 0 },
      { id: "rf2", name: "帕提亚", color: "blue", currency_id: "dinar", personality: "treacherous", start_renown: 0 },
      { id: "rf3", name: "花剌子模", color: "green", currency_id: "dinar", personality: "stingy", start_renown: 0 },
    ],
    currencies: [
      { id: "dinar", name: "第纳尔", symbol: "第", base_rate: 1.2 },
    ],
    pass_count: 4,
    ecology_base: { forest_coverage: 10, soil_fertility: 30, water_quality: 40 },
    specialty_goods: ["silk", "iron", "salt"],
    lore: "波斯高原上，萨珊与帕提亚世代为仇。丝路驼铃不绝，你在绿洲之间寻找崛起之机……",
  },
  {
    id: "nile_valley",
    name: "尼罗河流域",
    real_world: "埃及",
    description: "尼罗河纵贯南北，两岸绿洲如缎带，东有红山，西为沙漠。法老之地上，诸城竞逐。",
    difficulty: 3,
    map_width: 60,
    map_height: 140,
    terrain: {
      weights: { desert: 0.5, river: 0.2, plain: 0.15, mountain: 0.1, sea: 0.05 },
      rivers: [
        { x1: 30, y1: 10, x2: 30, y2: 130, name: "尼罗河" },
      ],
      coast_directions: ["north"],
    },
    factions: [
      { id: "rf1", name: "孟菲斯", color: "gold", currency_id: "deben", personality: "generous", start_renown: 0 },
      { id: "rf2", name: "底比斯", color: "blue", currency_id: "deben", personality: "honorable", start_renown: 0 },
      { id: "rf3", name: "库施", color: "red", currency_id: "deben", personality: "treacherous", start_renown: 0 },
    ],
    currencies: [
      { id: "deben", name: "德本", symbol: "德", base_rate: 0.8 },
    ],
    pass_count: 2,
    ecology_base: { forest_coverage: 5, soil_fertility: 80, water_quality: 85 },
    specialty_goods: ["wheat", "gold_dust", "stone"],
    lore: "尼罗河每年泛滥，沃土重生。上下游诸城沿河而立，你从河口三角洲起步，图谋统一上下游……",
  },
  {
    id: "frankia",
    name: "法兰西",
    real_world: "法国平原",
    description: "卢瓦尔河与塞纳河穿行于广袤平原，西临大洋，南接比利牛斯山。骑士之国，庄园遍布。",
    difficulty: 2,
    map_width: 100,
    map_height: 100,
    terrain: {
      weights: { plain: 0.4, forest: 0.25, hill: 0.15, river: 0.1, mountain: 0.05, sea: 0.05 },
      rivers: [
        { x1: 30, y1: 20, x2: 40, y2: 85, name: "卢瓦尔河" },
        { x1: 55, y1: 15, x2: 60, y2: 70, name: "塞纳河" },
      ],
      coast_directions: ["west", "north"],
    },
    factions: [
      { id: "rf1", name: "巴黎", color: "blue", currency_id: "sol", personality: "honorable", start_renown: 0 },
      { id: "rf2", name: "勃艮第", color: "red", currency_id: "sol", personality: "stingy", start_renown: 0 },
      { id: "rf3", name: "阿基坦", color: "green", currency_id: "sol", personality: "generous", start_renown: 0 },
    ],
    currencies: [
      { id: "sol", name: "索尔多", symbol: "索", base_rate: 1.1 },
    ],
    pass_count: 2,
    ecology_base: { forest_coverage: 35, soil_fertility: 65, water_quality: 70 },
    specialty_goods: ["wheat", "wine", "timber"],
    lore: "法兰西平原上，巴黎、勃艮第与阿基坦三足鼎立。你是一名浪迹天涯的骑士，誓要在这片土地上建立自己的领地……",
  },
  {
    id: "mongol_steppe",
    name: "蒙古草原",
    real_world: "蒙古高原",
    description: "茫茫草原延伸至天际，北有戈壁，南接阴山。马背民族逐水草而居，汗帐林立。",
    difficulty: 4,
    map_width: 120,
    map_height: 100,
    terrain: {
      weights: { grassland: 0.55, desert: 0.2, mountain: 0.1, hill: 0.1, river: 0.05 },
      rivers: [
        { x1: 20, y1: 30, x2: 90, y2: 60, name: "色楞格河" },
      ],
      coast_directions: [],
    },
    factions: [
      { id: "rf1", name: "克烈", color: "blue", currency_id: "balish", personality: "honorable", start_renown: 0 },
      { id: "rf2", name: "乃蛮", color: "red", currency_id: "balish", personality: "treacherous", start_renown: 0 },
      { id: "rf3", name: "塔塔尔", color: "green", currency_id: "balish", personality: "hot_headed", start_renown: 0 },
      { id: "rf4", name: "蔑儿乞", color: "purple", currency_id: "balish", personality: "stingy", start_renown: 0 },
    ],
    currencies: [
      { id: "balish", name: "巴里什", symbol: "巴", base_rate: 0.7 },
    ],
    pass_count: 3,
    ecology_base: { forest_coverage: 8, soil_fertility: 25, water_quality: 50 },
    specialty_goods: ["hides", "horses", "iron"],
    lore: "草原上风云变幻，四大部落此消彼长。你从一顶破旧毡帐起步，梦想统一草原，成为万人之上的可汗……",
  },
  {
    id: "arabia",
    name: "阿拉伯",
    real_world: "阿拉伯半岛",
    description: "红海与波斯湾夹持的巨大半岛，内陆为鲁卜哈利沙漠，沿岸绿洲贸易城邦星罗棋布。",
    difficulty: 4,
    map_width: 100,
    map_height: 120,
    terrain: {
      weights: { desert: 0.6, sea: 0.15, mountain: 0.1, plain: 0.1, hill: 0.05 },
      rivers: [],
      coast_directions: ["west", "south", "east"],
    },
    factions: [
      { id: "rf1", name: "麦加", color: "gold", currency_id: "dirham", personality: "generous", start_renown: 0 },
      { id: "rf2", name: "麦地那", color: "green", currency_id: "dirham", personality: "honorable", start_renown: 0 },
      { id: "rf3", name: "马斯喀特", color: "blue", currency_id: "dirham", personality: "stingy", start_renown: 0 },
    ],
    currencies: [
      { id: "dirham", name: "迪拉姆", symbol: "迪", base_rate: 0.9 },
    ],
    pass_count: 2,
    ecology_base: { forest_coverage: 3, soil_fertility: 15, water_quality: 30 },
    specialty_goods: ["salt", "frankincense", "silk"],
    lore: "阿拉伯半岛上，商队穿越无尽沙漠，香料与丝绸在城邦间流转。你从麦加出发，梦想掌控丝路贸易……",
  },
  {
    id: "anatolia",
    name: "安纳托利亚",
    real_world: "小亚细亚",
    description: "高原核心地带，四周山脉环绕，西临爱琴海。古来十字路口，东西文明交汇之地。",
    difficulty: 3,
    map_width: 100,
    map_height: 80,
    terrain: {
      weights: { hill: 0.3, mountain: 0.25, plain: 0.2, forest: 0.1, sea: 0.1, river: 0.05 },
      rivers: [
        { x1: 20, y1: 20, x2: 70, y2: 60, name: "克孜勒河" },
      ],
      coast_directions: ["west", "north", "south"],
    },
    factions: [
      { id: "rf1", name: "科尼亚", color: "red", currency_id: "akce", personality: "honorable", start_renown: 0 },
      { id: "rf2", name: "特拉布宗", color: "blue", currency_id: "akce", personality: "treacherous", start_renown: 0 },
      { id: "rf3", name: "尼西亚", color: "green", currency_id: "akce", personality: "generous", start_renown: 0 },
    ],
    currencies: [
      { id: "akce", name: "阿克切", symbol: "阿", base_rate: 0.6 },
    ],
    pass_count: 4,
    ecology_base: { forest_coverage: 20, soil_fertility: 45, water_quality: 55 },
    specialty_goods: ["iron", "timber", "wine"],
    lore: "安纳托利亚高原是东西方的十字路口，三大势力在此角力。你在这片古老土地上寻找着命运的指引……",
  },
  {
    id: "indus_valley",
    name: "印度河流域",
    real_world: "巴基斯坦/印度西北",
    description: "印度河纵贯南北，西有苏莱曼山，北枕喀喇昆仑。河谷沃土千里，古文明发祥之地。",
    difficulty: 3,
    map_width: 80,
    map_height: 120,
    terrain: {
      weights: { plain: 0.3, desert: 0.2, river: 0.15, mountain: 0.15, hill: 0.1, grassland: 0.1 },
      rivers: [
        { x1: 40, y1: 10, x2: 40, y2: 110, name: "印度河" },
      ],
      coast_directions: ["south"],
    },
    factions: [
      { id: "rf1", name: "拉合尔", color: "green", currency_id: "tanka", personality: "generous", start_renown: 0 },
      { id: "rf2", name: "木尔坦", color: "red", currency_id: "tanka", personality: "stingy", start_renown: 0 },
      { id: "rf3", name: "信德", color: "blue", currency_id: "tanka", personality: "honorable", start_renown: 0 },
    ],
    currencies: [
      { id: "tanka", name: "坦卡", symbol: "坦", base_rate: 0.85 },
    ],
    pass_count: 3,
    ecology_base: { forest_coverage: 15, soil_fertility: 60, water_quality: 65 },
    specialty_goods: ["wheat", "cotton", "hides"],
    lore: "印度河滋养了千年文明，上下游诸邦沿河而立。你在河口三角洲起步，梦想建立横跨流域的王国……",
  },
  {
    id: "sahel",
    name: "萨赫勒",
    real_world: "非洲萨赫勒地带",
    description: "撒哈拉沙漠南缘的狭长草原带，尼日尔河蜿蜒其中，盐与黄金的贸易通道贯穿东西。",
    difficulty: 5,
    map_width: 140,
    map_height: 60,
    terrain: {
      weights: { grassland: 0.35, desert: 0.3, river: 0.1, hill: 0.1, plain: 0.1, swamp: 0.05 },
      rivers: [
        { x1: 20, y1: 30, x2: 120, y2: 35, name: "尼日尔河" },
      ],
      coast_directions: ["south"],
    },
    factions: [
      { id: "rf1", name: "加奥", color: "gold", currency_id: "mithqal", personality: "generous", start_renown: 0 },
      { id: "rf2", name: "廷巴克图", color: "blue", currency_id: "mithqal", personality: "honorable", start_renown: 0 },
      { id: "rf3", name: "杰内", color: "green", currency_id: "mithqal", personality: "stingy", start_renown: 0 },
    ],
    currencies: [
      { id: "mithqal", name: "米斯卡尔", symbol: "米", base_rate: 1.5 },
    ],
    pass_count: 2,
    ecology_base: { forest_coverage: 8, soil_fertility: 30, water_quality: 45 },
    specialty_goods: ["gold_dust", "salt", "hides"],
    lore: "萨赫勒草原上，黄金与盐的贸易催生了辉煌的城邦。你从廷巴克图出发，梦想掌控横贯撒哈拉的商路……",
  },
  {
    id: "russia",
    name: "罗斯",
    real_world: "东欧平原",
    description: "第聂伯河与伏尔加河穿行于广袤平原，北有冻土，南为草原。森林莽莽，冬日漫长。",
    difficulty: 3,
    map_width: 120,
    map_height: 100,
    terrain: {
      weights: { forest: 0.35, plain: 0.25, river: 0.1, tundra: 0.1, hill: 0.1, grassland: 0.1 },
      rivers: [
        { x1: 30, y1: 10, x2: 40, y2: 90, name: "第聂伯河" },
        { x1: 70, y1: 15, x2: 80, y2: 85, name: "伏尔加河" },
      ],
      coast_directions: ["north", "south"],
    },
    factions: [
      { id: "rf1", name: "基辅", color: "red", currency_id: "grivna", personality: "honorable", start_renown: 0 },
      { id: "rf2", name: "诺夫哥罗德", color: "blue", currency_id: "grivna", personality: "generous", start_renown: 0 },
      { id: "rf3", name: "弗拉基米尔", color: "green", currency_id: "grivna", personality: "treacherous", start_renown: 0 },
    ],
    currencies: [
      { id: "grivna", name: "格里夫纳", symbol: "格", base_rate: 0.95 },
    ],
    pass_count: 2,
    ecology_base: { forest_coverage: 55, soil_fertility: 40, water_quality: 60 },
    specialty_goods: ["timber", "hides", "honey"],
    lore: "罗斯平原上，诸公国沿河而建，森林中隐匿着无数机遇。你从基辅城外的农庄起步，志在统一全罗斯……",
  },
  {
    id: "iberia",
    name: "伊比利亚",
    real_world: "西班牙/葡萄牙",
    description: "梅塞塔高原居中，四周山脉环绕，南北临海。干涸高原与肥沃河谷交错，三方势力拉锯。",
    difficulty: 3,
    map_width: 80,
    map_height: 100,
    terrain: {
      weights: { hill: 0.3, plain: 0.25, mountain: 0.2, river: 0.1, sea: 0.1, forest: 0.05 },
      rivers: [
        { x1: 20, y1: 15, x2: 30, y2: 85, name: "塔霍河" },
        { x1: 55, y1: 20, x2: 60, y2: 80, name: "埃布罗河" },
      ],
      coast_directions: ["west", "east", "south"],
    },
    factions: [
      { id: "rf1", name: "卡斯蒂利亚", color: "red", currency_id: "maravedi", personality: "honorable", start_renown: 0 },
      { id: "rf2", name: "阿拉贡", color: "blue", currency_id: "maravedi", personality: "generous", start_renown: 0 },
      { id: "rf3", name: "格拉纳达", color: "green", currency_id: "maravedi", personality: "treacherous", start_renown: 0 },
    ],
    currencies: [
      { id: "maravedi", name: "马拉维迪", symbol: "马", base_rate: 0.75 },
    ],
    pass_count: 3,
    ecology_base: { forest_coverage: 18, soil_fertility: 40, water_quality: 50 },
    specialty_goods: ["wine", "iron", "olive_oil"],
    lore: "伊比利亚半岛上，三方势力鼎立而争。你从高原边缘的小镇出发，梦想在这片热土上建立霸业……",
  },
  {
    id: "scandinavia",
    name: "斯堪的纳维亚",
    real_world: "北欧",
    description: "峡湾深入内陆，冰川刻蚀的山脉纵贯南北，森林广袤。维京人的故乡，龙船纵横北海。",
    difficulty: 4,
    map_width: 80,
    map_height: 140,
    terrain: {
      weights: { mountain: 0.3, forest: 0.3, sea: 0.2, tundra: 0.1, river: 0.05, hill: 0.05 },
      rivers: [
        { x1: 40, y1: 10, x2: 45, y2: 130, name: "格洛马河" },
      ],
      coast_directions: ["west", "east", "north", "south"],
    },
    factions: [
      { id: "rf1", name: "挪威", color: "blue", currency_id: "ore", personality: "honorable", start_renown: 0 },
      { id: "rf2", name: "丹麦", color: "red", currency_id: "ore", personality: "treacherous", start_renown: 0 },
      { id: "rf3", name: "瑞典", color: "green", currency_id: "ore", personality: "generous", start_renown: 0 },
    ],
    currencies: [
      { id: "ore", name: "奥雷", symbol: "奥", base_rate: 0.5 },
    ],
    pass_count: 3,
    ecology_base: { forest_coverage: 60, soil_fertility: 25, water_quality: 80 },
    specialty_goods: ["timber", "iron", "hides", "honey"],
    lore: "斯堪的纳维亚的峡湾与密林之间，三国虎视眈眈。你是一名失去船只的维京战士，誓要重振家族荣光……",
  },
];

/** 获取区域配置 */
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
  return WORLD_REGIONS.find(r => r.id === id);
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
