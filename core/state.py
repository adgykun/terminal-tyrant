import json


class GameState:
    """管理游戏世界的持久化状态数据结构。"""

    def __init__(
        self,
        day=1,
        gold=100,
        location="oak_village",
        morale=100,
        troops=None,
        inventory=None,
        logs=None,
        companions=None,
        fiefs=None,
        renown=0,
        food=100,
        max_army_size=20,
        equipment=None,
        prisoners=None,
        personal_power=10,
        loot=None,
        faction_relations=None,
        active_quests=None,
        completed_quests=None,
        is_king=False,
        kingdom_name="",
        current_policy=None,
        lords=None,
        log_history=None,
        equipment_gear=None,
        bait_count=0,
        fish_inventory=None,
        battle_lost_today=False,
        npc_states=None,
        attributes=None,
        appearance=0,
        appearance_revealed=False,
        current_equipment=None,
        deserter_recruited=False,
        unlocked_lore=None,
        morality=100,
        intimidation=0,
        world_news=None,
        lord_grudges=None,
    ):
        self.day = day
        self.gold = gold
        self.location = location
        self.morale = max(0, min(100, morale))
        self.troops = troops if troops is not None else {"peasant": 0, "infantry": 0, "archer": 0}
        self.inventory = inventory if inventory is not None else {"wheat": 0, "iron": 0}
        self.logs = logs if logs is not None else []
        self.companions = companions if companions is not None else []
        self.fiefs = fiefs if fiefs is not None else []
        self.renown = renown
        self.food = food
        self.max_army_size = max_army_size
        self.equipment = equipment if equipment is not None else {}
        self.prisoners = prisoners if prisoners is not None else {}
        self.personal_power = personal_power
        self.loot = loot if loot is not None else []
        self.faction_relations = faction_relations if faction_relations is not None else {"f1": 0, "f2": 0, "f3": 0}
        self.active_quests = active_quests if active_quests is not None else []
        self.completed_quests = completed_quests if completed_quests is not None else []
        self.is_king = is_king
        self.kingdom_name = kingdom_name
        self.current_policy = current_policy
        self.lords = lords if lords is not None else []
        self.log_history = log_history if log_history is not None else []
        self.equipment_gear = equipment_gear if equipment_gear is not None else {"rod": False}
        self.bait_count = bait_count
        self.fish_inventory = fish_inventory if fish_inventory is not None else {}
        self.battle_lost_today = battle_lost_today
        if npc_states is not None:
            self.npc_states = npc_states
        else:
            self.npc_states = {
                "tavern_keeper": {"mood": "neutral", "last_interaction": ""},
                "blacksmith": {"mood": "neutral", "last_interaction": ""},
                "arena_host": {"mood": "neutral", "last_interaction": ""},
                "bard": {"mood": "neutral", "last_interaction": ""},
                "gambler": {"mood": "neutral", "last_interaction": ""},
                "beggar": {"mood": "neutral", "last_interaction": ""},
                "deserter": {"mood": "neutral", "last_interaction": ""},
            }
        self.attributes = attributes if attributes is not None else {"strength": 5, "intellect": 5, "charm": 5}
        self.appearance = appearance
        self.appearance_revealed = appearance_revealed
        self.current_equipment = current_equipment if current_equipment is not None else {"clothing": None}
        self.deserter_recruited = deserter_recruited
        self.unlocked_lore = unlocked_lore if unlocked_lore is not None else []
        self.morality = max(0, min(100, morality))
        self.intimidation = max(0, intimidation)
        self.world_news = world_news if world_news is not None else []
        self.lord_grudges = lord_grudges if lord_grudges is not None else []

    @property
    def cash(self):
        """金钱属性别名，指向 gold。"""
        return self.gold

    @cash.setter
    def cash(self, value):
        self.gold = value

    @property
    def army(self):
        """部队属性别名，指向 troops。"""
        return self.troops

    @army.setter
    def army(self, value):
        self.troops = value

    def add_log(self, message):
        """记录一条事件日志。"""
        log_entry = f"[第 {self.day} 天] {message}"
        self.logs.append(log_entry)

    def to_dict(self):
        """将当前状态转换为字典格式。"""
        return {
            "day": self.day,
            "gold": self.gold,
            "location": self.location,
            "morale": self.morale,
            "troops": dict(self.troops),
            "inventory": dict(self.inventory),
            "logs": list(self.logs),
            "companions": list(self.companions),
            "fiefs": list(self.fiefs),
            "renown": self.renown,
            "food": self.food,
            "max_army_size": self.max_army_size,
            "equipment": dict(self.equipment),
            "prisoners": dict(self.prisoners),
            "personal_power": self.personal_power,
            "loot": list(self.loot),
            "faction_relations": dict(self.faction_relations),
            "active_quests": [dict(q) if isinstance(q, dict) else q for q in self.active_quests],
            "completed_quests": list(self.completed_quests),
            "is_king": self.is_king,
            "kingdom_name": self.kingdom_name,
            "current_policy": self.current_policy,
            "lords": list(self.lords),
            "log_history": [dict(e) for e in self.log_history],
            "equipment_gear": dict(self.equipment_gear),
            "bait_count": self.bait_count,
            "fish_inventory": dict(self.fish_inventory),
            "battle_lost_today": self.battle_lost_today,
            "npc_states": {k: dict(v) for k, v in self.npc_states.items()},
            "attributes": dict(self.attributes),
            "appearance": self.appearance,
            "appearance_revealed": self.appearance_revealed,
            "current_equipment": dict(self.current_equipment),
            "deserter_recruited": self.deserter_recruited,
            "unlocked_lore": list(self.unlocked_lore),
            "morality": self.morality,
            "intimidation": self.intimidation,
            "world_news": [dict(e) for e in self.world_news],
            "lord_grudges": list(self.lord_grudges),
        }

    @classmethod
    def from_dict(cls, data):
        """从字典数据重建 GameState 实例。"""
        return cls(
            day=data.get("day", 1),
            gold=data.get("gold", 100),
            location=data.get("location", "oak_village"),
            morale=data.get("morale", 100),
            troops=data.get("troops", {}),
            inventory=data.get("inventory", {}),
            logs=data.get("logs", []),
            companions=data.get("companions", []),
            fiefs=data.get("fiefs", []),
            renown=data.get("renown", 0),
            food=data.get("food", 100),
            max_army_size=data.get("max_army_size", 20),
            equipment=data.get("equipment", {}),
            prisoners=data.get("prisoners", {}),
            personal_power=data.get("personal_power", 10),
            loot=data.get("loot", []),
            faction_relations=data.get("faction_relations", {"f1": 0, "f2": 0, "f3": 0}),
            active_quests=data.get("active_quests", []),
            completed_quests=data.get("completed_quests", []),
            is_king=data.get("is_king", False),
            kingdom_name=data.get("kingdom_name", ""),
            current_policy=data.get("current_policy", None),
            lords=data.get("lords", []),
            log_history=data.get("log_history", []),
            equipment_gear=data.get("equipment_gear", {"rod": False}),
            bait_count=data.get("bait_count", 0),
            fish_inventory=data.get("fish_inventory", {}),
            battle_lost_today=data.get("battle_lost_today", False),
            npc_states=data.get("npc_states", None),
            attributes=data.get("attributes", {"strength": 5, "intellect": 5, "charm": 5}),
            appearance=data.get("appearance", 0),
            appearance_revealed=data.get("appearance_revealed", False),
            current_equipment=data.get("current_equipment", {"clothing": None}),
            deserter_recruited=data.get("deserter_recruited", False),
            unlocked_lore=data.get("unlocked_lore", []),
            morality=data.get("morality", 100),
            intimidation=data.get("intimidation", 0),
            world_news=data.get("world_news", []),
            lord_grudges=data.get("lord_grudges", []),
        )

    def save(self, filepath):
        """将当前状态保存为 JSON 文件。"""
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2)

    @classmethod
    def load(cls, filepath):
        """从 JSON 文件加载并恢复 GameState 实例。"""
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.from_dict(data)
