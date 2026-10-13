UNITS = {
    "peasant": {
        "name": "农民",
        "recruit_cost": 10,
        "power": 1,
        "promotion_target": "infantry",
    },
    "infantry": {
        "name": "步兵",
        "recruit_cost": 30,
        "power": 3,
        "promotion_target": None,
    },
    "archer": {
        "name": "弓箭手",
        "recruit_cost": 25,
        "power": 2,
        "promotion_target": None,
    },
}

LOCATIONS = {
    "oak_village": {
        "name": "橡木村",
        "type": "village",
        "x": 0,
        "y": 0,
    },
    "pine_village": {
        "name": "松木村",
        "type": "village",
        "x": 10,
        "y": 0,
    },
    "river_town": {
        "name": "河畔镇",
        "type": "town",
        "x": 5,
        "y": 10,
    },
    "iron_town": {
        "name": "铁矿镇",
        "type": "town",
        "x": 15,
        "y": 10,
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
