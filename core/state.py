import json


class GameState:
    """Manages the serializable state of the game world."""

    def __init__(self, day=1, gold=100, location="oak_village", troops=None, inventory=None):
        self.day = day
        self.gold = gold
        self.location = location
        self.troops = troops if troops is not None else {"peasant": 0, "infantry": 0, "archer": 0}
        self.inventory = inventory if inventory is not None else {"wheat": 0, "iron": 0}

    def to_dict(self):
        """Returns state as a plain dictionary."""
        return {
            "day": self.day,
            "gold": self.gold,
            "location": self.location,
            "troops": dict(self.troops),
            "inventory": dict(self.inventory),
        }

    @classmethod
    def from_dict(cls, data):
        """Creates a GameState instance from a dictionary."""
        return cls(
            day=data.get("day", 1),
            gold=data.get("gold", 100),
            location=data.get("location", "oak_village"),
            troops=data.get("troops", {}),
            inventory=data.get("inventory", {}),
        )

    def save(self, filepath):
        """Saves current state to a JSON file."""
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2)

    @classmethod
    def load(cls, filepath):
        """Loads state from a JSON file and returns a GameState instance."""
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.from_dict(data)
