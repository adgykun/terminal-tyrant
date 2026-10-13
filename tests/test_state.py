import os
import tempfile
import unittest

from core.state import GameState


class TestGameState(unittest.TestCase):

    def test_default_initialization(self):
        state = GameState()
        self.assertEqual(state.day, 1)
        self.assertEqual(state.gold, 100)
        self.assertEqual(state.location, "oak_village")
        self.assertEqual(state.troops, {"peasant": 0, "infantry": 0, "archer": 0})
        self.assertEqual(state.inventory, {"wheat": 0, "iron": 0})

    def test_custom_initialization(self):
        state = GameState(
            day=5,
            gold=250,
            location="river_town",
            troops={"peasant": 3, "infantry": 1, "archer": 0},
            inventory={"wheat": 10, "iron": 2},
        )
        self.assertEqual(state.day, 5)
        self.assertEqual(state.gold, 250)
        self.assertEqual(state.location, "river_town")
        self.assertEqual(state.troops["peasant"], 3)
        self.assertEqual(state.inventory["wheat"], 10)

    def test_to_dict_and_from_dict(self):
        original_state = GameState(
            day=3,
            gold=150,
            location="pine_village",
            troops={"peasant": 2, "infantry": 0, "archer": 1},
            inventory={"wheat": 5, "iron": 1},
        )
        data = original_state.to_dict()
        self.assertIsInstance(data, dict)

        restored_state = GameState.from_dict(data)
        self.assertEqual(restored_state.day, original_state.day)
        self.assertEqual(restored_state.gold, original_state.gold)
        self.assertEqual(restored_state.location, original_state.location)
        self.assertEqual(restored_state.troops, original_state.troops)
        self.assertEqual(restored_state.inventory, original_state.inventory)

    def test_save_and_load(self):
        state = GameState(
            day=10,
            gold=500,
            location="iron_town",
            troops={"peasant": 5, "infantry": 2, "archer": 2},
            inventory={"wheat": 20, "iron": 10},
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            save_path = os.path.join(temp_dir, "savegame.json")
            state.save(save_path)
            self.assertTrue(os.path.exists(save_path))

            loaded_state = GameState.load(save_path)
            self.assertEqual(loaded_state.day, state.day)
            self.assertEqual(loaded_state.gold, state.gold)
            self.assertEqual(loaded_state.location, state.location)
            self.assertEqual(loaded_state.troops, state.troops)
            self.assertEqual(loaded_state.inventory, state.inventory)


if __name__ == "__main__":
    unittest.main()
