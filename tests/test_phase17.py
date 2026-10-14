"""单元测试模块：验证 Phase 17「经济真实感」——产业链加工与讨价还价。"""

import unittest
from unittest.mock import patch

from core.state import GameState
from core.data import RECIPES, FACILITY_NAMES, GOODS, LOCATIONS
from core.dialogues import DIALOGUE_DATABASE
from core.engine import (
    has_facility,
    list_recipes,
    commission_crafting,
    haggle_trade,
    trade,
)


class TestPhase17Data(unittest.TestCase):
    def test_recipes_structure(self):
        for rid, r in RECIPES.items():
            self.assertEqual(r["id"], rid)
            for key in ["name", "facility", "input_goods", "input_amount", "fee", "output_goods", "output_amount"]:
                self.assertIn(key, r)
            self.assertIn(r["input_goods"], GOODS)
            self.assertIn(r["output_goods"], GOODS)

    def test_processed_goods_exist(self):
        self.assertIn("wine", GOODS)
        self.assertIn("tool", GOODS)
        self.assertTrue(GOODS["wine"].get("processed"))

    def test_town_facilities(self):
        self.assertTrue(has_facility("river_town", "winery"))
        self.assertTrue(has_facility("iron_town", "forge"))
        self.assertFalse(has_facility("oak_village", "winery"))
        self.assertIn("winery", FACILITY_NAMES)

    def test_haggle_dialogue_structure(self):
        for ctx in ["haggle_win", "haggle_ok", "haggle_fail"]:
            self.assertIn(ctx, DIALOGUE_DATABASE)
            for attitude in ["contempt", "neutral", "respect", "fawning"]:
                lines = DIALOGUE_DATABASE[ctx][attitude]["greedy"]
                self.assertGreaterEqual(len(lines), 2)


class TestPhase17Crafting(unittest.TestCase):
    def test_list_recipes_by_location(self):
        self.assertEqual([r["id"] for r in list_recipes("river_town")], ["brew_wine"])
        self.assertEqual([r["id"] for r in list_recipes("iron_town")], ["forge_tool"])
        self.assertEqual(len(list_recipes("central_city")), 2)
        self.assertEqual(list_recipes("oak_village"), [])

    def test_brew_wine_success(self):
        state = GameState(gold=100, location="river_town", inventory={"wheat": 5, "iron": 0})
        res = commission_crafting(state, "brew_wine")
        self.assertIn("酿酒", res)
        self.assertEqual(state.inventory["wheat"], 2)
        self.assertEqual(state.gold, 90)
        self.assertEqual(state.inventory.get("wine"), 1)

    def test_craft_no_facility(self):
        state = GameState(gold=100, location="oak_village", inventory={"wheat": 5})
        res = commission_crafting(state, "brew_wine")
        self.assertIn("没有", res)
        self.assertEqual(state.inventory["wheat"], 5)
        self.assertEqual(state.gold, 100)

    def test_craft_insufficient_material(self):
        state = GameState(gold=100, location="river_town", inventory={"wheat": 1})
        res = commission_crafting(state, "brew_wine")
        self.assertIn("原料不足", res)

    def test_craft_insufficient_gold(self):
        state = GameState(gold=0, location="river_town", inventory={"wheat": 5})
        res = commission_crafting(state, "brew_wine")
        self.assertIn("金钱不足", res)

    def test_unknown_recipe(self):
        state = GameState(location="river_town")
        self.assertIn("未知", commission_crafting(state, "no_such_recipe"))

    def test_processed_goods_sellable(self):
        state = GameState(gold=0, location="river_town", inventory={"wine": 1})
        res = trade(state, "river_town", "sell", "wine", 1)
        self.assertIn("成功卖出 1 美酒", res)
        self.assertEqual(state.gold, LOCATIONS["river_town"]["market"]["wine"]["sell_price"])


class TestPhase17Haggling(unittest.TestCase):
    def test_haggle_big_success_buy(self):
        state = GameState(gold=1000, location="river_town", attributes={"charm": 10})
        with patch("random.random", return_value=0.2):
            res = haggle_trade(state, "river_town", "buy", "wheat", 10)
        self.assertTrue(res["success"])
        self.assertEqual(res["result"], "big")
        self.assertAlmostEqual(res["discount"], 0.4, places=2)
        self.assertEqual(state.gold, 1000 - 120)
        self.assertIn("精明的市场商人", res["dialogue"])

    def test_haggle_fail_no_discount(self):
        state = GameState(gold=1000, location="river_town", attributes={"charm": 10})
        with patch("random.random", return_value=0.05):
            res = haggle_trade(state, "river_town", "buy", "wheat", 10)
        self.assertEqual(res["result"], "fail")
        self.assertEqual(res["discount"], 0.0)
        self.assertEqual(state.gold, 1000 - 200)

    def test_haggle_sell_with_news_multiplier(self):
        state = GameState(gold=0, location="river_town", inventory={"wheat": 10}, attributes={"charm": 5})
        state.world_news = [{
            "id": "n", "day": 1, "goods": "wheat", "sell_multiplier": 2.0,
            "location_id": "river_town", "expires_day": 9,
        }]
        with patch("random.random", return_value=0.9):
            res = haggle_trade(state, "river_town", "sell", "wheat", 10)
        self.assertEqual(res["result"], "ok")
        self.assertEqual(state.inventory["wheat"], 0)
        self.assertEqual(state.gold, 34 * 10)

    def test_haggle_invalid_goods(self):
        state = GameState(gold=100, location="oak_village")
        res = haggle_trade(state, "oak_village", "buy", "iron", 1)
        self.assertFalse(res["success"])
        self.assertEqual(res["result"], "invalid")

    def test_haggle_insufficient_gold(self):
        state = GameState(gold=1, location="river_town")
        res = haggle_trade(state, "river_town", "buy", "wheat", 10)
        self.assertFalse(res["success"])
        self.assertIn("金钱不足", res["message"])


if __name__ == "__main__":
    unittest.main()
