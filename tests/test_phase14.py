"""单元测试模块：验证 Phase 14「酒馆真实感重构」的三教九流交互与海量文本。"""

import unittest
from unittest.mock import patch

from core.state import GameState
from core.data import (
    NPC_MERCHANTS,
    PERSONALITY_TRAITS,
    BARD_LISTEN_COST,
    BARD_MORALE_GAIN,
    GAMBLER_MIN_BET,
    BEGGAR_ALMS,
    BEGGAR_RENOWN_GAIN,
    DESERTER_RECRUIT_COST,
    DESERTER_POWER_BONUS,
    DESERTER_ARMY_BONUS,
    DESERTER_RELATION_PENALTY,
)
from core.dialogues import DIALOGUE_DATABASE, BARD_STORIES
from core.dialogue_engine import get_formatted_npc_dialogue
from core.engine import (
    set_npc_mood,
    listen_bard,
    gamble_dice,
    beggar_interact,
    recruit_deserter,
    decline_deserter,
)

NEW_TAVERN_NPCS = ["bard", "gambler", "beggar", "deserter"]
NEW_CONTEXTS = [
    "bard_listen", "bard_story_end",
    "gambler_invite", "gambler_win", "gambler_lose",
    "beggar_plead", "beggar_grateful", "beggar_curse",
    "deserter_hide", "deserter_join", "deserter_refuse",
]


class TestPhase14DataAndText(unittest.TestCase):
    """测试新增 NPC 定义与文本库结构。"""

    def test_new_npcs_defined(self):
        for npc_id in NEW_TAVERN_NPCS:
            self.assertIn(npc_id, NPC_MERCHANTS)
            npc = NPC_MERCHANTS[npc_id]
            self.assertEqual(npc["id"], npc_id)
            self.assertIn("name", npc)
            self.assertIn("title", npc)
            self.assertIn(npc["personality"], PERSONALITY_TRAITS)

    def test_new_dialogue_contexts_structure(self):
        for ctx in NEW_CONTEXTS:
            self.assertIn(ctx, DIALOGUE_DATABASE)
            for attitude, personalities in DIALOGUE_DATABASE[ctx].items():
                self.assertIsInstance(personalities, dict)
                for personality, lines in personalities.items():
                    self.assertIsInstance(lines, list)
                    self.assertGreaterEqual(len(lines), 2)

    def test_bard_stories_non_empty(self):
        self.assertGreaterEqual(len(BARD_STORIES), 3)

    def test_dialogue_formatted_with_renown(self):
        low = GameState(gold=500, renown=10)
        welcome = get_formatted_npc_dialogue("bard", "bard_listen", low)
        self.assertIn("落魄的游吟诗人", welcome)
        self.assertIn("蔑视地", welcome)
        high = GameState(gold=500, renown=2000)
        gamble_inv = get_formatted_npc_dialogue("gambler", "gambler_invite", high)
        self.assertIn("红眼的赌徒", gamble_inv)
        self.assertIn("谄媚地", gamble_inv)


class TestPhase14State(unittest.TestCase):
    """测试新增状态字段的默认值与序列化。"""

    def test_new_state_defaults_and_serialization(self):
        state = GameState()
        self.assertFalse(state.deserter_recruited)
        self.assertEqual(state.unlocked_lore, [])
        state.deserter_recruited = True
        state.unlocked_lore.append("某段往事")
        data = state.to_dict()
        restored = GameState.from_dict(data)
        self.assertTrue(restored.deserter_recruited)
        self.assertEqual(restored.unlocked_lore, ["某段往事"])

    def test_default_npc_states_include_new_npcs(self):
        state = GameState()
        for npc_id in NEW_TAVERN_NPCS:
            self.assertIn(npc_id, state.npc_states)
            self.assertEqual(state.npc_states[npc_id]["mood"], "neutral")

    def test_set_npc_mood_creates_missing_entry(self):
        state = GameState()
        state.npc_states = {"tavern_keeper": {"mood": "neutral"}}
        set_npc_mood(state, "bard", "happy")
        self.assertEqual(state.npc_states["bard"]["mood"], "happy")


class TestPhase14Bard(unittest.TestCase):
    """测试游吟诗人：听故事加士气并逐步解锁世界观。"""

    def test_listen_bard_success(self):
        state = GameState(gold=200, renown=50, morale=60)
        res = listen_bard(state)
        self.assertTrue(res["success"])
        self.assertEqual(state.gold, 200 - BARD_LISTEN_COST)
        self.assertEqual(state.morale, min(100, 60 + BARD_MORALE_GAIN))
        self.assertIn(res["story"], BARD_STORIES)
        self.assertEqual(state.unlocked_lore, [res["story"]])

    def test_listen_bard_unlocks_unique_stories(self):
        state = GameState(gold=9999, renown=50)
        for _ in range(len(BARD_STORIES)):
            listen_bard(state)
        self.assertEqual(len(state.unlocked_lore), len(BARD_STORIES))
        self.assertEqual(len(set(state.unlocked_lore)), len(BARD_STORIES))

    def test_listen_bard_insufficient_gold(self):
        state = GameState(gold=0, renown=50, morale=50)
        res = listen_bard(state)
        self.assertFalse(res["success"])
        self.assertEqual(state.morale, 50)
        self.assertEqual(state.unlocked_lore, [])


class TestPhase14Gambler(unittest.TestCase):
    """测试赌徒：骰子赌博的输赢结算与心情变化。"""

    def test_gamble_win(self):
        state = GameState(gold=200, renown=50)
        with patch("random.randint", side_effect=[6, 1]):
            res = gamble_dice(state, 50)
        self.assertTrue(res["success"])
        self.assertEqual(res["result"], "win")
        self.assertEqual(res["net"], 50)
        self.assertEqual(state.gold, 250)
        self.assertEqual(state.npc_states["gambler"]["mood"], "angry")

    def test_gamble_lose(self):
        state = GameState(gold=200, renown=50)
        with patch("random.randint", side_effect=[1, 6]):
            res = gamble_dice(state, 50)
        self.assertFalse(res["success"])
        self.assertEqual(res["result"], "lose")
        self.assertEqual(res["net"], -50)
        self.assertEqual(state.gold, 150)
        self.assertEqual(state.npc_states["gambler"]["mood"], "happy")

    def test_gamble_tie_refunds(self):
        state = GameState(gold=200, renown=50)
        with patch("random.randint", side_effect=[4, 4]):
            res = gamble_dice(state, 50)
        self.assertEqual(res["result"], "tie")
        self.assertEqual(res["net"], 0)
        self.assertEqual(state.gold, 200)

    def test_gamble_bet_too_small(self):
        state = GameState(gold=200, renown=50)
        res = gamble_dice(state, GAMBLER_MIN_BET - 1)
        self.assertFalse(res["success"])
        self.assertEqual(res["result"], "invalid")
        self.assertEqual(state.gold, 200)

    def test_gamble_insufficient_gold(self):
        state = GameState(gold=10, renown=50)
        res = gamble_dice(state, 50)
        self.assertFalse(res["success"])
        self.assertEqual(res["result"], "invalid")


class TestPhase14Beggar(unittest.TestCase):
    """测试乞丐：施舍加声望，拒绝可能被偷。"""

    def test_beggar_give(self):
        state = GameState(gold=200, renown=50)
        res = beggar_interact(state, "give")
        self.assertTrue(res["success"])
        self.assertEqual(state.gold, 200 - BEGGAR_ALMS)
        self.assertEqual(state.renown, 50 + BEGGAR_RENOWN_GAIN)
        self.assertEqual(state.npc_states["beggar"]["mood"], "happy")

    def test_beggar_refuse_may_steal(self):
        state = GameState(gold=200, renown=50)
        with patch("random.random", return_value=0.1):
            res = beggar_interact(state, "refuse")
        self.assertEqual(res["stolen"], 15)
        self.assertEqual(state.gold, 185)
        self.assertEqual(state.renown, 50)
        self.assertEqual(state.npc_states["beggar"]["mood"], "angry")

    def test_beggar_refuse_no_steal(self):
        state = GameState(gold=200, renown=50)
        with patch("random.random", return_value=0.95):
            res = beggar_interact(state, "refuse")
        self.assertEqual(res["stolen"], 0)
        self.assertEqual(state.gold, 200)

    def test_beggar_give_insufficient_gold(self):
        state = GameState(gold=0, renown=50)
        res = beggar_interact(state, "give")
        self.assertFalse(res["success"])


class TestPhase14Deserter(unittest.TestCase):
    """测试逃兵：强力特殊同伴，但招揽会降低各势力关系。"""

    def test_recruit_deserter_success(self):
        state = GameState(gold=500, renown=50)
        rel_before = dict(state.faction_relations)
        power_before = state.personal_power
        army_before = state.max_army_size
        res = recruit_deserter(state)
        self.assertTrue(res["success"])
        self.assertTrue(state.deserter_recruited)
        self.assertEqual(state.gold, 500 - DESERTER_RECRUIT_COST)
        self.assertEqual(state.personal_power, power_before + DESERTER_POWER_BONUS)
        self.assertEqual(state.max_army_size, army_before + DESERTER_ARMY_BONUS)
        for fid, val in state.faction_relations.items():
            self.assertEqual(val, rel_before[fid] - DESERTER_RELATION_PENALTY)
        self.assertEqual(state.npc_states["deserter"]["mood"], "happy")

    def test_recruit_deserter_only_once(self):
        state = GameState(gold=9999, renown=50)
        self.assertTrue(recruit_deserter(state)["success"])
        second = recruit_deserter(state)
        self.assertFalse(second["success"])

    def test_recruit_deserter_insufficient_gold(self):
        state = GameState(gold=10, renown=50)
        res = recruit_deserter(state)
        self.assertFalse(res["success"])
        self.assertFalse(state.deserter_recruited)

    def test_decline_deserter(self):
        state = GameState(gold=500, renown=50)
        res = decline_deserter(state)
        self.assertTrue(res["success"])
        self.assertFalse(state.deserter_recruited)
        self.assertEqual(state.gold, 500)


if __name__ == "__main__":
    unittest.main()
