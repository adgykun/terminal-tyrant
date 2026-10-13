"""跑商经济与募兵晋升系统单元测试模块。"""

import unittest
from core.state import GameState
from core.engine import trade, recruit, upgrade_unit


class TestEconomy(unittest.TestCase):
    """测试跑商交易、士兵招募与兵种晋升系统。"""

    def setUp(self):
        self.state = GameState(
            day=1,
            gold=500,
            location="oak_village",
            morale=100,
            troops={"peasant": 0, "infantry": 0, "archer": 0},
            inventory={"wheat": 0, "iron": 0},
        )

    def test_recruit_success(self):
        """测试在村庄成功招募农民。"""
        # 橡木村(oak_village)招募农民，单价 10 金，招募 5 个，花费 50 金
        initial_gold = self.state.gold
        res = recruit(self.state, "oak_village", "peasant", 5)

        self.assertIn("成功招募 5 农民", res)
        self.assertEqual(self.state.gold, initial_gold - 50)
        self.assertEqual(self.state.troops["peasant"], 5)

    def test_recruit_insufficient_gold(self):
        """测试金钱不足时招募失败。"""
        self.state.gold = 30
        res = recruit(self.state, "oak_village", "peasant", 5)

        self.assertIn("金钱不足", res)
        self.assertEqual(self.state.gold, 30)
        self.assertEqual(self.state.troops["peasant"], 0)

    def test_recruit_invalid_location(self):
        """测试在不允许的地点招募兵种失败。"""
        # 橡木村兵营只允许招募 peasant，尝试招募 infantry 失败
        res = recruit(self.state, "oak_village", "infantry", 1)
        self.assertIn("不可招募", res)
        self.assertEqual(self.state.troops["infantry"], 0)

    def test_upgrade_unit_success(self):
        """测试农民成功晋升为步兵。"""
        # 先准备 5 个农民
        self.state.troops["peasant"] = 5
        initial_gold = self.state.gold  # 500
        # 晋升 3 个农民为步兵，晋升费用 100 金/个，总计 300 金
        res = upgrade_unit(self.state, "peasant", 3)

        self.assertIn("成功将 3 农民 晋升为 3 步兵", res)
        self.assertEqual(self.state.gold, initial_gold - 300)
        self.assertEqual(self.state.troops["peasant"], 2)
        self.assertEqual(self.state.troops["infantry"], 3)

    def test_upgrade_unit_insufficient_troops(self):
        """测试士兵数量不足时晋升失败。"""
        self.state.troops["peasant"] = 1
        res = upgrade_unit(self.state, "peasant", 3)

        self.assertIn("兵员不足", res)
        self.assertEqual(self.state.troops["peasant"], 1)

    def test_upgrade_unit_insufficient_gold(self):
        """测试金钱不足时晋升失败。"""
        self.state.troops["peasant"] = 5
        self.state.gold = 100  # 升级3个需要 300 金
        res = upgrade_unit(self.state, "peasant", 3)

        self.assertIn("金钱不足", res)
        self.assertEqual(self.state.troops["peasant"], 5)
        self.assertEqual(self.state.troops.get("infantry", 0), 0)

    def test_upgrade_unit_invalid_target(self):
        """测试高级兵种无法继续晋升。"""
        self.state.troops["infantry"] = 2
        res = upgrade_unit(self.state, "infantry", 1)

        self.assertIn("无法继续晋升", res)

    def test_trade_buy_and_sell_profit(self):
        """测试跨地点买卖跑商套利交易流程。"""
        # 1. 在橡木村(oak_village)购买 10 个麦子（买价 10金/个，花费 100金）
        initial_gold = self.state.gold  # 500
        res_buy = trade(self.state, "oak_village", "buy", "wheat", 10)
        self.assertIn("成功购买 10 麦子", res_buy)
        self.assertEqual(self.state.gold, initial_gold - 100)
        self.assertEqual(self.state.inventory["wheat"], 10)

        # 2. 假设移动到了河畔镇(river_town)，卖出 10 个麦子（卖价 15金/个，获得 150金）
        res_sell = trade(self.state, "river_town", "sell", "wheat", 10)
        self.assertIn("成功卖出 10 麦子", res_sell)
        self.assertEqual(self.state.inventory["wheat"], 0)
        # 总金币增加 50（买入-100，卖出+150）
        self.assertEqual(self.state.gold, initial_gold + 50)

    def test_trade_buy_insufficient_gold(self):
        """测试金币不足时买入商品失败。"""
        self.state.gold = 5
        res = trade(self.state, "oak_village", "buy", "wheat", 1)
        self.assertIn("金钱不足", res)
        self.assertEqual(self.state.inventory["wheat"], 0)

    def test_trade_sell_insufficient_goods(self):
        """测试背包商品不足时卖出失败。"""
        self.state.inventory["wheat"] = 2
        res = trade(self.state, "oak_village", "sell", "wheat", 5)
        self.assertIn("数量不足", res)
        self.assertEqual(self.state.inventory["wheat"], 2)

    def test_trade_invalid_goods_or_location(self):
        """测试在无此商品的地点交易失败。"""
        # 橡木村 market 只有 wheat，没有 iron
        res = trade(self.state, "oak_village", "buy", "iron", 1)
        self.assertIn("不提供商品", res)


if __name__ == "__main__":
    unittest.main()
