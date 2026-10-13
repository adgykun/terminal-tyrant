"""单元测试模块：测试对话引擎与海量文本库功能。"""

import unittest
from unittest.mock import patch
from core.data import LORE, PERSONALITY_TRAITS, COMPANIONS, ATTITUDE_LEVELS, NPC_MERCHANTS
from core.dialogues import DIALOGUE_DATABASE
from core.dialogue_engine import get_dialogue, update_memory, get_attitude_key, get_formatted_npc_dialogue, LEAVE_PARTY


class TestDialogueSystem(unittest.TestCase):
    """测试性格、记忆、动态态度与对话引擎系统。"""

    def test_data_structures(self):
        """测试 core/data.py 中新增的设定。"""
        self.assertIn("background", LORE)
        self.assertEqual(len(PERSONALITY_TRAITS), 5)
        for trait in ["hot_headed", "cautious", "greedy", "loyal", "cowardly"]:
            self.assertIn(trait, PERSONALITY_TRAITS)

        self.assertIn("contempt", ATTITUDE_LEVELS)
        self.assertIn("fawning", ATTITUDE_LEVELS)

        self.assertIn("tavern_keeper", NPC_MERCHANTS)
        self.assertIn("blacksmith", NPC_MERCHANTS)
        self.assertIn("arena_host", NPC_MERCHANTS)

        for c_id, companion in COMPANIONS.items():
            self.assertIn("personality", companion)
            self.assertIn("memory", companion)
            self.assertIn("greeting", companion)
            self.assertIn(companion["personality"], PERSONALITY_TRAITS)

    def test_total_dialogue_lines_count(self):
        """测试文本库数量超过 300 句且符合三级层级格式。"""
        total_lines = 0
        all_lines_set = set()
        for context, attitudes in DIALOGUE_DATABASE.items():
            self.assertIsInstance(attitudes, dict)
            for att, personalities in attitudes.items():
                self.assertIsInstance(personalities, dict)
                for p_trait, lines in personalities.items():
                    self.assertGreaterEqual(len(lines), 2)
                    total_lines += len(lines)
                    for line in lines:
                        all_lines_set.add(line)

        self.assertGreaterEqual(total_lines, 300)
        self.assertGreaterEqual(len(all_lines_set), 250)

    def test_update_memory(self):
        """测试记忆更新与最多 10 条的遗忘机制。"""
        npc = {"name": "测试NPC", "personality": "greedy", "memory": []}

        for i in range(15):
            update_memory(npc, f"event_{i}")

        self.assertEqual(len(npc["memory"]), 10)
        self.assertEqual(npc["memory"][0], "event_5")
        self.assertEqual(npc["memory"][-1], "event_14")

    def test_attitude_calculation(self):
        """测试声望与心情动态计算态度基调。"""
        class DummyState:
            def __init__(self, renown=0):
                self.renown = renown
                self.npc_states = {
                    "tavern_keeper": {"mood": "neutral"},
                    "blacksmith": {"mood": "angry"},
                    "arena_host": {"mood": "happy"},
                }

        state_low = DummyState(50)  # contempt
        state_high = DummyState(1200)  # fawning

        self.assertEqual(get_attitude_key(state_low, "tavern_keeper"), "contempt")
        self.assertEqual(get_attitude_key(state_low, "blacksmith"), "contempt")  # 0 - 1 -> 0
        self.assertEqual(get_attitude_key(state_low, "arena_host"), "neutral")   # 0 + 1 -> 1

        self.assertEqual(get_attitude_key(state_high, "tavern_keeper"), "fawning")
        self.assertEqual(get_attitude_key(state_high, "blacksmith"), "respect")  # 3 - 1 -> 2
        self.assertEqual(get_attitude_key(state_high, "arena_host"), "fawning")  # 3 + 1 -> 3

    def test_get_dialogue_matching(self):
        """测试根据性格和态度匹配对话台词。"""
        npc = {"name": "测试NPC", "personality": "greedy", "memory": []}

        class DummyState:
            def __init__(self, renown=100):
                self.renown = renown
                self.npc_states = {}

        state = DummyState(50)  # contempt
        dialogue = get_dialogue(npc, "enter_tavern", state)
        self.assertIn(dialogue, DIALOGUE_DATABASE["enter_tavern"]["contempt"]["greedy"])

        state_fawn = DummyState(2000)  # fawning
        dialogue_fawn = get_dialogue(npc, "enter_tavern", state_fawn)
        self.assertIn(dialogue_fawn, DIALOGUE_DATABASE["enter_tavern"]["fawning"]["greedy"])

        # 测试未知情境使用通用台词
        dialogue_unknown = get_dialogue(npc, "unknown_context_123", state)
        self.assertIn(dialogue_unknown, DIALOGUE_DATABASE["generic"]["contempt"]["greedy"])

    def test_formatted_npc_dialogue(self):
        """测试动态生成的带称号与态度标签的格式化台词。"""
        class DummyState:
            def __init__(self, renown=50):
                self.renown = renown
                self.npc_states = {"tavern_keeper": {"mood": "neutral"}}

        state = DummyState(50)
        formatted = get_formatted_npc_dialogue("tavern_keeper", "enter_tavern", state)
        self.assertTrue(formatted.startswith("[贪婪的酒馆老板] (蔑视地): “"))
        self.assertTrue(formatted.endswith("”"))

    def test_hot_headed_leave_party_probability(self):
        """测试暴躁性格在撤退时概率触发离队标记。"""
        npc = {"name": "暴躁将领", "personality": "hot_headed", "memory": []}

        # 模拟 random.random < 0.5
        with patch("random.random", return_value=0.1):
            result = get_dialogue(npc, "combat_lost_fled")
            self.assertEqual(result, LEAVE_PARTY)

        # 模拟 random.random >= 0.5
        with patch("random.random", return_value=0.9):
            result = get_dialogue(npc, "combat_lost_fled")
            self.assertNotEqual(result, LEAVE_PARTY)


if __name__ == "__main__":
    unittest.main()
