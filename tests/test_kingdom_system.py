"""自立为王系统单元测试模块。"""

import unittest
from core.state import GameState
from core.engine import (
    declare_kingdom,
    assign_lord,
    set_policy,
    daily_update,
)
from core.data import POLICIES, LOCATIONS


class TestKingdomSystem(unittest.TestCase):
    """测试自立为王系统、政策制定与领主分封逻辑。"""

    def setUp(self):
        self.state = GameState()
        # 重置地点 owner 状态
        for loc in LOCATIONS.values():
            loc["owner"] = "neutral"

    def test_declare_kingdom_conditions(self):
        """测试建国条件判断（声望>=500且封地>=3）。"""
        # 1. 不满足声望和封地
        res = declare_kingdom(self.state, "大汉")
        self.assertFalse(self.state.is_king)
        self.assertIn("声望不足", res)

        # 2. 满足声望但不满足封地
        self.state.renown = 600
        self.state.fiefs = ["oak_village", "pine_village"]
        res = declare_kingdom(self.state, "大汉")
        self.assertFalse(self.state.is_king)
        self.assertIn("封地不足", res)

        # 3. 满足所有条件
        self.state.fiefs.append("river_town")
        res = declare_kingdom(self.state, "大汉")
        self.assertTrue(self.state.is_king)
        self.assertEqual(self.state.kingdom_name, "大汉")
        self.assertIn("成功建立王国", res)

        # 4. 重复建国
        res_repeat = declare_kingdom(self.state, "大唐")
        self.assertIn("无需重复建国", res_repeat)

    def test_assign_lord(self):
        """测试分封领主逻辑。"""
        # 未建国无法分封
        self.state.companions = ["c1"]
        self.state.fiefs = ["river_town"]
        res = assign_lord(self.state, "c1", "river_town")
        self.assertIn("尚未建国", res)

        # 建国后分封
        self.state.is_king = True
        res = assign_lord(self.state, "c1", "river_town")
        self.assertIn("成功分封同伴", res)
        self.assertIn("c1", self.state.lords)
        self.assertEqual(LOCATIONS["river_town"]["owner"], "lord")

        # 重复分封已成为领主的同伴
        res_dup = assign_lord(self.state, "c1", "pine_village")
        self.assertIn("已经被分封为领主", res_dup)

        # 分封未招募的同伴
        res_unhired = assign_lord(self.state, "c2", "pine_village")
        self.assertIn("未招募同伴", res_unhired)

    def test_policy_effects(self):
        """测试政策制定与每日结算叠加效果。"""
        self.state.is_king = True
        self.state.fiefs = ["river_town"]  # tax_income = 50
        self.state.gold = 100
        self.state.morale = 80
        self.state.renown = 100

        # 测试重税政策: 税收 * 1.5 = 75，士气 -5
        set_policy(self.state, "tax_high")
        self.assertEqual(self.state.current_policy, "tax_high")

        daily_update(self.state)
        self.assertEqual(self.state.gold, 175)  # 100 + 75
        self.assertEqual(self.state.morale, 75)  # 80 - 5

        # 测试切换为轻薄赋政策: 税收 * 0.8 = 40，士气 +5
        set_policy(self.state, "tax_low")
        daily_update(self.state)
        self.assertEqual(self.state.gold, 215)  # 175 + 40
        self.assertEqual(self.state.morale, 80)  # 75 + 5

        # 测试切换为强制征兵政策: 带兵上限 +20，声望每日 -2
        initial_max_army = self.state.max_army_size
        set_policy(self.state, "conscription")
        self.assertEqual(self.state.max_army_size, initial_max_army + 20)

        daily_update(self.state)
        self.assertEqual(self.state.renown, 98)  # 100 - 2

        # 切换回其他政策，带兵上限恢复
        set_policy(self.state, "tax_low")
        self.assertEqual(self.state.max_army_size, initial_max_army)

    def test_lord_tax_and_policy_combination(self):
        """测试领主代管（税收减半）与重税政策叠加效果。"""
        self.state.is_king = True
        self.state.fiefs = ["river_town"]  # 基础税收 50
        LOCATIONS["river_town"]["owner"] = "lord"
        self.state.companions = ["c1"]
        self.state.lords = ["c1"]
        self.state.gold = 0

        # 领主代管基础税收为 25；叠加重税 1.5 倍 -> 37.5 -> 37 金
        set_policy(self.state, "tax_high")
        daily_update(self.state)
        self.assertEqual(self.state.gold, 37)

    def test_state_serialization(self):
        """测试 GameState 序列化与反序列化包含自立为王相关数据。"""
        self.state.is_king = True
        self.state.kingdom_name = "大秦"
        self.state.current_policy = "tax_high"
        self.state.lords = ["c1"]

        data_dict = self.state.to_dict()
        self.assertTrue(data_dict["is_king"])
        self.assertEqual(data_dict["kingdom_name"], "大秦")
        self.assertEqual(data_dict["current_policy"], "tax_high")
        self.assertEqual(data_dict["lords"], ["c1"])

        new_state = GameState.from_dict(data_dict)
        self.assertTrue(new_state.is_king)
        self.assertEqual(new_state.kingdom_name, "大秦")
        self.assertEqual(new_state.current_policy, "tax_high")
        self.assertEqual(new_state.lords, ["c1"])


if __name__ == "__main__":
    unittest.main()
