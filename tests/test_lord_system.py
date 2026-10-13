"""领主系统逻辑单元测试模块。"""

import unittest
from core.state import GameState
from core.engine import (
    hire_companion,
    conquer_location,
    daily_update,
    recruit,
    trade,
)


class TestLordSystem(unittest.TestCase):
    """测试同伴招募、封地征服与每日粮草/税收结算。"""

    def setUp(self):
        from core.data import LOCATIONS
        for loc in LOCATIONS.values():
            if loc.get("type") in ["town", "village"]:
                loc["owner"] = "neutral"

        self.state = GameState(
            day=1,
            gold=1000,
            location="river_town",
            morale=100,
            troops={"peasant": 10, "infantry": 5, "archer": 0},
            inventory={"wheat": 0},
            logs=[],
            companions=[],
            fiefs=[],
            renown=60,
            food=100,
            max_army_size=20,
        )

    def test_hire_companion_success(self):
        """测试成功招募同伴及属性加成。"""
        # 招募老练商人 (c1, 花费 500 金)
        res = hire_companion(self.state, "c1")
        self.assertIn("成功招募", res)
        self.assertIn("c1", self.state.companions)
        self.assertEqual(self.state.cash, 500)

        # 招募百战将领 (c2, 花费 600 金 -> 之前剩 500，再加钱)
        self.state.cash = 1000
        initial_max_army = self.state.max_army_size
        res2 = hire_companion(self.state, "c2")
        self.assertIn("成功招募", res2)
        self.assertIn("c2", self.state.companions)
        self.assertEqual(self.state.max_army_size, initial_max_army + 10)

    def test_hire_companion_failures(self):
        """测试声望不足、金钱不足及重复招募的拦截机制。"""
        self.state.renown = 0
        res = hire_companion(self.state, "c2")  # c2 需要 20 声望
        self.assertIn("声望不足", res)

        self.state.renown = 100
        self.state.cash = 10
        res = hire_companion(self.state, "c1")  # c1 需要 500 金
        self.assertIn("金钱不足", res)

        self.state.cash = 1000
        hire_companion(self.state, "c1")
        res_dup = hire_companion(self.state, "c1")
        self.assertIn("已经招募过", res_dup)

    def test_conquer_location_loot(self):
        """测试掠夺城镇逻辑。"""
        initial_gold = self.state.cash
        initial_renown = self.state.renown
        res = conquer_location(self.state, "oak_village", "loot")

        self.assertIn("对 [橡木村] 进行了掠夺", res)
        self.assertGreater(self.state.cash, initial_gold)
        self.assertEqual(self.state.renown, initial_renown - 10)

    def test_conquer_location_occupy(self):
        """测试占领城镇为封地逻辑。"""
        # 声望不足拦截
        self.state.renown = 30
        res_fail = conquer_location(self.state, "oak_village", "occupy")
        self.assertIn("声望不足", res_fail)

        # 声望足够占领
        self.state.renown = 60
        res_succ = conquer_location(self.state, "oak_village", "occupy")
        self.assertIn("成功占领", res_succ)
        self.assertIn("oak_village", self.state.fiefs)
        self.assertEqual(self.state.renown, 80)

    def test_daily_update_tax_and_food(self):
        """测试每日税收与粮草消耗结算。"""
        self.state.fiefs = ["oak_village", "river_town"]  # 税收: 20 + 50 = 70
        self.state.troops = {"peasant": 10, "infantry": 5, "archer": 0}  # 消耗: 10*0.5 + 5*1.0 = 10.0
        initial_gold = self.state.cash
        initial_food = self.state.food

        report = daily_update(self.state)

        self.assertIn("税收增加：70 金", report)
        self.assertEqual(self.state.cash, initial_gold + 70)
        self.assertEqual(self.state.food, initial_food - 10.0)

    def test_food_shortage_penalty(self):
        """测试断粮惩罚及士气归零军队解散机制。"""
        self.state.food = 2.0
        self.state.troops = {"peasant": 10, "infantry": 10}  # 每日消耗 15 粮
        self.state.morale = 10  # 低士气

        # 每日结算，粮草不足耗尽 -> 粮草归0，士气 -20 (归0) -> 触发半数军队解散
        report = daily_update(self.state)

        self.assertEqual(self.state.food, 0.0)
        self.assertEqual(self.state.morale, 50)  # 解散后恢复至 50
        self.assertIn("军队士气归零崩盘", report)
        # 初始总兵力 20，解散 10 人 (优先解散 10 个农民)
        self.assertEqual(self.state.troops["peasant"], 0)
        self.assertEqual(self.state.troops["infantry"], 10)

    def test_recruit_max_army_size(self):
        """测试带兵上限对招募的拦截限制。"""
        self.state.max_army_size = 15
        self.state.troops = {"peasant": 10, "infantry": 4}  # 当前 14 人

        res = recruit(self.state, "river_town", "infantry", 2)
        self.assertIn("超出带兵上限", res)

    def test_buy_grain(self):
        """测试购买粮食指令。"""
        initial_food = self.state.food
        initial_gold = self.state.cash

        res = trade(self.state, "river_town", "buy", "grain", 5)
        self.assertIn("成功购买 5 单位粮食", res)
        self.assertEqual(self.state.food, initial_food + 50)
        self.assertEqual(self.state.cash, initial_gold - 50)


if __name__ == "__main__":
    unittest.main()
