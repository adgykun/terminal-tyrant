"""Phase 9 单元测试：硬核钓鱼系统与士气/粮食惩罚重构。"""

import unittest
from core.state import GameState
from core.data import FISH_LOOT_TABLE, FISHING_GEAR
from core.engine import (
    buy_gear,
    fish,
    sell_fish,
    daily_update,
    resolve_combat_simple,
)


class TestPhase9FishingAndMorale(unittest.TestCase):
    """测试钓鱼功能、同伴自动钓鱼、卖鱼以及重构后的士气与脱队逻辑。"""

    def setUp(self):
        self.state = GameState(
            day=1,
            gold=500,
            location="river_town",  # terrain_type: "river"
            morale=100,
            troops={"peasant": 5, "archer": 2, "infantry": 1},
            food=50,
            companions=["c1"],  # c1 (老练商人): likes_fishing = True
        )

    def test_buy_gear(self):
        """测试购买鱼竿和饵料。"""
        # 购买鱼竿
        res = buy_gear(self.state, "rod")
        self.assertIn("成功购买 [鱼竿]", res)
        self.assertTrue(self.state.equipment_gear["rod"])
        self.assertEqual(self.state.cash, 400)

        # 重复购买鱼竿拦截
        res_dup = buy_gear(self.state, "rod")
        self.assertIn("已经拥有鱼竿", res_dup)

        # 购买 10 个饵料
        res_bait = buy_gear(self.state, "bait", 10)
        self.assertIn("成功购买 10 个 [饵料]", res_bait)
        self.assertEqual(self.state.bait_count, 10)
        self.assertEqual(self.state.cash, 380)

    def test_fishing_location_validation(self):
        """测试只有水源地才可以钓鱼。"""
        self.state.equipment_gear["rod"] = True
        self.state.bait_count = 5

        # 平原地点不可钓鱼
        self.state.location = "oak_village"  # terrain_type: "plain"
        res = fish(self.state, self.state.location)
        self.assertIn("不是水源地", res)

        # 河流地点可以钓鱼
        self.state.location = "river_town"  # terrain_type: "river"
        res_river = fish(self.state, self.state.location)
        self.assertIn("你钓到了", res_river)

    def test_fishing_gear_validation(self):
        """测试钓鱼需要鱼竿与饵料。"""
        self.state.location = "river_town"

        # 无鱼竿
        res = fish(self.state, self.state.location)
        self.assertIn("你没有鱼竿", res)

        # 有鱼竿无饵料
        self.state.equipment_gear["rod"] = True
        res_no_bait = fish(self.state, self.state.location)
        self.assertIn("你的饵料用尽了", res_no_bait)

    def test_fishing_execution_and_time_food_pass(self):
        """测试钓鱼消耗 1 饵料、消耗 1 天时间并触发耗粮。"""
        self.state.equipment_gear["rod"] = True
        self.state.bait_count = 3
        initial_day = self.state.day
        initial_food = self.state.food

        res = fish(self.state, self.state.location)

        self.assertEqual(self.state.bait_count, 2)
        self.assertEqual(self.state.day, initial_day + 1)
        self.assertLess(self.state.food, initial_food)
        self.assertIn("你钓到了", res)

        # 验证钓鱼产物绝无武器
        for fish_id in self.state.fish_inventory:
            self.assertIn(fish_id, FISH_LOOT_TABLE)

    def test_companion_fishing_bonus(self):
        """测试喜欢钓鱼的同伴有概率额外钓到鱼。"""
        self.state.equipment_gear["rod"] = True
        self.state.bait_count = 100
        # 增加触发次数保证同伴钓到鱼
        triggered = False
        for _ in range(20):
            res = fish(self.state, self.state.location)
            if "也钓到了一条" in res:
                triggered = True
                break
        self.assertTrue(triggered)

    def test_sell_fish(self):
        """测试卖鱼与物品。"""
        self.state.fish_inventory = {"crucian_carp": 2, "old_boot": 1}

        # 卖 1 0 价值的破靴子
        res_boot = sell_fish(self.state, "old_boot", 1)
        self.assertIn("成功卖出 1 个 [破靴子]", res_boot)
        self.assertEqual(self.state.fish_inventory["old_boot"], 0)

        # 卖 2 条鲫鱼 (单价 10)
        initial_gold = self.state.cash
        res_carp = sell_fish(self.state, "crucian_carp", 2)
        self.assertIn("成功卖出 2 个 [鲫鱼]", res_carp)
        self.assertEqual(self.state.cash, initial_gold + 20)
        self.assertEqual(self.state.fish_inventory["crucian_carp"], 0)

    def test_combat_defeat_morale_penalty(self):
        """测试战斗失败扣除 20 士气。"""
        initial_morale = self.state.morale
        # 模拟战败
        self.state.troops = {"peasant": 0}
        self.state.personal_power = 0
        resolve_combat_simple(self.state, enemy_power=100, choice="attack")

        # 每日结算应用战败扣减
        daily_update(self.state)
        self.assertEqual(self.state.morale, initial_morale - 20)

    def test_food_shortage_morale_penalty(self):
        """测试粮食 <= 0 扣除 10 士气。"""
        self.state.food = 0
        initial_morale = self.state.morale
        daily_update(self.state)
        self.assertEqual(self.state.morale, initial_morale - 10)

    def test_low_morale_desertion(self):
        """测试士气 < 30 时士兵流失逃跑。"""
        self.state.morale = 20
        self.state.troops = {"peasant": 5, "infantry": 3}
        initial_army_count = sum(self.state.troops.values())

        report = daily_update(self.state)

        self.assertIn("⚠️ 士气低落，士兵正在逃跑！", report)
        current_army_count = sum(self.state.troops.values())
        self.assertGreater(initial_army_count, current_army_count)
        # 最低级兵种农民优先流失
        self.assertLess(self.state.troops["peasant"], 5)


if __name__ == "__main__":
    unittest.main()
