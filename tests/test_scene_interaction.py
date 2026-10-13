"""单元测试模块：测试场景交互与动态性格/状态对话系统 (Phase 11 Part 2)。"""

import unittest
from unittest.mock import patch
from core.state import GameState
from core.engine import visit_tavern, visit_smithy, visit_arena
from core.dialogue_engine import get_attitude_key, get_formatted_npc_dialogue


class TestSceneInteractionAndDynamicDialogue(unittest.TestCase):
    """测试酒馆、铁匠铺、竞技场交互与 NPC 动态心情/态度变迁。"""

    def setUp(self):
        self.state = GameState(gold=200, renown=50)

    def test_npc_states_initialization_and_serialization(self):
        """测试 GameState 中 npc_states 默认状态与 JSON 序列化。"""
        self.assertIn("tavern_keeper", self.state.npc_states)
        self.assertIn("blacksmith", self.state.npc_states)
        self.assertIn("arena_host", self.state.npc_states)

        self.assertEqual(self.state.npc_states["tavern_keeper"]["mood"], "neutral")

        # 修改心情并测试 to_dict / from_dict
        self.state.npc_states["tavern_keeper"]["mood"] = "happy"
        data = self.state.to_dict()
        restored = GameState.from_dict(data)
        self.assertEqual(restored.npc_states["tavern_keeper"]["mood"], "happy")

    def test_visit_tavern_drinking_and_rumors(self):
        """测试在酒馆喝酒与听传闻，以及老板心情变好。"""
        # 低声望 (50) + neutral mood -> contempt
        welcome = get_formatted_npc_dialogue("tavern_keeper", "enter_tavern", self.state)
        self.assertIn("蔑视地", welcome)

        res = visit_tavern(self.state, action="drink", tip_amount=20)
        self.assertTrue(res["success"])
        self.assertEqual(self.state.gold, 180)
        self.assertEqual(self.state.npc_states["tavern_keeper"]["mood"], "happy")
        self.assertIn("老板收了你的钱，脸色好多了", res["message"])

        # 心情变为 happy 后，态度由 contempt 提升为 neutral
        new_dialogue = get_formatted_npc_dialogue("tavern_keeper", "enter_tavern", self.state)
        self.assertIn("平静地", new_dialogue)

        # 测试打听传闻
        rumor_res = visit_tavern(self.state, action="rumor")
        self.assertTrue(rumor_res["success"])
        self.assertIn("酒馆小道消息", rumor_res["message"])

    def test_visit_smithy_upgrade_success_and_failure(self):
        """测试铁匠铺升级装备成功与金钱/铁块不足时的嘲讽和愤怒心情。"""
        # 1. 资源不足 (缺少铁块)
        fail_res = visit_smithy(self.state, action="upgrade")
        self.assertFalse(fail_res["success"])
        self.assertEqual(self.state.npc_states["blacksmith"]["mood"], "angry")
        self.assertIn("暴躁的铁匠", fail_res["dialogue"])

        # 低声望 (50) + angry mood -> contempt
        self.assertIn("蔑视地", fail_res["dialogue"])

        # 2. 给予铁块与足够金钱进行升级
        self.state.inventory["iron"] = 2
        initial_power = self.state.personal_power

        success_res = visit_smithy(self.state, action="upgrade")
        self.assertTrue(success_res["success"])
        self.assertEqual(self.state.gold, 100)
        self.assertEqual(self.state.inventory["iron"], 1)
        self.assertEqual(self.state.personal_power, initial_power + 3)
        self.assertEqual(self.state.npc_states["blacksmith"]["mood"], "happy")

        # 升级成功后的台词
        self.assertIn("暴躁的铁匠", success_res["dialogue"])

    def test_visit_arena_bet_win_and_lose(self):
        """测试竞技场押注赢与输对主持人心情的影响。"""
        # 1. 模拟押注胜利
        with patch("random.random", return_value=0.1):  # win
            res_win = visit_arena(self.state, action="bet", bet_amount=50)
            self.assertTrue(res_win["success"])
            self.assertEqual(self.state.gold, 250)  # 200 - 50 + 100
            self.assertEqual(self.state.npc_states["arena_host"]["mood"], "happy")
            self.assertIn("谨慎的竞技场主持人", res_win["dialogue"])

        # 2. 模拟押注失败
        with patch("random.random", return_value=0.9):  # lose
            res_lose = visit_arena(self.state, action="bet", bet_amount=50)
            self.assertFalse(res_lose["success"])
            self.assertEqual(self.state.gold, 200)  # 250 - 50
            self.assertEqual(self.state.npc_states["arena_host"]["mood"], "angry")
            self.assertIn("谨慎的竞技场主持人", res_lose["dialogue"])

    def test_renown_attitude_levels(self):
        """测试声望等级 (蔑视 -> 中立 -> 尊敬 -> 谄媚) 与态度变化。"""
        # 声望 < 100 -> contempt
        self.state.renown = 10
        self.assertEqual(get_attitude_key(self.state, "tavern_keeper"), "contempt")

        # 声望 100-500 -> neutral
        self.state.renown = 300
        self.assertEqual(get_attitude_key(self.state, "tavern_keeper"), "neutral")

        # 声望 501-1000 -> respect
        self.state.renown = 800
        self.assertEqual(get_attitude_key(self.state, "tavern_keeper"), "respect")

        # 声望 > 1000 -> fawning
        self.state.renown = 1500
        self.assertEqual(get_attitude_key(self.state, "tavern_keeper"), "fawning")


if __name__ == "__main__":
    unittest.main()
