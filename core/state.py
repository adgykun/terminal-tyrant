import json


class GameState:
    """管理游戏世界的持久化状态数据结构。"""

    def __init__(self, day=1, gold=100, location="oak_village", morale=100, troops=None, inventory=None, logs=None):
        self.day = day
        self.gold = gold
        self.location = location
        self.morale = max(0, min(100, morale))
        self.troops = troops if troops is not None else {"peasant": 0, "infantry": 0, "archer": 0}
        self.inventory = inventory if inventory is not None else {"wheat": 0, "iron": 0}
        self.logs = logs if logs is not None else []

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
