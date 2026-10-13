"""战利品、俘虏与竞技场系统单元测试模块。"""

import unittest
from unittest.mock import patch

from core.data import LOCATIONS, EQUIPMENT, UNITS
from core.engine import (
    resolve_combat_simple,
    sell_prisoners,
    recruit_prisoner,
    arena_fight,
)
from core.state import GameState


class TestLootAndArena(unittest.TestCase):
    """测试装备战利品掉落、俘虏卖买招募与竞技场擂台对决系统。"""

    def setUp(self):
        """测试前准备初始化状态。"""
        self.state = GameState(
            day=1,
            gold=100,
            location="river_town",
            morale=80,
            troops={"peasant": 5, "infantry": 2, "archer": 0},
            renown=10,
            personal_power=10,
        )

    def test_equipment_data_and_locations(self):
        """测试装备字典配置与地点属性增加。"""
        self.assertGreaterEqual(len(EQUIPMENT), 5)
        self.assertIn("w1", EQUIPMENT)
        self.assertEqual(EQUIPMENT["w1"]["name"], "铁剑")
        self.assertEqual(EQUIPMENT["w1"]["type"], "weapon")
        self.assertEqual(EQUIPMENT["w1"]["power_bonus"], 5)

        # 检查所有地点包含 slave_market 属性
        for loc_id, loc in LOCATIONS.items():
            self.assertTrue(loc.get("slave_market", False))

        # 检查城镇地点包含 arena 属性
        self.assertTrue(LOCATIONS["river_town"].get("arena", False))
        self.assertTrue(LOCATIONS["central_city"].get("arena", False))
        self.assertFalse(LOCATIONS["oak_village"].get("arena", False))

        # 检查兵种包含 prisoner_value
        for unit_id, unit in UNITS.items():
            self.assertIn("prisoner_value", unit)

    def test_combat_equipment_bonus_and_loot(self):
        """测试战斗中装备战力加成、俘虏捕获与战利品掉落。"""
        self.state.equipment = {"weapon": "w1"}  # 铁剑 (+5 战力)
        # 军队战力: 5*1 + 2*3 = 11, 个人基础 10, 装备 +5 -> 综合战力 26
        enemy_power = 10

        with patch("random.random", return_value=0.1), patch("random.choice", return_value="w1"):
            result = resolve_combat_simple(self.state, enemy_power, choice="attack")

        self.assertTrue(result["victory"])
        self.assertEqual(result["player_power"], 26)
        # 敌方战力 10 的 50% 转化为俘虏，即 5 个农民俘虏
        self.assertEqual(self.state.prisoners.get("peasant", 0), 5)
        # 掉落了 1 件装备战利品
        self.assertEqual(len(self.state.loot), 1)

    def test_sell_prisoners(self):
        """测试奴隶市场出售俘虏逻辑。"""
        self.state.prisoners = {"peasant": 5}
        initial_gold = self.state.gold

        # 在支持 slave_market 的地点出售 5 个农民俘虏
        res = sell_prisoners(self.state, "river_town", "peasant", 5)
        self.assertIn("成功", res)
        self.assertEqual(self.state.prisoners["peasant"], 0)
        # 农民俘虏单价为 3 金币，5 个共 15 金币
        self.assertEqual(self.state.gold, initial_gold + 15)

        # 俘虏不足再出售失败
        res_fail = sell_prisoners(self.state, "river_town", "peasant", 1)
        self.assertIn("俘虏数量不足", res_fail)

    def test_recruit_prisoner_renown_requirement(self):
        """测试招募俘虏需要 20 声望门槛。"""
        self.state.prisoners = {"peasant": 5}
        self.state.renown = 10  # 低于 20 声望

        # 声望不足招募失败
        res = recruit_prisoner(self.state, "peasant", 3)
        self.assertIn("声望不足", res)
        self.assertEqual(self.state.prisoners["peasant"], 5)
        self.assertEqual(self.state.troops["peasant"], 5)

        # 声望提升至 20 招募成功
        self.state.renown = 20
        res_success = recruit_prisoner(self.state, "peasant", 3)
        self.assertIn("成功", res_success)
        self.assertEqual(self.state.prisoners["peasant"], 2)
        self.assertEqual(self.state.troops["peasant"], 8)

    def test_arena_fight(self):
        """测试城镇竞技场打擂逻辑。"""
        # 非城镇（无竞技场）场所挑战失败
        res_fail = arena_fight(self.state, "oak_village", 3)
        self.assertIn("没有竞技场", res_fail)

        # 在城镇河畔镇打 3 轮擂台，模拟胜负
        initial_gold = self.state.gold
        initial_renown = self.state.renown
        initial_morale = self.state.morale

        # 模拟 3 轮对手战力（两轮低于玩家战力，一轮高于玩家战力）
        # 玩家个人战力 10 + 装备 0 = 10
        with patch("random.uniform", side_effect=[0.8, 0.9, 1.2]):
            res_arena = arena_fight(self.state, "river_town", 3)

        self.assertIn("竞技场结算", res_arena)
        self.assertIn("2 胜 1 败", res_arena)
        # 2 胜得 2 * 100 = 200 金币, 1 败扣 1 * 50 = 50 金币，净增 +150 金币
        self.assertEqual(self.state.gold, initial_gold + 150)
        # 2 胜增加 2 * 5 = 10 声望
        self.assertEqual(self.state.renown, initial_renown + 10)
        # 1 败扣除 10 士气
        self.assertEqual(self.state.morale, initial_morale - 10)


if __name__ == "__main__":
    unittest.main()
