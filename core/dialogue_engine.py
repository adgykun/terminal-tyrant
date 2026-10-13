"""对话引擎模块：根据 NPC 的性格、记忆和当前情境，动态选择并吐出对话文本。"""

import random
from core.dialogues import DIALOGUE_DATABASE

LEAVE_PARTY = "LEAVE_PARTY"


def update_memory(npc, event):
    """将事件记录到 NPC 的记忆列表中，并维持最多 10 条遗忘机制。"""
    if isinstance(npc, dict):
        if "memory" not in npc or npc["memory"] is None:
            npc["memory"] = []
        npc["memory"].append(event)
        if len(npc["memory"]) > 10:
            npc["memory"] = npc["memory"][-10:]
    else:
        if not hasattr(npc, "memory") or getattr(npc, "memory") is None:
            setattr(npc, "memory", [])
        mem = getattr(npc, "memory")
        mem.append(event)
        if len(mem) > 10:
            setattr(npc, "memory", mem[-10:])


def get_dialogue(npc, context, state=None):
    """根据 NPC 的性格、情境和历史记忆生成并返回对话台词。"""
    if isinstance(npc, dict):
        personality = npc.get("personality", "cautious")
        memory = npc.get("memory", [])
    else:
        personality = getattr(npc, "personality", "cautious")
        memory = getattr(npc, "memory", [])

    if context == "combat_lost_fled" and personality == "hot_headed":
        if random.random() < 0.5:
            return LEAVE_PARTY

    candidates = []

    # 1. 优先匹配当前情境
    if context in DIALOGUE_DATABASE and personality in DIALOGUE_DATABASE[context]:
        candidates = DIALOGUE_DATABASE[context][personality]

    # 2. 若当前情境无匹配，检查历史记忆中的事件
    if not candidates and memory:
        for mem_event in reversed(memory):
            if mem_event in DIALOGUE_DATABASE and personality in DIALOGUE_DATABASE[mem_event]:
                candidates = DIALOGUE_DATABASE[mem_event][personality]
                break

    # 3. 若仍无匹配，回退至通用台词
    if not candidates:
        generic = DIALOGUE_DATABASE.get("generic", {})
        candidates = generic.get(personality, ["..."])

    return random.choice(candidates)
