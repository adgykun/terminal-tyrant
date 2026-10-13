"""Phase 12 & 13 终极更新单元测试模块。"""

import unittest
import random
from core.state import GameState
from core.engine import (
    create_character,
    reveal_appearance,
    trigger_admirer_event,
    get_battle_companion_quote,
    recruit,
    resolve_combat_simple,
    get_total_appearance,
)


class TestPhase12And13(unittest.TestCase):
    """验证属性外貌盲盒系统与战斗同伴语音核心逻辑。"""

    def setUp(self):
        self.state = GameState(
            day=1,
            gold=1000,
            location="oak_village",
            morale=100,
            troops={"peasant": 0, "infantry": 0, "archer": 0},
        )

    def test_create_character_valid(self):
        """测试合法的属性加点与随机外貌生成。"""
        create_character(self.state, 5, 5, 5)
        self.assertEqual(self.state.attributes, {"strength": 5, "intellect": 5, "charm": 5})
        self.assertTrue(1 <= self.state.appearance <= 100)
        self.assertFalse(self.state.appearance_revealed)

    def test_create_character_invalid_total(self):
        """测试点数总和不等于 15 时抛出异常。"""
        with self.assertRaises(ValueError):
            create_character(self.state, 6, 6, 6)

    def test_create_character_invalid_range(self):
        """测试单项属性不在 1-10 范围时抛出异常。"""
        with self.assertRaises(ValueError):
            create_character(self.state, 15, 0, 0)

    def test_reveal_appearance(self):
        """测试外貌揭晓描述生成与状态更新。"""
        self.state.appearance = 98
        res = reveal_appearance(self.state)
        self.assertTrue(self.state.appearance_revealed)
        self.assertIn("绝世容颜/倾国倾城", res)

    def test_charm_recruit_discount(self):
        """测试魅力值对士兵招募费用的折扣效果。"""
        # 魅力为 10，折扣 20%，农民基础费用 10 -> 折扣后 8 金/人，招募 5 人需 40 金
        self.state.attributes["charm"] = 10
        initial_gold = self.state.gold
        res = recruit(self.state, "oak_village", "peasant", 5)
        self.assertIn("成功招募 5 农民", res)
        self.assertEqual(self.state.gold, initial_gold - 40)

    def test_admirer_event_trigger(self):
        """测试极高外貌触发倒贴事件。"""
        self.state.appearance = 99
        res = trigger_admirer_event(self.state)
        self.assertIn("【仰慕者倾心】", res)
        self.assertTrue(self.state.gold > 1000 or len(self.state.loot) > 0)

    def test_hideous_appearance_combat_intimidate(self):
        """测试极丑外貌恐吓敌方降士气效果。"""
        self.state.appearance = 5
        res = resolve_combat_simple(self.state, 20, "retreat")
        self.assertIn("你的凶恶面容让敌人感到恐惧，敌方士气大减！", res["message"])

    def test_battle_companion_quotes(self):
        """测试招募同伴后获取战场实时吐槽台词。"""
        self.state.companions = ["c1", "c2"]
        quotes = get_battle_companion_quote(self.state, "combat_round")
        self.assertEqual(len(quotes), 2)
        self.assertTrue(quotes[0].startswith("[老练商人]:"))
        self.assertTrue(quotes[1].startswith("[百战将领]:"))

    def test_equipment_appearance_bonus(self):
        """测试装备外貌加成计算。"""
        self.state.appearance = 50
        self.state.equipment["clothing"] = "c1"  # 华丽丝绸 +15 外貌加成
        self.assertEqual(get_total_appearance(self.state), 65)

    def test_state_serialization(self):
        """测试新增字段的 JSON 字典反序列化兼容。"""
        self.state.attributes = {"strength": 7, "intellect": 4, "charm": 4}
        self.state.appearance = 88
        self.state.appearance_revealed = True
        self.state.current_equipment = {"clothing": "c1"}

        data = self.state.to_dict()
        new_state = GameState.from_dict(data)

        self.assertEqual(new_state.attributes, {"strength": 7, "intellect": 4, "charm": 4})
        self.assertEqual(new_state.appearance, 88)
        self.assertTrue(new_state.appearance_revealed)
        self.assertEqual(new_state.current_equipment, {"clothing": "c1"})


if __name__ == "__main__":
    unittest.main()
