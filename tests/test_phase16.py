"""单元测试模块：验证 Phase 16「世界真实感」——领主性格、动态新闻与恩怨系统。"""

import unittest
from unittest.mock import patch

from core.state import GameState
from core.data import (
    LORDS,
    LORD_PERSONALITIES,
    LORD_PERSONALITY_MODIFIERS,
    LOCATIONS,
    QUEST_TEMPLATES,
    LORD_GRUDGE_DECAY,
)
from core.dialogues import DIALOGUE_DATABASE
from core.engine import (
    lords_of_faction,
    get_faction_lord,
    generate_quests,
    get_price_multiplier,
    get_active_news,
    generate_world_news,
    provoke_lord_grudge,
    apply_lord_grudge_decay,
    get_lord_stance,
    meet_lord,
    execute_prisoners,
    trade,
)


class TestPhase16LordData(unittest.TestCase):
    def test_lords_structure(self):
        self.assertGreaterEqual(len(LORDS), 3)
        for lord_id, lord in LORDS.items():
            self.assertEqual(lord["id"], lord_id)
            for key in ["name", "title", "faction_id", "personality"]:
                self.assertIn(key, lord)
            self.assertIn(lord["personality"], LORD_PERSONALITIES)

    def test_personality_modifiers_cover_all(self):
        for p in LORD_PERSONALITIES:
            self.assertIn(p, LORD_PERSONALITY_MODIFIERS)
        self.assertGreater(LORD_PERSONALITY_MODIFIERS["generous"], 1.0)
        self.assertLess(LORD_PERSONALITY_MODIFIERS["stingy"], 1.0)

    def test_lords_of_faction_and_primary(self):
        f1_lords = lords_of_faction("f1")
        self.assertGreaterEqual(len(f1_lords), 1)
        self.assertEqual(get_faction_lord("f1"), f1_lords[0])
        self.assertIsNone(get_faction_lord("no_such_faction"))

    def test_lord_talk_dialogue_structure(self):
        self.assertIn("lord_talk", DIALOGUE_DATABASE)
        for attitude in ["contempt", "neutral", "respect", "fawning"]:
            block = DIALOGUE_DATABASE["lord_talk"][attitude]
            for p in LORD_PERSONALITIES:
                self.assertIn(p, block)
                self.assertGreaterEqual(len(block[p]), 2)


class TestPhase16LordQuestReward(unittest.TestCase):
    def test_generous_faction_rewards_scaled_up(self):
        LOCATIONS["river_town"]["active_quests"] = []
        generate_quests("river_town")
        expected_cash = {int(t["reward_cash"] * 1.3) for t in QUEST_TEMPLATES}
        for q in LOCATIONS["river_town"]["active_quests"]:
            self.assertIn(q["reward_cash"], expected_cash)
            self.assertEqual(q["lord_id"], get_faction_lord("f1")["id"])

    def test_stingy_faction_rewards_scaled_down(self):
        LOCATIONS["iron_town"]["active_quests"] = []
        generate_quests("iron_town")
        expected_cash = {int(t["reward_cash"] * 0.7) for t in QUEST_TEMPLATES}
        for q in LOCATIONS["iron_town"]["active_quests"]:
            self.assertIn(q["reward_cash"], expected_cash)


class TestPhase16DynamicNews(unittest.TestCase):
    def test_plague_doubles_wheat_price(self):
        state = GameState(gold=0, renown=0, location="river_town", inventory={"wheat": 10})
        state.world_news = [{
            "id": "n1", "day": 1, "type": "plague", "goods": "wheat",
            "sell_multiplier": 2.0, "location_id": "river_town", "expires_day": 5,
        }]
        self.assertEqual(get_price_multiplier(state, "river_town", "wheat"), 2.0)
        self.assertEqual(get_price_multiplier(state, "iron_town", "wheat"), 1.0)
        trade(state, "river_town", "sell", "wheat", 10)
        self.assertEqual(state.cash, 15 * 2 * 10)

    def test_expired_news_has_no_effect(self):
        state = GameState(day=99, location="river_town", inventory={"wheat": 10})
        state.world_news = [{
            "id": "n1", "day": 1, "goods": "wheat", "sell_multiplier": 2.0,
            "location_id": "river_town", "expires_day": 5,
        }]
        self.assertEqual(get_active_news(state), [])
        self.assertEqual(get_price_multiplier(state, "river_town", "wheat"), 1.0)

    def test_global_news_applies_everywhere(self):
        state = GameState(location="oak_village")
        state.world_news = [{
            "id": "n2", "day": 1, "goods": "iron", "sell_multiplier": 1.8,
            "location_id": None, "expires_day": 5,
        }]
        self.assertEqual(get_price_multiplier(state, "oak_village", "iron"), 1.8)
        self.assertEqual(get_price_multiplier(state, "central_city", "iron"), 1.8)

    def test_generate_world_news_probability(self):
        state = GameState()
        with patch("random.random", return_value=0.01):
            entry = generate_world_news(state)
        self.assertIsNotNone(entry)
        self.assertGreater(entry["expires_day"], entry["day"])
        self.assertIn(entry["goods"], ["wheat", "iron"])
        self.assertEqual(len(state.world_news), 1)
        state2 = GameState()
        with patch("random.random", return_value=0.99):
            self.assertIsNone(generate_world_news(state2))
        self.assertEqual(state2.world_news, [])


class TestPhase16Grudges(unittest.TestCase):
    def test_provoke_grudge_once(self):
        state = GameState()
        self.assertTrue(provoke_lord_grudge(state, "lord_gareth"))
        self.assertFalse(provoke_lord_grudge(state, "lord_gareth"))
        self.assertEqual(state.lord_grudges, ["lord_gareth"])
        self.assertFalse(provoke_lord_grudge(state, "no_such_lord"))

    def test_grudge_decay_reduces_relation(self):
        state = GameState(lord_grudges=["lord_aurora"])
        before = state.faction_relations["f1"]
        apply_lord_grudge_decay(state)
        self.assertEqual(state.faction_relations["f1"], before - LORD_GRUDGE_DECAY)

    def test_get_lord_stance(self):
        state = GameState()
        self.assertEqual(get_lord_stance(state, "lord_aurora"), "neutral")
        state.faction_relations["f1"] = -30
        self.assertEqual(get_lord_stance(state, "lord_aurora"), "hostile")
        state.faction_relations["f1"] = 50
        self.assertEqual(get_lord_stance(state, "lord_aurora"), "friendly")
        state.lord_grudges = ["lord_aurora"]
        self.assertEqual(get_lord_stance(state, "lord_aurora"), "grudge")
        self.assertEqual(get_lord_stance(state, "nope"), "unknown")

    def test_execute_registers_grudge(self):
        state = GameState(gold=0, prisoners={"peasant": 5}, location="river_town")
        execute_prisoners(state, "peasant", 2)
        self.assertEqual(len(state.lord_grudges), 1)
        self.assertIn(state.lord_grudges[0], [l["id"] for l in lords_of_faction("f1")])

    def test_meet_lord(self):
        state = GameState(renown=2000)
        res = meet_lord(state, "lord_aurora")
        self.assertTrue(res["success"])
        self.assertEqual(res["title"], LORDS["lord_aurora"]["title"])
        self.assertIn(LORDS["lord_aurora"]["title"], res["dialogue"])
        bad = meet_lord(state, "no_such_lord")
        self.assertFalse(bad["success"])


class TestPhase16State(unittest.TestCase):
    def test_defaults_and_serialization(self):
        state = GameState()
        self.assertEqual(state.world_news, [])
        self.assertEqual(state.lord_grudges, [])
        state.world_news = [{"id": "n", "desc": "x", "expires_day": 2, "goods": "wheat",
                             "sell_multiplier": 2.0, "location_id": None, "day": 1, "type": "plague"}]
        state.lord_grudges = ["lord_ulf"]
        restored = GameState.from_dict(state.to_dict())
        self.assertEqual(restored.lord_grudges, ["lord_ulf"])
        self.assertEqual(restored.world_news[0]["id"], "n")


if __name__ == "__main__":
    unittest.main()
