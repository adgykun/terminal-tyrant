"""单元测试模块：测试对话引擎与海量文本库功能。"""

import unittest
from unittest.mock import patch
from core.data import LORE, PERSONALITY_TRAITS, COMPANIONS
from core.dialogues import DIALOGUE_DATABASE
from core.dialogue_engine import get_dialogue, update_memory, LEAVE_PARTY


class TestDialogueSystem(unittest.TestCase):
    """测试性格、记忆与对话引擎系统。"""

    def test_data_structures(self):
        """测试 core/data.py 中新增的设定。"""
        self.assertIn("background", LORE)
        self.assertEqual(len(PERSONALITY_TRAITS), 5)
        for trait in ["hot_headed", "cautious", "greedy", "loyal", "cowardly"]:
            self.assertIn(trait, PERSONALITY_TRAITS)

        for c_id, companion in COMPANIONS.items():
            self.assertIn("personality", companion)
            self.assertIn("memory", companion)
            self.assertIn("greeting", companion)
            self.assertIn(companion["personality"], PERSONALITY_TRAITS)

    def test_total_dialogue_lines_count(self):
        """测试文本库数量超过 200 句且符合格式。"""
        total_lines = 0
        all_lines_set = set()
        for context, personalities in DIALOGUE_DATABASE.items():
            for p_trait, lines in personalities.items():
                self.assertGreaterEqual(len(lines), 3)
                total_lines += len(lines)
                for line in lines:
                    all_lines_set.add(line)

        self.assertGreaterEqual(total_lines, 200)
        self.assertGreaterEqual(len(all_lines_set), 200)

    def test_update_memory(self):
        """测试记忆更新与最多 10 条的遗忘机制。"""
        npc = {"name": "测试NPC", "personality": "greedy", "memory": []}

        for i in range(15):
            update_memory(npc, f"event_{i}")

        self.assertEqual(len(npc["memory"]), 10)
        self.assertEqual(npc["memory"][0], "event_5")
        self.assertEqual(npc["memory"][-1], "event_14")

    def test_get_dialogue_matching(self):
        """测试根据性格和情境匹配对话台词。"""
        npc = {"name": "测试NPC", "personality": "greedy", "memory": []}

        dialogue = get_dialogue(npc, "combat_won")
        self.assertIn(dialogue, DIALOGUE_DATABASE["combat_won"]["greedy"])

        # 测试未知情境使用通用台词
        dialogue_unknown = get_dialogue(npc, "unknown_context_123")
        self.assertIn(dialogue_unknown, DIALOGUE_DATABASE["generic"]["greedy"])

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
            self.assertIn(result, DIALOGUE_DATABASE["combat_lost_fled"]["hot_headed"])


if __name__ == "__main__":
    unittest.main()
