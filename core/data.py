"""数据定义模块：包含兵种、地图地点与随机事件配置。"""

UNITS = {
    "peasant": {
        "name": "农民",
        "recruit_cost": 10,
        "power": 1,
        "upgrade_cost": 100,
        "upgrade_to": "infantry",
        "promotion_target": "infantry",
    },
    "infantry": {
        "name": "步兵",
        "recruit_cost": 30,
        "power": 3,
        "upgrade_cost": 0,
        "upgrade_to": None,
        "promotion_target": None,
    },
    "archer": {
        "name": "弓箭手",
        "recruit_cost": 25,
        "power": 2,
        "upgrade_cost": 0,
        "upgrade_to": None,
        "promotion_target": None,
    },
}

LOCATIONS = {
    "oak_village": {
        "id": "oak_village",
        "name": "橡木村",
        "type": "village",
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
        "neighbors": ["river_town", "wild_mountain"],
        "market": {},
        "barracks": [],
    },
    "wild_mountain": {
        "id": "wild_mountain",
        "name": "黑风山",
        "type": "wild",
        "neighbors": ["iron_town", "wild_forest"],
        "market": {},
        "barracks": [],
    },
    "central_city": {
        "id": "central_city",
        "name": "许昌大都",
        "type": "town",
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
