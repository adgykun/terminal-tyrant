"""单元测试模块：验证 Phase 15「战场真实感」——打扫战场、俘虏处理与分赃意见。"""

import unittest
from unittest.mock import patch

from core.state import GameState
from core.data import (
    SCAVENGE_GOLD_PER_ENEMY_POWER,
    RANSOM_GOLD_PER_PRISONER,
    RANSOM_RELATION_PENALTY,
    RELEASE_RENOWN_PER_PRISONER,
    RELEASE_MORALITY_GAIN,
    EXECUTE_MORALITY_LOSS,
    EXECUTE_INTIMIDATION_GAIN,
    EXECUTE_RELATION_PENALTY,
    INTIMIDATION_CAP,
)
from core.dialogues import DIALOGUE_DATABASE, SCAVENGE_AMBUSH_TEXTS, SCAVENGE_SUCCESS_TEXTS
from core.engine import (
    quick_withdraw,
    scavenge_battlefield,
    ransom_prisoners,
    release_prisoners,
    execute_prisoners,
    get_loot_opinion_quotes,
    resolve_combat_simple,
)


class TestPhase15DataAndText(unittest.TestCase):
    def test_loot_opinion_context_structure(self):
        self.assertIn("loot_opinion", DIALOGUE_DATABASE)
        neutral = DIALOGUE_DATABASE["loot_opinion"]["neutral"]
        for personality in ["greedy", "hot_headed", "cautious", "loyal", "cowardly"]:
            self.assertIn(personality, neutral)
            self.assertGreaterEqual(len(neutral[personality]), 2)

    def test_scavenge_narratives_non_empty(self):
        self.assertGreaterEqual(len(SCAVENGE_SUCCESS_TEXTS), 1)
        self.assertGreaterEqual(len(SCAVENGE_AMBUSH_TEXTS), 1)


class TestPhase15State(unittest.TestCase):
    def test_morality_intimidation_defaults_and_serialization(self):
        state = GameState()
        self.assertEqual(state.morality, 100)
        self.assertEqual(state.intimidation, 0)
        state.morality = 42
        state.intimidation = 17
        restored = GameState.from_dict(state.to_dict())
        self.assertEqual(restored.morality, 42)
        self.assertEqual(restored.intimidation, 17)

    def test_morality_clamped(self):
        self.assertEqual(GameState(morality=999).morality, 100)
        self.assertEqual(GameState(morality=-5).morality, 0)


class TestPhase15Scavenge(unittest.TestCase):
    def test_quick_withdraw_no_day_cost(self):
        state = GameState(gold=100)
        day_before = state.day
        res = quick_withdraw(state)
        self.assertTrue(res["success"])
        self.assertEqual(res["days"], 0)
        self.assertEqual(state.day, day_before)
        self.assertEqual(state.gold, 100)

    def test_scavenge_no_ambush(self):
        state = GameState(gold=100, food=1000)
        with patch("random.random", return_value=0.99), patch("random.randint", return_value=1):
            res = scavenge_battlefield(state, enemy_power=15)
        self.assertTrue(res["success"])
        self.assertFalse(res["ambushed"])
        self.assertEqual(res["days"], 1)
        expected_gold = 15 * SCAVENGE_GOLD_PER_ENEMY_POWER
        self.assertEqual(res["gold_gained"], expected_gold)
        self.assertEqual(state.gold, 100 + expected_gold)

    def test_scavenge_ambush_loses_troops(self):
        state = GameState(gold=100, food=1000, troops={"infantry": 10})
        with patch("random.random", return_value=0.1), patch("random.randint", return_value=2):
            res = scavenge_battlefield(state, enemy_power=10)
        self.assertTrue(res["ambushed"])
        self.assertLess(sum(state.troops.values()), 10)


class TestPhase15Prisoners(unittest.TestCase):
    def test_ransom_prisoners(self):
        state = GameState(gold=0, prisoners={"peasant": 5})
        res = ransom_prisoners(state, "peasant", 2)
        self.assertIn("赎金", res)
        self.assertEqual(state.prisoners["peasant"], 3)
        self.assertEqual(state.cash, 2 * RANSOM_GOLD_PER_PRISONER)
        self.assertEqual(state.faction_relations["f1"], -RANSOM_RELATION_PENALTY)

    def test_release_prisoners(self):
        state = GameState(gold=0, renown=0, morality=80, prisoners={"peasant": 5})
        res = release_prisoners(state, "peasant", 2)
        self.assertIn("仁义", res)
        self.assertEqual(state.prisoners["peasant"], 3)
        self.assertEqual(state.renown, 2 * RELEASE_RENOWN_PER_PRISONER)
        self.assertEqual(state.morality, min(100, 80 + 2 * RELEASE_MORALITY_GAIN))
        self.assertEqual(state.gold, 0)

    def test_execute_prisoners(self):
        state = GameState(gold=0, morality=100, intimidation=0, prisoners={"peasant": 5})
        res = execute_prisoners(state, "peasant", 3)
        self.assertIn("处决", res)
        self.assertEqual(state.prisoners["peasant"], 2)
        self.assertEqual(state.morality, 100 - 3 * EXECUTE_MORALITY_LOSS)
        self.assertEqual(state.intimidation, 3 * EXECUTE_INTIMIDATION_GAIN)
        self.assertEqual(state.faction_relations["f1"], -EXECUTE_RELATION_PENALTY)

    def test_prisoner_insufficient(self):
        state = GameState(prisoners={"peasant": 1})
        self.assertIn("不足", ransom_prisoners(state, "peasant", 5))
        self.assertIn("不足", release_prisoners(state, "peasant", 5))
        self.assertIn("不足", execute_prisoners(state, "peasant", 5))


class TestPhase15Intimidation(unittest.TestCase):
    def test_intimidation_reduces_enemy_power(self):
        base = GameState(intimidation=0, troops={"infantry": 50}, personal_power=100)
        feared = GameState(intimidation=INTIMIDATION_CAP, troops={"infantry": 50}, personal_power=100)
        enemy_power_base = resolve_combat_simple(base, 100, "defend")["enemy_power"]
        enemy_power_feared = resolve_combat_simple(feared, 100, "defend")["enemy_power"]
        self.assertEqual(enemy_power_base, 100)
        self.assertLess(enemy_power_feared, enemy_power_base)


class TestPhase15LootOpinion(unittest.TestCase):
    def test_loot_opinion_per_companion(self):
        state = GameState(companions=["c1", "c2", "c3"])
        quotes = get_loot_opinion_quotes(state)
        self.assertEqual(len(quotes), 3)
        self.assertIn("老练商人", quotes[0])
        self.assertIn("百战将领", quotes[1])
        self.assertIn("智谋军师", quotes[2])

    def test_loot_opinion_empty_without_companion(self):
        self.assertEqual(get_loot_opinion_quotes(GameState(companions=[])), [])


if __name__ == "__main__":
    unittest.main()
