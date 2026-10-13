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
}

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

EQUIPMENT = {
    "w1": {
        "id": "w1",
        "name": "铁剑",
        "type": "weapon",
        "power_bonus": 5,
        "price": 200,
    },
    "w2": {
        "id": "w2",
        "name": "方天画戟",
        "type": "weapon",
        "power_bonus": 15,
        "price": 800,
    },
    "a1": {
        "id": "a1",
        "name": "皮甲",
        "type": "armor",
        "power_bonus": 3,
        "price": 150,
    },
    "a2": {
        "id": "a2",
        "name": "铁甲",
        "type": "armor",
        "power_bonus": 8,
        "price": 400,
    },
    "h1": {
        "id": "h1",
        "name": "的卢",
        "type": "horse",
        "power_bonus": 5,
        "price": 300,
    },
    "h2": {
        "id": "h2",
        "name": "赤兔",
        "type": "horse",
        "power_bonus": 12,
        "price": 700,
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
