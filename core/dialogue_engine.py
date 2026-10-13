"""对话引擎模块：根据 NPC 的性格、记忆、心情与玩家声望动态选择并生成台词。"""

import random
from core.data import ATTITUDE_LEVELS, NPC_MERCHANTS
from core.dialogues import DIALOGUE_DATABASE

LEAVE_PARTY = "LEAVE_PARTY"

ATTITUDE_KEYS = ["contempt", "neutral", "respect", "fawning"]


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


def get_attitude_key(state, npc):
    """根据玩家声望与 NPC 当前心情计算态度基调键名。"""
    renown = 100
    if state is not None:
        if isinstance(state, dict):
            renown = state.get("renown", 100)
        else:
            renown = getattr(state, "renown", 100)

    if renown < 100:
        base_idx = 0
    elif 100 <= renown <= 500:
        base_idx = 1
    elif 501 <= renown <= 1000:
        base_idx = 2
    else:
        base_idx = 3

    mood = "neutral"
    npc_id = None
    if isinstance(npc, str):
        npc_id = npc
    elif isinstance(npc, dict):
        npc_id = npc.get("id")
        mood = npc.get("mood", "neutral")
    else:
        npc_id = getattr(npc, "id", None)
        mood = getattr(npc, "mood", "neutral")

    if state is not None:
        npc_states = getattr(state, "npc_states", None) if not isinstance(state, dict) else state.get("npc_states")
        if isinstance(npc_states, dict) and npc_id in npc_states:
            mood = npc_states[npc_id].get("mood", mood)

    if mood == "angry":
        base_idx = max(0, base_idx - 1)
    elif mood == "happy":
        base_idx = min(3, base_idx + 1)

    return ATTITUDE_KEYS[base_idx]


def get_dialogue(npc, context, state=None):
    """根据 NPC 的性格、态度基调和情境检索并返回对话台词。"""
    if isinstance(npc, str):
        npc_info = NPC_MERCHANTS.get(npc, {"personality": "cautious"})
        personality = npc_info.get("personality", "cautious")
        memory = []
    elif isinstance(npc, dict):
        personality = npc.get("personality", "cautious")
        memory = npc.get("memory", [])
    else:
        personality = getattr(npc, "personality", "cautious")
        memory = getattr(npc, "memory", [])

    if context == "combat_lost_fled" and personality == "hot_headed":
        if random.random() < 0.5:
            return LEAVE_PARTY

    attitude = get_attitude_key(state, npc)

    candidates = []

    def _find_in_category(category_dict):
        if not isinstance(category_dict, dict):
            return []

        # 1. 匹配 attitude -> personality
        if attitude in category_dict and isinstance(category_dict[attitude], dict):
            p_dict = category_dict[attitude]
            if personality in p_dict and p_dict[personality]:
                return p_dict[personality]
            for p in p_dict:
                if p_dict[p]:
                    return p_dict[p]

        # 2. 降级匹配其他 attitude
        for att in ["neutral", "contempt", "respect", "fawning"]:
            if att in category_dict and isinstance(category_dict[att], dict):
                p_dict = category_dict[att]
                if personality in p_dict and p_dict[personality]:
                    return p_dict[personality]
                for p in p_dict:
                    if p_dict[p]:
                        return p_dict[p]

        # 3. 兼容旧版直接以 personality 为 key 的结构
        if personality in category_dict and isinstance(category_dict[personality], list):
            return category_dict[personality]

        for p, val in category_dict.items():
            if isinstance(val, list) and val:
                return val

        return []

    if context in DIALOGUE_DATABASE:
        candidates = _find_in_category(DIALOGUE_DATABASE[context])

    if not candidates and memory:
        for mem_event in reversed(memory):
            if mem_event in DIALOGUE_DATABASE:
                candidates = _find_in_category(DIALOGUE_DATABASE[mem_event])
                if candidates:
                    break

    if not candidates:
        generic = DIALOGUE_DATABASE.get("generic", {})
        candidates = _find_in_category(generic)

    if not candidates:
        candidates = ["..."]

    return random.choice(candidates)


def get_formatted_npc_dialogue(npc, context, state=None):
    """生成带 NPC 称号/名字和态度描述的格式化台词，格式: [贪婪的酒馆老板] (蔑视地): “台词”"""
    if isinstance(npc, str):
        npc_info = NPC_MERCHANTS.get(npc, {"name": npc, "title": npc, "personality": "cautious"})
    elif isinstance(npc, dict):
        npc_info = npc
    else:
        npc_info = {
            "name": getattr(npc, "name", "NPC"),
            "title": getattr(npc, "title", getattr(npc, "name", "NPC")),
            "personality": getattr(npc, "personality", "cautious"),
        }

    title = npc_info.get("title") or npc_info.get("name") or "NPC"
    attitude_key = get_attitude_key(state, npc)
    attitude_label = ATTITUDE_LEVELS.get(attitude_key, {}).get("label", "平静地")

    dialogue_text = get_dialogue(npc, context, state)
    if dialogue_text == LEAVE_PARTY:
        return LEAVE_PARTY

    return f"[{title}] ({attitude_label}): “{dialogue_text}”"
