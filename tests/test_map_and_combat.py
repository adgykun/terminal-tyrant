"""大地图移动与战斗系统单元测试模块。"""

import os
import tempfile
import unittest
from unittest.mock import patch

from core.data import LOCATIONS, EVENTS
from core.engine import move, rest, resolve_combat_simple, calculate_army_power
from core.state import GameState


class TestMapAndCombat(unittest.TestCase):
    """测试地图网络连通性、移动机制、休整机制及简单战斗系统。"""

    def setUp(self):
        self.state = GameState(
            day=1,
            gold=100,
            location="oak_village",
            morale=80,
            troops={"peasant": 5, "infantry": 2, "archer": 3},
            inventory={"wheat": 10, "iron": 0},
        )

    def test_map_network_structure(self):
        """测试地图数据的图网络连通性。"""
        self.assertGreaterEqual(len(LOCATIONS), 6)
        for loc_id, loc_data in LOCATIONS.items():
            self.assertIn("id", loc_data)
            self.assertIn("name", loc_data)
            self.assertIn("type", loc_data)
            self.assertIn("neighbors", loc_data)
            for neighbor_id in loc_data["neighbors"]:
                self.assertIn(neighbor_id, LOCATIONS)
                # 双向连通检查
                self.assertIn(loc_id, LOCATIONS[neighbor_id]["neighbors"])

    def test_valid_move(self):
        """测试合法地图移动。"""
        # oak_village 的邻居包括 river_town
        with patch("core.engine.select_random_event") as mock_event:
            mock_event.return_value = EVENTS["nothing"]
            success, msg, event_data = move(self.state, "river_town")
            self.assertTrue(success)
            self.assertEqual(self.state.location, "river_town")
            self.assertEqual(self.state.day, 2)
            self.assertEqual(self.state.morale, 75)
            self.assertEqual(event_data["id"], "nothing")

    def test_invalid_move(self):
        """测试非法地图移动（非相邻节点）。"""
        # oak_village 与 wild_mountain 不直接连通
        success, msg, event_data = move(self.state, "wild_mountain")
        self.assertFalse(success)
        self.assertEqual(self.state.location, "oak_village")
        self.assertEqual(self.state.day, 1)

    def test_rest(self):
        """测试原地休整。"""
        self.state.morale = 70
        rest(self.state)
        self.assertEqual(self.state.day, 2)
        self.assertEqual(self.state.morale, 85)

    def test_combat_attack_victory(self):
        """测试主动进攻胜利结算。"""
        # 玩家战力: 5*1 + 2*3 + 3*2 = 17
        self.assertEqual(calculate_army_power(self.state.troops), 17)
        enemy_power = 10
        initial_gold = self.state.gold

        result = resolve_combat_simple(self.state, enemy_power, choice="attack")
        self.assertTrue(result["victory"])
        self.assertGreater(self.state.gold, initial_gold)
        self.assertEqual(result["gold_gained"], enemy_power * 5)

    def test_combat_defend_victory(self):
        """测试筑防坚守胜利结算。"""
        enemy_power = 15
        initial_gold = self.state.gold

        result = resolve_combat_simple(self.state, enemy_power, choice="defend")
        self.assertTrue(result["victory"])
        self.assertEqual(result["gold_gained"], enemy_power * 2)

    def test_combat_retreat(self):
        """测试选择撤退结算。"""
        enemy_power = 20
        initial_gold = self.state.gold

        result = resolve_combat_simple(self.state, enemy_power, choice="retreat")
        self.assertFalse(result["victory"])
        self.assertEqual(result["gold_gained"], 0)
        self.assertEqual(self.state.gold, initial_gold)

    def test_state_serialization(self):
        """测试包含士气与日志的 GameState 序列化与反序列化。"""
        self.state.add_log("测试日志1")
        data = self.state.to_dict()
        self.assertEqual(data["morale"], 80)
        self.assertIn("[第 1 天] 测试日志1", data["logs"])

        with tempfile.TemporaryDirectory() as temp_dir:
            filepath = os.path.join(temp_dir, "test_save.json")
            self.state.save(filepath)

            loaded = GameState.load(filepath)
            self.assertEqual(loaded.morale, 80)
            self.assertEqual(loaded.location, "oak_village")
            self.assertEqual(len(loaded.logs), 1)


if __name__ == "__main__":
    unittest.main()
