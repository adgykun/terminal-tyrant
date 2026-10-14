"""数据定义模块：包含装备、兵种、地图地点与随机事件配置。"""

LORE = {
    "background": "旧帝国崩塌后的第 50 年，大陆分裂为三个互相征伐的王国。你是一名身无分文的流浪者，怀揣着成为‘终端暴君’的野心，踏上了这片充满战火与机遇的土地……"
}

PERSONALITY_TRAITS = ["hot_headed", "cautious", "greedy", "loyal", "cowardly"]

ATTITUDE_LEVELS = {
    "contempt": {"name": "蔑视", "label": "蔑视地", "min_renown": 0, "max_renown": 99},
    "neutral": {"name": "中立", "label": "平静地", "min_renown": 100, "max_renown": 500},
    "respect": {"name": "尊敬", "label": "尊敬地", "min_renown": 501, "max_renown": 1000},
    "fawning": {"name": "谄媚", "label": "谄媚地", "min_renown": 1001, "max_renown": float("inf")},
}

NPC_MERCHANTS = {
    "tavern_keeper": {
        "id": "tavern_keeper",
        "name": "酒馆老板",
        "title": "贪婪的酒馆老板",
        "personality": "greedy",
    },
    "blacksmith": {
        "id": "blacksmith",
        "name": "铁匠",
        "title": "暴躁的铁匠",
        "personality": "hot_headed",
    },
    "arena_host": {
        "id": "arena_host",
        "name": "竞技场主持人",
        "title": "谨慎的竞技场主持人",
        "personality": "cautious",
    },
    "bard": {
        "id": "bard",
        "name": "游吟诗人",
        "title": "落魄的游吟诗人",
        "personality": "cautious",
    },
    "gambler": {
        "id": "gambler",
        "name": "赌徒",
        "title": "红眼的赌徒",
        "personality": "hot_headed",
    },
    "beggar": {
        "id": "beggar",
        "name": "乞丐",
        "title": "衣衫褴褛的乞丐",
        "personality": "cowardly",
    },
    "deserter": {
        "id": "deserter",
        "name": "逃兵",
        "title": "神色慌张的逃兵",
        "personality": "cowardly",
    },
}

# ===== Phase 14：酒馆三教九流交互配置常量 =====
BARD_LISTEN_COST = 10
BARD_MORALE_GAIN = 8
GAMBLER_MIN_BET = 10
BEGGAR_ALMS = 5
BEGGAR_RENOWN_GAIN = 3
BEGGAR_STEAL_CHANCE = 0.3
BEGGAR_STEAL_AMOUNT = 15
DESERTER_RECRUIT_COST = 150
DESERTER_POWER_BONUS = 8
DESERTER_ARMY_BONUS = 5
DESERTER_RELATION_PENALTY = 15

# ===== Phase 15：战场真实感 —— 打扫战场与俘虏处理配置 =====
SCAVENGE_MIN_DAYS = 1
SCAVENGE_MAX_DAYS = 2
SCAVENGE_AMBUSH_CHANCE = 0.25
SCAVENGE_GOLD_PER_ENEMY_POWER = 3
SCAVENGE_LOOT_CHANCE = 0.4
RANSOM_GOLD_PER_PRISONER = 60
RANSOM_RELATION_PENALTY = 12
RELEASE_RENOWN_PER_PRISONER = 2
RELEASE_MORALITY_GAIN = 3
EXECUTE_MORALITY_LOSS = 8
EXECUTE_RELATION_PENALTY = 20
EXECUTE_INTIMIDATION_GAIN = 3
EXECUTE_RENOWN_GAIN = 1
INTIMIDATION_CAP = 50
INTIMIDATION_ENEMY_REDUCTION = 0.01

# ===== Phase 16：世界真实感 —— 领主性格、动态新闻与恩怨系统 =====
LORD_PERSONALITIES = ["honorable", "treacherous", "generous", "stingy"]

LORD_PERSONALITY_MODIFIERS = {
    "honorable": 1.0,
    "treacherous": 0.8,
    "generous": 1.3,
    "stingy": 0.7,
}

LORDS = {
    "lord_aurora": {"id": "lord_aurora", "name": "奥萝拉女爵", "title": "慷慨的奥萝拉女爵", "faction_id": "f1", "personality": "generous"},
    "lord_gareth": {"id": "lord_gareth", "name": "铁腕加雷斯伯爵", "title": "荣誉的铁腕加雷斯伯爵", "faction_id": "f1", "personality": "honorable"},
    "lord_baron": {"id": "lord_baron", "name": "守财的巴隆男爵", "title": "吝啬的巴隆男爵", "faction_id": "f2", "personality": "stingy"},
    "lord_sigrid": {"id": "lord_sigrid", "name": "狡狐西格丽德女爵", "title": "背信弃义的狡狐西格丽德", "faction_id": "f2", "personality": "treacherous"},
    "lord_ulf": {"id": "lord_ulf", "name": "血斧乌尔夫领主", "title": "荣誉的血斧乌尔夫", "faction_id": "f3", "personality": "honorable"},
    "lord_matilda": {"id": "lord_matilda", "name": "玛蒂尔达女爵", "title": "慷慨的玛蒂尔达女爵", "faction_id": "f3", "personality": "generous"},
}

WORLD_NEWS_CHANCE = 0.15
WORLD_NEWS_HISTORY_LIMIT = 20
LORD_GRUDGE_DECAY = 1

NEWS_TEMPLATES = [
    {"type": "plague", "goods": "wheat", "sell_multiplier": 2.0, "duration": 3,
     "scope": "location", "template": "{loc} 爆发黑死瘟疫，人心惶惶，四方粮价飞涨！"},
    {"type": "bumper_harvest", "goods": "wheat", "sell_multiplier": 0.6, "duration": 2,
     "scope": "location", "template": "{loc} 今岁风调雨顺、麦粮丰收，市面麦价应声暴跌。"},
    {"type": "war_demand", "goods": "iron", "sell_multiplier": 1.8, "duration": 2,
     "scope": "global", "template": "{faction} 前线告急，军械需求暴涨，铁价一路飙升！"},
    {"type": "grand_feast", "goods": "wheat", "sell_multiplier": 1.5, "duration": 2,
     "scope": "global", "template": "{faction} 王室大摆宴席，采买四方麦粮，行情走高。"},
]

FACTIONS = {
    "f1": {
        "id": "f1",
        "name": "斯瓦迪亚",
        "color": "blue",
        "relations": {"f2": 0, "f3": 0},
    },
    "f2": {
        "id": "f2",
        "name": "罗多克",
        "color": "green",
        "relations": {"f1": 0, "f3": 0},
    },
    "f3": {
        "id": "f3",
        "name": "维吉亚",
        "color": "red",
        "relations": {"f1": 0, "f2": 0},
    },
}

QUEST_TEMPLATES = [
    {
        "type": "hunt_bandits",
        "desc": "剿灭 [数量] 个 [兵种] 匪徒",
        "reward_cash": 200,
        "reward_renown": 10,
    },
    {
        "type": "deliver_goods",
        "desc": "将 [数量] 单位 [商品] 从 [地点A] 运到 [地点B]",
        "reward_cash": 300,
        "reward_renown": 15,
    },
    {
        "type": "escort",
        "desc": "护送商队从 [地点A] 到 [地点B]",
        "reward_cash": 150,
        "reward_renown": 5,
    },
]

APPEARANCE_TIERS = {
    (1, 10): {
        "desc": "凶神恶煞/奇丑无比",
        "combat_effect": "enemy_morale -15",
        "social_modifier": -50,
    },
    (11, 40): {
        "desc": "相貌平平",
        "combat_effect": "none",
        "social_modifier": -10,
    },
    (41, 80): {
        "desc": "大众脸",
        "combat_effect": "none",
        "social_modifier": 0,
    },
    (81, 95): {
        "desc": "俊美/靓丽",
        "combat_effect": "none",
        "social_modifier": 20,
    },
    (96, 100): {
        "desc": "绝世容颜/倾国倾城",
        "combat_effect": "none",
        "social_modifier": 50,
        "special_event": "admirer",
    },
}

EQUIPMENT = {
    "w1": {
        "id": "w1",
        "name": "铁剑",
        "type": "weapon",
        "power_bonus": 5,
        "price": 200,
        "appearance_bonus": 0,
    },
    "w2": {
        "id": "w2",
        "name": "方天画戟",
        "type": "weapon",
        "power_bonus": 15,
        "price": 800,
        "appearance_bonus": 0,
    },
    "a1": {
        "id": "a1",
        "name": "皮甲",
        "type": "armor",
        "power_bonus": 3,
        "price": 150,
        "appearance_bonus": 0,
    },
    "a2": {
        "id": "a2",
        "name": "铁甲",
        "type": "armor",
        "power_bonus": 8,
        "price": 400,
        "appearance_bonus": 0,
    },
    "h1": {
        "id": "h1",
        "name": "的卢",
        "type": "horse",
        "power_bonus": 5,
        "price": 300,
        "appearance_bonus": 5,
    },
    "h2": {
        "id": "h2",
        "name": "赤兔",
        "type": "horse",
        "power_bonus": 12,
        "price": 700,
        "appearance_bonus": 10,
    },
    "c1": {
        "id": "c1",
        "name": "华丽丝绸",
        "type": "clothing",
        "power_bonus": 1,
        "price": 350,
        "appearance_bonus": 15,
    },
    "m1": {
        "id": "m1",
        "name": "精致面具",
        "type": "clothing",
        "power_bonus": 2,
        "price": 300,
        "appearance_bonus": 10,
    },
}

FISHING_GEAR = {
    "rod": {"name": "鱼竿", "price": 100},
    "bait": {"name": "饵料", "price": 2},
}

FISH_LOOT_TABLE = {
    "crucian_carp": {"name": "鲫鱼", "value": 10, "food": 2, "weight": 30},
    "carp": {"name": "鲤鱼", "value": 15, "food": 3, "weight": 30},
    "golden_carp": {"name": "金鲤鱼", "value": 100, "food": 5, "weight": 10},
    "old_boot": {"name": "破靴子", "value": 0, "food": 0, "weight": 15},
    "water_weed": {"name": "水草", "value": 0, "food": 0, "weight": 15},
}

COMPANIONS = {
    "c1": {
        "id": "c1",
        "name": "老练商人",
        "cost": 500,
        "bonus_type": "trade",
        "bonus_value": 0.1,
        "required_renown": 0,
        "likes_fishing": True,
        "personality": "greedy",
        "memory": [],
        "greeting": "金币的声音永远比剑吟更悦耳，阁下有何高见？",
    },
    "c2": {
        "id": "c2",
        "name": "百战将领",
        "cost": 600,
        "bonus_type": "combat",
        "bonus_value": 10,
        "required_renown": 20,
        "likes_fishing": False,
        "personality": "hot_headed",
        "memory": [],
        "greeting": "我的剑早就渴了！说吧，下一个敌人是谁？",
    },
    "c3": {
        "id": "c3",
        "name": "智谋军师",
        "cost": 400,
        "bonus_type": "morale",
        "bonus_value": 20,
        "required_renown": 10,
        "likes_fishing": False,
        "personality": "cautious",
        "memory": [],
        "greeting": "战场瞬息万变，唯有三思而后行才能走得更远。",
    },
}

UNITS = {
    "peasant": {
        "name": "农民",
        "recruit_cost": 10,
        "power": 1,
        "upgrade_cost": 100,
        "upgrade_to": "infantry",
        "promotion_target": "infantry",
        "food_consumption": 0.5,
        "prisoner_value": 3,
    },
    "infantry": {
        "name": "步兵",
        "recruit_cost": 30,
        "power": 3,
        "upgrade_cost": 0,
        "upgrade_to": None,
        "promotion_target": None,
        "food_consumption": 1.0,
        "prisoner_value": 9,
    },
    "archer": {
        "name": "弓箭手",
        "recruit_cost": 25,
        "power": 2,
        "upgrade_cost": 0,
        "upgrade_to": None,
        "promotion_target": None,
        "food_consumption": 0.8,
        "prisoner_value": 7,
    },
}

LOCATIONS = {
    "oak_village": {
        "id": "oak_village",
        "name": "橡木村",
        "type": "village",
        "terrain_type": "plain",
        "x": 10,
        "y": 10,
        "faction_id": "f1",
        "owner": "neutral",
        "tax_income": 20,
        "slave_market": True,
        "neighbors": ["river_town", "pine_village"],
        "market": {
            "wheat": {"buy_price": 10, "sell_price": 5},
        },
        "barracks": ["peasant"],
    },
    "pine_village": {
        "id": "pine_village",
        "name": "松木村",
        "type": "village",
        "terrain_type": "plain",
        "x": 80,
        "y": 10,
        "faction_id": "f2",
        "owner": "neutral",
        "tax_income": 20,
        "slave_market": True,
        "neighbors": ["oak_village", "iron_town"],
        "market": {
            "wheat": {"buy_price": 10, "sell_price": 5},
        },
        "barracks": ["peasant"],
    },
    "river_town": {
        "id": "river_town",
        "name": "河畔镇",
        "type": "town",
        "terrain_type": "river",
        "x": 20,
        "y": 40,
        "faction_id": "f1",
        "active_quests": [],
        "owner": "neutral",
        "tax_income": 50,
        "arena": True,
        "slave_market": True,
        "tavern": ["c1", "c3"],
        "neighbors": ["oak_village", "wild_forest", "central_city"],
        "market": {
            "wheat": {"buy_price": 20, "sell_price": 15},
            "iron": {"buy_price": 80, "sell_price": 60},
        },
        "barracks": ["infantry", "archer"],
    },
    "iron_town": {
        "id": "iron_town",
        "name": "铁矿镇",
        "type": "town",
        "terrain_type": "plain",
        "x": 70,
        "y": 40,
        "faction_id": "f2",
        "active_quests": [],
        "owner": "neutral",
        "tax_income": 50,
        "arena": True,
        "slave_market": True,
        "tavern": ["c2"],
        "neighbors": ["pine_village", "wild_mountain", "central_city"],
        "market": {
            "wheat": {"buy_price": 20, "sell_price": 15},
            "iron": {"buy_price": 80, "sell_price": 60},
        },
        "barracks": ["infantry", "archer"],
    },
    "wild_forest": {
        "id": "wild_forest",
        "name": "迷雾森林",
        "type": "wild",
        "terrain_type": "lake",
        "x": 30,
        "y": 80,
        "faction_id": "f3",
        "slave_market": True,
        "neighbors": ["river_town", "wild_mountain"],
        "market": {},
        "barracks": [],
    },
    "wild_mountain": {
        "id": "wild_mountain",
        "name": "黑风山",
        "type": "wild",
        "terrain_type": "plain",
        "x": 70,
        "y": 80,
        "faction_id": "f3",
        "slave_market": True,
        "neighbors": ["iron_town", "wild_forest"],
        "market": {},
        "barracks": [],
    },
    "central_city": {
        "id": "central_city",
        "name": "许昌大都",
        "type": "town",
        "terrain_type": "sea",
        "x": 45,
        "y": 45,
        "faction_id": "f3",
        "active_quests": [],
        "owner": "neutral",
        "tax_income": 100,
        "arena": True,
        "slave_market": True,
        "tavern": ["c1", "c2", "c3"],
        "neighbors": ["river_town", "iron_town"],
        "market": {
            "wheat": {"buy_price": 20, "sell_price": 15},
            "iron": {"buy_price": 80, "sell_price": 60},
        },
        "barracks": ["infantry", "archer"],
    },
}

EVENTS = {
    "bandit_encounter": {
        "id": "bandit_encounter",
        "name": "遇到山贼",
        "type": "combat",
        "weight": 35,
        "description": "前方路口遭遇了一伙凶恶的偷袭山贼！",
        "enemy_power_min": 5,
        "enemy_power_max": 20,
    },
    "caravan": {
        "id": "caravan",
        "name": "遇到商队",
        "type": "caravan",
        "weight": 20,
        "description": "遇到一支友好行商队伍，得到了些许路费资助。",
        "gold_reward": 30,
    },
    "treasure": {
        "id": "treasure",
        "name": "发现宝箱",
        "type": "treasure",
        "weight": 15,
        "description": "在路边荒草丛中发现了一个破旧的遗落宝箱！",
        "gold_reward": 50,
    },
    "nothing": {
        "id": "nothing",
        "name": "无事发生",
        "type": "nothing",
        "weight": 30,
        "description": "沿途风景宜人，行程一路平安。",
    },
}

GOODS = {
    "wheat": {
        "name": "麦子",
        "base_price": 5,
    },
    "iron": {
        "name": "铁",
        "base_price": 20,
    },
}

POLICIES = {
    "tax_high": {
        "id": "tax_high",
        "name": "重税",
        "effect": "tax_income * 1.5, morale -5/day",
    },
    "tax_low": {
        "id": "tax_low",
        "name": "轻薄赋",
        "effect": "tax_income * 0.8, morale +5/day",
    },
    "conscription": {
        "id": "conscription",
        "name": "强制征兵",
        "effect": "max_army_size +20, renown -2/day",
    },
}
