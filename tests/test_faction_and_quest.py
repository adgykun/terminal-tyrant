"""势力外交与任务系统逻辑单元测试。"""

import unittest
from core.state import GameState
from core.data import LOCATIONS, FACTIONS, QUEST_TEMPLATES, GOODS
from core.engine import (
    update_faction_relations,
    generate_quests,
    accept_quest,
    complete_quest,
    daily_update,
    resolve_combat_simple,
)


class TestFactionAndQuest(unittest.TestCase):
    """测试势力关系、任务生成、接取与完成逻辑。"""

    def setUp(self):
        """每个测试用例前初始化状态。"""
        self.state = GameState()

    def test_faction_relations_initialization(self):
        """测试势力关系初始值。"""
        self.assertIn("f1", self.state.faction_relations)
        self.assertIn("f2", self.state.faction_relations)
        self.assertIn("f3", self.state.faction_relations)
        self.assertEqual(self.state.faction_relations["f1"], 0)

    def test_generate_quests(self):
        """测试城镇任务生成。"""
        town_id = "river_town"
        generate_quests(town_id)
        active_quests = LOCATIONS[town_id].get("active_quests", [])
        self.assertEqual(len(active_quests), 3)

    def test_accept_and_complete_deliver_goods_quest(self):
        """测试接取并完成运送商品任务。"""
        q_id = "test_deliver_1"
        test_quest = {
            "id": q_id,
            "type": "deliver_goods",
            "desc": "将 5 单位 麦子 从 河畔镇 运到 铁矿镇",
            "reward_cash": 300,
            "reward_renown": 15,
            "goods_id": "wheat",
            "amount": 5,
            "target_location": "iron_town",
            "location_id": "river_town",
        }
        LOCATIONS["river_town"]["active_quests"] = [test_quest]
        self.state.location = "river_town"

        # 接取任务
        res_accept = accept_quest(self.state, q_id)
        self.assertIn("成功接取任务", res_accept)
        self.assertEqual(len(self.state.active_quests), 1)

        # 尝试完成（处于错误地点）
        res_fail_loc = complete_quest(self.state, q_id)
        self.assertIn("尚未到达目标地点", res_fail_loc)

        # 移动至目标地点但无足够商品
        self.state.location = "iron_town"
        res_fail_goods = complete_quest(self.state, q_id)
        self.assertIn("货物不足", res_fail_goods)

        # 给予商品并成功完成
        self.state.inventory["wheat"] = 10
        initial_gold = self.state.gold
        initial_renown = self.state.renown

        res_success = complete_quest(self.state, q_id)
        self.assertIn("成功完成任务", res_success)
        self.assertEqual(self.state.gold, initial_gold + 300)
        self.assertEqual(self.state.renown, initial_renown + 15)
        self.assertEqual(self.state.inventory["wheat"], 5)
        self.assertEqual(len(self.state.active_quests), 0)
        self.assertIn(q_id, self.state.completed_quests)

    def test_combat_reduces_faction_relation(self):
        """测试在某势力领地战斗扣减关系。"""
        self.state.location = "river_town"  # 属于 f1 势力
        f1_rel_before = self.state.faction_relations.get("f1", 0)

        resolve_combat_simple(self.state, enemy_power=5, choice="attack")

        f1_rel_after = self.state.faction_relations.get("f1", 0)
        self.assertEqual(f1_rel_after, f1_rel_before - 10)

    def test_daily_update_triggers_relations_and_quests(self):
        """测试每日更新触发势力关系演变与任务生成。"""
        daily_update(self.state)
        for loc_id, loc_info in LOCATIONS.items():
            if loc_info.get("type") == "town":
                self.assertGreaterEqual(len(loc_info.get("active_quests", [])), 1)


if __name__ == "__main__":
    unittest.main()
