import { BANNERLORD_TROOPS } from "./troops_bannerlord";
/** 数据定义模块：包含装备、兵种、地图地点与随机事件配置。 */

export const LORE = {
    background: "旧帝国崩塌后的第 50 年，大陆分裂为三个互相征伐的王国。你是一名身无分文的流浪者，怀揣着成为'终端暴君'的野心，踏上了这片充满战火与机遇的土地……"
};

export const PERSONALITY_TRAITS = ["hot_headed", "cautious", "greedy", "loyal", "cowardly"];

export const ATTITUDE_LEVELS: Record<string, { name: string; label: string; min_renown: number; max_renown: number }> = {
    contempt: { name: "蔑视", label: "蔑视地", min_renown: 0, max_renown: 99 },
    neutral: { name: "中立", label: "平静地", min_renown: 100, max_renown: 500 },
    respect: { name: "尊敬", label: "尊敬地", min_renown: 501, max_renown: 1000 },
    fawning: { name: "谄媚", label: "谄媚地", min_renown: 1001, max_renown: Infinity },
};

export const NPC_MERCHANTS: Record<string, { id: string; name: string; title: string; personality: string }> = {
    tavern_keeper: {
        id: "tavern_keeper",
        name: "酒馆老板",
        title: "贪婪的酒馆老板",
        personality: "greedy",
    },
    blacksmith: {
        id: "blacksmith",
        name: "铁匠",
        title: "暴躁的铁匠",
        personality: "hot_headed",
    },
    arena_host: {
        id: "arena_host",
        name: "竞技场主持人",
        title: "谨慎的竞技场主持人",
        personality: "cautious",
    },
    bard: {
        id: "bard",
        name: "游吟诗人",
        title: "落魄的游吟诗人",
        personality: "cautious",
    },
    gambler: {
        id: "gambler",
        name: "赌徒",
        title: "红眼的赌徒",
        personality: "hot_headed",
    },
    beggar: {
        id: "beggar",
        name: "乞丐",
        title: "衣衫褴褛的乞丐",
        personality: "cowardly",
    },
    deserter: {
        id: "deserter",
        name: "逃兵",
        title: "神色慌张的逃兵",
        personality: "cowardly",
    },
    merchant: {
        id: "merchant",
        name: "市场商人",
        title: "精明的市场商人",
        personality: "greedy",
    },
};

// ===== Phase 14：酒馆三教九流交互配置常量 =====
export const BARD_LISTEN_COST = 10;
export const BARD_MORALE_GAIN = 8;
export const GAMBLER_MIN_BET = 10;
export const BEGGAR_ALMS = 5;
export const BEGGAR_RENOWN_GAIN = 3;
export const BEGGAR_STEAL_CHANCE = 0.3;
export const BEGGAR_STEAL_AMOUNT = 15;
export const DESERTER_RECRUIT_COST = 150;
export const DESERTER_POWER_BONUS = 8;
export const DESERTER_ARMY_BONUS = 5;
export const DESERTER_RELATION_PENALTY = 15;

// ===== Phase 15：战场真实感 —— 打扫战场与俘虏处理配置 =====
export const SCAVENGE_MIN_DAYS = 1;
export const SCAVENGE_MAX_DAYS = 2;
export const SCAVENGE_AMBUSH_CHANCE = 0.25;
export const SCAVENGE_GOLD_PER_ENEMY_POWER = 3;
export const SCAVENGE_LOOT_CHANCE = 0.4;
export const RANSOM_GOLD_PER_PRISONER = 60;
export const RANSOM_RELATION_PENALTY = 12;
export const RELEASE_RENOWN_PER_PRISONER = 2;
export const RELEASE_MORALITY_GAIN = 3;
export const EXECUTE_MORALITY_LOSS = 8;
export const EXECUTE_RELATION_PENALTY = 20;
export const EXECUTE_INTIMIDATION_GAIN = 3;
export const EXECUTE_RENOWN_GAIN = 1;
export const INTIMIDATION_CAP = 50;
export const INTIMIDATION_ENEMY_REDUCTION = 0.01;

// ===== Phase 16：世界真实感 —— 领主性格、动态新闻与恩怨系统 =====
export const LORD_PERSONALITIES = ["honorable", "treacherous", "generous", "stingy"];

export const LORD_PERSONALITY_MODIFIERS: Record<string, number> = {
    honorable: 1.0,
    treacherous: 0.8,
    generous: 1.3,
    stingy: 0.7,
};

export const LORDS: Record<string, { id: string; name: string; title: string; faction_id: string; personality: string }> = {
    lord_aurora: { id: "lord_aurora", name: "奥萝拉女爵", title: "慷慨的奥萝拉女爵", faction_id: "f1", personality: "generous" },
    lord_gareth: { id: "lord_gareth", name: "铁腕加雷斯伯爵", title: "荣誉的铁腕加雷斯伯爵", faction_id: "f1", personality: "honorable" },
    lord_baron: { id: "lord_baron", name: "守财的巴隆男爵", title: "吝啬的巴隆男爵", faction_id: "f2", personality: "stingy" },
    lord_sigrid: { id: "lord_sigrid", name: "狡狐西格丽德女爵", title: "背信弃义的狡狐西格丽德", faction_id: "f2", personality: "treacherous" },
    lord_ulf: { id: "lord_ulf", name: "血斧乌尔夫领主", title: "荣誉的血斧乌尔夫", faction_id: "f3", personality: "honorable" },
    lord_matilda: { id: "lord_matilda", name: "玛蒂尔达女爵", title: "慷慨的玛蒂尔达女爵", faction_id: "f3", personality: "generous" },
};

export const WORLD_NEWS_CHANCE = 0.15;
export const WORLD_NEWS_HISTORY_LIMIT = 20;
export const LORD_GRUDGE_DECAY = 1;

export const NEWS_TEMPLATES = [
    { type: "plague", goods: "wheat", sell_multiplier: 2.0, duration: 3, scope: "location", template: "{loc} 爆发黑死瘟疫，人心惶惶，四方粮价飞涨！" },
    { type: "bumper_harvest", goods: "wheat", sell_multiplier: 0.6, duration: 2, scope: "location", template: "{loc} 今岁风调雨顺、麦粮丰收，市面麦价应声暴跌。" },
    { type: "war_demand", goods: "iron", sell_multiplier: 1.8, duration: 2, scope: "global", template: "{faction} 前线告急，军械需求暴涨，铁价一路飙升！" },
    { type: "grand_feast", goods: "wheat", sell_multiplier: 1.5, duration: 2, scope: "global", template: "{faction} 王室大摆宴席，采买四方麦粮，行情走高。" },
];

export const FACTIONS: Record<string, { id: string; name: string; color: string; relations: Record<string, number> }> = {
    // 骑砍2 卡拉迪亚八王国
    empire_n: {
        id: "empire_n",
        name: "北帝国",
        color: "purple",
        relations: { empire_w: -50, empire_s: 10, sturgia: -50, vlandia: 20, khuzait: 0, aserai: 10, battania: 20 },
    },
    empire_w: {
        id: "empire_w",
        name: "西帝国",
        color: "indigo",
        relations: { empire_n: -50, empire_s: -50, sturgia: 20, vlandia: -50, khuzait: 0, aserai: 20, battania: 0 },
    },
    empire_s: {
        id: "empire_s",
        name: "南帝国",
        color: "violet",
        relations: { empire_n: 10, empire_w: -50, sturgia: 0, vlandia: 20, khuzait: -50, aserai: -50, battania: 10 },
    },
    sturgia: {
        id: "sturgia",
        name: "斯特吉亚",
        color: "cyan",
        relations: { empire_n: -50, empire_w: 20, empire_s: 0, vlandia: 0, khuzait: -50, aserai: 0, battania: 20 },
    },
    aserai: {
        id: "aserai",
        name: "阿塞莱",
        color: "red",
        relations: { empire_n: 10, empire_w: 20, empire_s: -50, sturgia: 0, vlandia: 0, khuzait: -50, battania: 0 },
    },
    vlandia: {
        id: "vlandia",
        name: "瓦兰迪亚",
        color: "blue",
        relations: { empire_n: 20, empire_w: -50, empire_s: 20, sturgia: 0, aserai: 0, khuzait: 0, battania: -50 },
    },
    battania: {
        id: "battania",
        name: "巴塔尼亚",
        color: "green",
        relations: { empire_n: 20, empire_w: 0, empire_s: 10, sturgia: 20, aserai: 0, vlandia: -50, khuzait: 0 },
    },
    khuzait: {
        id: "khuzait",
        name: "库赛特",
        color: "brown",
        relations: { empire_n: 0, empire_w: 0, empire_s: -50, sturgia: -50, aserai: -50, vlandia: 0, battania: 0 },
    },
    // 卡拉迪亚六势力别名（映射到八王国）
    rf1: { id: "rf1", name: "北帝国", color: "purple", relations: {} },
    rf2: { id: "rf2", name: "瓦兰迪亚", color: "blue", relations: {} },
    rf3: { id: "rf3", name: "阿塞莱", color: "red", relations: {} },
    rf4: { id: "rf4", name: "巴塔尼亚", color: "green", relations: {} },
    rf5: { id: "rf5", name: "库赛特", color: "brown", relations: {} },
    rf6: { id: "rf6", name: "斯特吉亚", color: "cyan", relations: {} },
};
// rf1-rf6 → 八王国主键（让卡拉迪亚势力参与真实外交）
export const RF_TO_KINGDOM: Record<string, string> = {
    rf1: "empire_n", rf2: "vlandia", rf3: "aserai",
    rf4: "battania", rf5: "khuzait", rf6: "sturgia",
};

export const QUEST_TEMPLATES = [
    {
        type: "hunt_bandits",
        desc: "剿灭 [数量] 个 [兵种] 匪徒",
        reward_cash: 200,
        reward_renown: 10,
    },
    {
        type: "deliver_goods",
        desc: "将 [数量] 单位 [商品] 从 [地点A] 运到 [地点B]",
        reward_cash: 300,
        reward_renown: 15,
    },
    {
        type: "escort",
        desc: "护送商队从 [地点A] 到 [地点B]",
        reward_cash: 150,
        reward_renown: 5,
    },
];

export const APPEARANCE_TIERS: Record<string, { range: [number, number]; desc: string; combat_effect: string; social_modifier: number; special_event?: string }> = {
    "1,10": {
        range: [1, 10],
        desc: "凶神恶煞/奇丑无比",
        combat_effect: "enemy_morale -15",
        social_modifier: -50,
    },
    "11,40": {
        range: [11, 40],
        desc: "相貌平平",
        combat_effect: "none",
        social_modifier: -10,
    },
    "41,80": {
        range: [41, 80],
        desc: "大众脸",
        combat_effect: "none",
        social_modifier: 0,
    },
    "81,95": {
        range: [81, 95],
        desc: "俊美/靓丽",
        combat_effect: "none",
        social_modifier: 20,
    },
    "96,100": {
        range: [96, 100],
        desc: "绝世容颜/倾国倾城",
        combat_effect: "none",
        social_modifier: 50,
        special_event: "admirer",
    },
};

export const EQUIPMENT: Record<string, { id: string; name: string; type: string; power_bonus: number; price: number; appearance_bonus: number }> = {
    w1: { id: "w1", name: "铁剑", type: "weapon", power_bonus: 5, price: 200, appearance_bonus: 0 },
    w2: { id: "w2", name: "方天画戟", type: "weapon", power_bonus: 15, price: 800, appearance_bonus: 0 },
    a1: { id: "a1", name: "皮甲", type: "armor", power_bonus: 3, price: 150, appearance_bonus: 0 },
    a2: { id: "a2", name: "铁甲", type: "armor", power_bonus: 8, price: 400, appearance_bonus: 0 },
    h1: { id: "h1", name: "的卢", type: "horse", power_bonus: 5, price: 300, appearance_bonus: 5 },
    h2: { id: "h2", name: "赤兔", type: "horse", power_bonus: 12, price: 700, appearance_bonus: 10 },
    c1: { id: "c1", name: "华丽丝绸", type: "clothing", power_bonus: 1, price: 350, appearance_bonus: 15 },
    m1: { id: "m1", name: "精致面具", type: "clothing", power_bonus: 2, price: 300, appearance_bonus: 10 },
};

export const FISHING_GEAR: Record<string, { name: string; price: number }> = {
    rod: { name: "鱼竿", price: 100 },
    bait: { name: "饵料", price: 2 },
};

export const FISH_LOOT_TABLE: Record<string, { name: string; value: number; food: number; weight: number }> = {
    crucian_carp: { name: "鲫鱼", value: 10, food: 2, weight: 30 },
    carp: { name: "鲤鱼", value: 15, food: 3, weight: 30 },
    golden_carp: { name: "金鲤鱼", value: 100, food: 5, weight: 10 },
    old_boot: { name: "破靴子", value: 0, food: 0, weight: 15 },
    water_weed: { name: "水草", value: 0, food: 0, weight: 15 },
};

export const COMPANIONS: Record<string, { id: string; name: string; cost: number; bonus_type: string; bonus_value: number; required_renown: number; likes_fishing: boolean; personality: string; memory: any[]; greeting: string }> = {
    c1: {
        id: "c1",
        name: "老练商人",
        cost: 500,
        bonus_type: "trade",
        bonus_value: 0.1,
        required_renown: 0,
        likes_fishing: true,
        personality: "greedy",
        memory: [],
        greeting: "金币的声音永远比剑吟更悦耳，阁下有何高见？",
    },
    c2: {
        id: "c2",
        name: "百战将领",
        cost: 600,
        bonus_type: "combat",
        bonus_value: 10,
        required_renown: 20,
        likes_fishing: false,
        personality: "hot_headed",
        memory: [],
        greeting: "我的剑早就渴了！说吧，下一个敌人是谁？",
    },
    c3: {
        id: "c3",
        name: "智谋军师",
        cost: 400,
        bonus_type: "morale",
        bonus_value: 20,
        required_renown: 10,
        likes_fishing: false,
        personality: "cautious",
        memory: [],
        greeting: "战场瞬息万变，唯有三思而后行才能走得更远。",
    },
};

export const UNITS: Record<string, any> = {
    peasant: {
        name: "农民",
        recruit_cost: 10,
        power: 1,
        upgrade_cost: 100,
        upgrade_to: "infantry",
        promotion_target: "infantry",
        food_consumption: 0.5,
        prisoner_value: 3,
    },
    infantry: {
        name: "步兵",
        recruit_cost: 30,
        power: 3,
        upgrade_cost: 0,
        upgrade_to: null,
        promotion_target: null,
        food_consumption: 1.0,
        prisoner_value: 9,
    },
    archer: {
        name: "弓箭手",
        recruit_cost: 25,
        power: 2,
        upgrade_cost: 0,
        upgrade_to: null,
        promotion_target: null,
        food_consumption: 0.8,
        prisoner_value: 7,
    },
};



export const LOCATIONS: Record<string, any> = {
    oak_village: {
        id: "oak_village",
        name: "橡木村",
        type: "village",
        terrain_type: "plain",
        x: 10,
        y: 10,
        faction_id: "f1",
        owner: "neutral",
        tax_income: 20,
        slave_market: true,
        neighbors: ["river_town", "pine_village"],
        market: {
            wheat: { buy_price: 10, sell_price: 5 },
        },
        barracks: ["peasant"],
    },
    pine_village: {
        id: "pine_village",
        name: "松木村",
        type: "village",
        terrain_type: "plain",
        x: 80,
        y: 10,
        faction_id: "f2",
        owner: "neutral",
        tax_income: 20,
        slave_market: true,
        neighbors: ["oak_village", "iron_town"],
        market: {
            wheat: { buy_price: 10, sell_price: 5 },
        },
        barracks: ["peasant"],
    },
    river_town: {
        id: "river_town",
        name: "河畔镇",
        type: "town",
        terrain_type: "river",
        x: 20,
        y: 40,
        faction_id: "f1",
        active_quests: [],
        owner: "neutral",
        tax_income: 50,
        arena: true,
        slave_market: true,
        tavern: ["c1", "c3"],
        facilities: ["winery"],
        neighbors: ["oak_village", "wild_forest", "central_city"],
        market: {
            wheat: { buy_price: 20, sell_price: 15 },
            iron: { buy_price: 80, sell_price: 60 },
            wine: { buy_price: 90, sell_price: 70 },
        },
        barracks: ["infantry", "archer"],
    },
    iron_town: {
        id: "iron_town",
        name: "铁矿镇",
        type: "town",
        terrain_type: "plain",
        x: 70,
        y: 40,
        faction_id: "f2",
        active_quests: [],
        owner: "neutral",
        tax_income: 50,
        arena: true,
        slave_market: true,
        tavern: ["c2"],
        facilities: ["forge"],
        neighbors: ["pine_village", "wild_mountain", "central_city"],
        market: {
            wheat: { buy_price: 20, sell_price: 15 },
            iron: { buy_price: 80, sell_price: 60 },
            tool: { buy_price: 220, sell_price: 180 },
        },
        barracks: ["infantry", "archer"],
    },
    wild_forest: {
        id: "wild_forest",
        name: "迷雾森林",
        type: "wild",
        terrain_type: "lake",
        x: 30,
        y: 80,
        faction_id: "f3",
        slave_market: true,
        neighbors: ["river_town", "wild_mountain"],
        market: {},
        barracks: [],
    },
    wild_mountain: {
        id: "wild_mountain",
        name: "黑风山",
        type: "wild",
        terrain_type: "plain",
        x: 70,
        y: 80,
        faction_id: "f3",
        slave_market: true,
        neighbors: ["iron_town", "wild_forest"],
        market: {},
        barracks: [],
    },
    central_city: {
        id: "central_city",
        name: "许昌大都",
        type: "town",
        terrain_type: "sea",
        x: 45,
        y: 45,
        faction_id: "f3",
        active_quests: [],
        owner: "neutral",
        tax_income: 100,
        arena: true,
        slave_market: true,
        tavern: ["c1", "c2", "c3"],
        facilities: ["winery", "forge"],
        neighbors: ["river_town", "iron_town"],
        market: {
            wheat: { buy_price: 20, sell_price: 15 },
            iron: { buy_price: 80, sell_price: 60 },
            wine: { buy_price: 90, sell_price: 70 },
            tool: { buy_price: 220, sell_price: 180 },
        },
        barracks: ["infantry", "archer"],
    },
};

export const EVENTS: Record<string, any> = {
    bandit_encounter: {
        id: "bandit_encounter",
        name: "遇到山贼",
        type: "combat",
        weight: 35,
        description: "前方路口遭遇了一伙凶恶的偷袭山贼！",
        enemy_power_min: 5,
        enemy_power_max: 20,
    },
    caravan: {
        id: "caravan",
        name: "遇到商队",
        type: "caravan",
        weight: 20,
        description: "遇到一支友好行商队伍，得到了些许路费资助。",
        gold_reward: 30,
    },
    treasure: {
        id: "treasure",
        name: "发现宝箱",
        type: "treasure",
        weight: 15,
        description: "在路边荒草丛中发现了一个破旧的遗落宝箱！",
        gold_reward: 50,
    },
    nothing: {
        id: "nothing",
        name: "无事发生",
        type: "nothing",
        weight: 30,
        description: "沿途风景宜人，行程一路平安。",
    },
};

export const GOODS: Record<string, { name: string; base_price: number; processed?: boolean }> = {
    wheat: { name: "麦子", base_price: 5 },
    iron: { name: "铁", base_price: 20 },
    wine: { name: "美酒", base_price: 70, processed: true },
    tool: { name: "铁器", base_price: 180, processed: true },
    timber: { name: "木材", base_price: 8 },
    stone: { name: "石料", base_price: 12 },
    hides: { name: "兽皮", base_price: 15 },
    salt: { name: "盐", base_price: 25 },
    silk: { name: "丝绸", base_price: 120, processed: true },
    fish_goods: { name: "鱼干", base_price: 6 },
    cotton: { name: "棉花", base_price: 18 },
    gold_dust: { name: "金砂", base_price: 200 },
    frankincense: { name: "乳香", base_price: 90 },
    olive_oil: { name: "橄榄油", base_price: 35 },
    honey: { name: "蜂蜜", base_price: 22 },
    horses: { name: "马匹", base_price: 150 },
};

// ===== Phase 17：经济真实感 —— 产业链与讨价还价配置 =====
export const RECIPES: Record<string, any> = {
    brew_wine: {
        id: "brew_wine",
        name: "酿酒",
        facility: "winery",
        input_goods: "wheat",
        input_amount: 3,
        fee: 10,
        output_goods: "wine",
        output_amount: 1,
    },
    forge_tool: {
        id: "forge_tool",
        name: "打铁",
        facility: "forge",
        input_goods: "iron",
        input_amount: 2,
        fee: 20,
        output_goods: "tool",
        output_amount: 1,
    },
    weave_silk: {
        id: "weave_silk",
        name: "织造丝绸",
        facility: "loom",
        input_goods: "cotton",
        input_amount: 3,
        fee: 30,
        output_goods: "silk",
        output_amount: 1,
    },
};

export const FACILITY_NAMES: Record<string, string> = { winery: "酿酒坊", forge: "铁匠工坊", sawmill: "锯木场", quarry: "采石场", loom: "织造坊" };
export const HAGGLE_CHARM_FACTOR = 0.03;
export const HAGGLE_BIG_SUCCESS_RATE = 0.35;
export const HAGGLE_FAIL_RATE = 0.15;
export const HAGGLE_MAX_DISCOUNT = 0.4;

export const POLICIES: Record<string, { id: string; name: string; effect: string }> = {
    tax_high: {
        id: "tax_high",
        name: "重税",
        effect: "tax_income * 1.5, morale -5/day",
    },
    tax_low: {
        id: "tax_low",
        name: "轻薄赋",
        effect: "tax_income * 0.8, morale +5/day",
    },
    conscription: {
        id: "conscription",
        name: "强制征兵",
        effect: "max_army_size +20, renown -2/day",
    },
};

export const MERCENARY_RANKS: Record<string, { id: string; name: string; wage: number; renown_req: number; perk: string }> = {
    recruit: { id: "recruit", name: "新兵", wage: 10, renown_req: 0, perk: "无" },
    veteran: { id: "veteran", name: "老兵", wage: 25, renown_req: 50, perk: "战力+5" },
    captain: { id: "captain", name: "队长", wage: 50, renown_req: 150, perk: "带兵上限+10" },
    commander: { id: "commander", name: "统领", wage: 100, renown_req: 300, perk: "战力+10, 带兵上限+20" },
};

export const MERCENARY_CONTRACT_WAGE_INTERVAL = 7;

export const KNIGHT_ORDERS: Record<string, {
    id: string;
    name: string;
    desc: string;
    faction_id: string;
    vows: { id: string; desc: string; rule: string }[];
    reward: { renown: number; personal_power: number; gold: number };
    penalty: string;
}> = {
    order_dawn: {
        id: "order_dawn",
        name: "黎明骑士团",
        desc: "崇尚光明与荣誉的骑士团，成员禁止使用弓箭手，以正面交锋为荣。",
        faction_id: "f1",
        vows: [
            { id: "no_archer", desc: "禁止使用弓箭手", rule: "no_archer" },
            { id: "no_night_ambush", desc: "禁止夜战偷袭", rule: "no_night_ambush" },
        ],
        reward: { renown: 50, personal_power: 5, gold: 200 },
        penalty: "违反誓言将被驱逐出骑士团，声望 -30",
    },
    order_iron: {
        id: "order_iron",
        name: "铁血骑士团",
        desc: "崇尚武力的骑士团，成员禁止撤退，以死战到底为荣。",
        faction_id: "f2",
        vows: [
            { id: "no_retreat", desc: "禁止撤退", rule: "no_retreat" },
            { id: "no_beggar", desc: "禁止施舍乞丐", rule: "no_beggar" },
        ],
        reward: { renown: 60, personal_power: 8, gold: 150 },
        penalty: "违反誓言将被驱逐出骑士团，声望 -30",
    },
    order_rose: {
        id: "order_rose",
        name: "蔷薇骑士团",
        desc: "崇尚仁义的骑士团，成员禁止处决俘虏，以宽恕为荣。",
        faction_id: "f3",
        vows: [
            { id: "no_execute", desc: "禁止处决俘虏", rule: "no_execute" },
            { id: "no_gamble", desc: "禁止赌博", rule: "no_gamble" },
        ],
        reward: { renown: 40, personal_power: 3, gold: 250 },
        penalty: "违反誓言将被驱逐出骑士团，声望 -30",
    },
};

// === 骑砍2 兵种 merge 到 UNITS（保持全部消费点兼容）===
for (const [tid, t] of Object.entries(BANNERLORD_TROOPS)) {
    if (!UNITS[tid]) {
        UNITS[tid] = {
            name: t.name,
            recruit_cost: t.recruit_cost,
            power: t.power,
            upgrade_cost: t.upgrade_cost,
            upgrade_to: t.upgrade_to,
            promotion_target: t.is_noble ? null : t.upgrade_to,
            food_consumption: t.food_consumption,
            prisoner_value: t.prisoner_value,
            // 额外字段（可选）
            culture: t.culture,
            culture_zh: t.culture_zh,
            level: t.level,
            group: t.group,
            is_noble: t.is_noble,
            upgrade_targets: t.upgrade_targets,
            skills: t.skills,
        };
    }
}
