"""核心引擎逻辑模块：包含大地图移动、休息、事件触发与简单战斗结算。

纯逻辑计算，不包含任何 UI、print() 或 input()。
"""

import random
from core.data import (
    LOCATIONS,
    EVENTS,
    UNITS,
    GOODS,
    COMPANIONS,
    EQUIPMENT,
    FACTIONS,
    QUEST_TEMPLATES,
    POLICIES,
    FISHING_GEAR,
    FISH_LOOT_TABLE,
    NPC_MERCHANTS,
    APPEARANCE_TIERS,
    BARD_LISTEN_COST,
    BARD_MORALE_GAIN,
    GAMBLER_MIN_BET,
    BEGGAR_ALMS,
    BEGGAR_RENOWN_GAIN,
    BEGGAR_STEAL_CHANCE,
    BEGGAR_STEAL_AMOUNT,
    DESERTER_RECRUIT_COST,
    DESERTER_POWER_BONUS,
    DESERTER_ARMY_BONUS,
    DESERTER_RELATION_PENALTY,
    SCAVENGE_MIN_DAYS,
    SCAVENGE_MAX_DAYS,
    SCAVENGE_AMBUSH_CHANCE,
    SCAVENGE_GOLD_PER_ENEMY_POWER,
    SCAVENGE_LOOT_CHANCE,
    RANSOM_GOLD_PER_PRISONER,
    RANSOM_RELATION_PENALTY,
    RELEASE_RENOWN_PER_PRISONER,
    RELEASE_MORALITY_GAIN,
    EXECUTE_MORALITY_LOSS,
    EXECUTE_RELATION_PENALTY,
    EXECUTE_INTIMIDATION_GAIN,
    EXECUTE_RENOWN_GAIN,
    INTIMIDATION_CAP,
    INTIMIDATION_ENEMY_REDUCTION,
    LORDS,
    LORD_PERSONALITY_MODIFIERS,
    NEWS_TEMPLATES,
    WORLD_NEWS_CHANCE,
    WORLD_NEWS_HISTORY_LIMIT,
    LORD_GRUDGE_DECAY,
    RECIPES,
    FACILITY_NAMES,
    HAGGLE_CHARM_FACTOR,
    HAGGLE_BIG_SUCCESS_RATE,
    HAGGLE_FAIL_RATE,
    HAGGLE_MAX_DISCOUNT,
)
from core.dialogues import APPEARANCE_REVEAL_TEXTS, ADMIRER_EVENT_TEXTS, BARD_STORIES, SCAVENGE_SUCCESS_TEXTS, SCAVENGE_AMBUSH_TEXTS
from core.dialogue_engine import get_formatted_npc_dialogue, get_dialogue

_quest_id_counter = 1


def create_character(state, str_pts, int_pts, charm_pts):
    """分配 15 点基础属性并盲盒抽取外貌数值。"""
    if str_pts + int_pts + charm_pts != 15:
        raise ValueError("属性点数总和必须严格等于 15！")
    for name, pts in [("力量", str_pts), ("智力", int_pts), ("魅力", charm_pts)]:
        if not (1 <= pts <= 10):
            raise ValueError(f"{name} 属性必须在 1 至 10 之间！")

    state.attributes = {
        "strength": str_pts,
        "intellect": int_pts,
        "charm": charm_pts,
    }
    state.appearance = random.randint(1, 100)
    state.appearance_revealed = False
    return state


def get_total_appearance(state):
    """计算玩家基础外貌与当前穿戴装备的外貌加成之和。"""
    base_app = getattr(state, "appearance", 50)
    eq_app_bonus = 0
    if hasattr(state, "equipment") and isinstance(state.equipment, dict):
        for eq_id in state.equipment.values():
            if eq_id in EQUIPMENT:
                eq_app_bonus += EQUIPMENT[eq_id].get("appearance_bonus", 0)
    return base_app + eq_app_bonus


def reveal_appearance(state):
    """揭晓玩家外貌值及对应的外貌描述层级。"""
    app_val = getattr(state, "appearance", 50)
    state.appearance_revealed = True

    matched_tier = None
    for range_tuple, tier_data in APPEARANCE_TIERS.items():
        if range_tuple[0] <= app_val <= range_tuple[1]:
            matched_tier = (range_tuple, tier_data)
            break

    if not matched_tier:
        tier_data = {"desc": "大众脸", "combat_effect": "none", "social_modifier": 0}
        texts = ["你在溪边照了照，水中的倒影气色尚可，面貌规规矩矩。"]
    else:
        range_tuple, tier_data = matched_tier
        texts = APPEARANCE_REVEAL_TEXTS.get(range_tuple, ["你注视着自己的倒影。"])

    desc_text = random.choice(texts)
    tier_name = tier_data.get("desc", "未知")
    res_msg = f"【外貌揭晓】外貌数值: {app_val} ({tier_name})\n{desc_text}"
    state.add_log(res_msg)
    return res_msg


def trigger_admirer_event(state):
    """绝世容颜倒贴随机事件：随机给予金钱 (100-500) 或稀有装备。"""
    template = random.choice(ADMIRER_EVENT_TEXTS)
    if random.random() < 0.7:
        reward_gold = random.randint(100, 500)
        state.gold += reward_gold
        reward_str = f"获得 {reward_gold} 金币"
    else:
        eq_id = random.choice(list(EQUIPMENT.keys()))
        eq_item = dict(EQUIPMENT[eq_id])
        state.loot.append(eq_item)
        reward_str = f"获得稀有装备 [{eq_item['name']}]"

    event_msg = f"【仰慕者倾心】{template.replace('[REWARD]', reward_str)}"
    state.add_log(event_msg)
    return event_msg


def get_battle_companion_quote(state, combat_context):
    """获取所有已招募同伴在本轮战斗中的吐槽台词列表。"""
    quotes = []
    if not hasattr(state, "companions") or not state.companions:
        return quotes

    for comp_id in state.companions:
        comp_info = COMPANIONS.get(comp_id)
        if not comp_info:
            comp_info = {"id": comp_id, "name": comp_id, "personality": "cautious"}

        comp_name = comp_info.get("name", comp_id)
        dialogue_text = get_dialogue(comp_info, combat_context, state)
        quotes.append(f"[{comp_name}]: “{dialogue_text}”")

    return quotes


def add_log(state, event_text):
    """记录一条事件日志到历史记录，并维持最多 50 条最近记录。"""
    state.log_history.append({"day": state.day, "event": event_text})
    if len(state.log_history) > 50:
        state.log_history = state.log_history[-50:]


def update_faction_relations(state):
    """每日结算：更新势力之间的动态关系。"""
    f_ids = list(FACTIONS.keys())
    if len(f_ids) < 2:
        return

    f1_id, f2_id = random.sample(f_ids, 2)
    if random.random() < 0.10:
        rel = FACTIONS[f1_id]["relations"].get(f2_id, 0)
        if rel < 0:
            FACTIONS[f1_id]["relations"][f2_id] = 20
            FACTIONS[f2_id]["relations"][f1_id] = 20
            msg = f"【势力外交】{FACTIONS[f1_id]['name']} 与 {FACTIONS[f2_id]['name']} 达成了停战协议！"
        else:
            FACTIONS[f1_id]["relations"][f2_id] = -50
            FACTIONS[f2_id]["relations"][f1_id] = -50
            msg = f"【势力外交】{FACTIONS[f1_id]['name']} 向 {FACTIONS[f2_id]['name']} 正式宣战！"
        state.add_log(msg)


def generate_quests(location_id):
    """每日结算：为城镇生成任务。"""
    global _quest_id_counter
    loc = LOCATIONS.get(location_id)
    if not loc or loc.get("type") != "town":
        return

    if "active_quests" not in loc:
        loc["active_quests"] = []

    active_quests = loc["active_quests"]
    other_locations = [lid for lid in LOCATIONS if lid != location_id]

    while len(active_quests) < 3:
        template = random.choice(QUEST_TEMPLATES)
        q_type = template["type"]
        q_id = f"q_{_quest_id_counter}"
        _quest_id_counter += 1

        if q_type == "hunt_bandits":
            count = random.randint(3, 10)
            unit_id = random.choice(list(UNITS.keys()))
            unit_name = UNITS[unit_id]["name"]
            desc = f"剿灭 {count} 个 {unit_name} 匪徒"
            quest = {
                "id": q_id,
                "type": q_type,
                "desc": desc,
                "reward_cash": template["reward_cash"],
                "reward_renown": template["reward_renown"],
                "target_count": count,
                "current_count": 0,
                "unit_id": unit_id,
                "location_id": location_id,
            }
        elif q_type == "deliver_goods":
            amount = random.randint(3, 8)
            goods_id = random.choice(list(GOODS.keys()))
            goods_name = GOODS[goods_id]["name"]
            target_loc_id = random.choice(other_locations)
            target_loc_name = LOCATIONS[target_loc_id]["name"]
            desc = f"将 {amount} 单位 {goods_name} 从 {loc['name']} 运到 {target_loc_name}"
            quest = {
                "id": q_id,
                "type": q_type,
                "desc": desc,
                "reward_cash": template["reward_cash"],
                "reward_renown": template["reward_renown"],
                "goods_id": goods_id,
                "amount": amount,
                "target_location": target_loc_id,
                "location_id": location_id,
            }
        elif q_type == "escort":
            target_loc_id = random.choice(other_locations)
            target_loc_name = LOCATIONS[target_loc_id]["name"]
            desc = f"护送商队从 {loc['name']} 到 {target_loc_name}"
            quest = {
                "id": q_id,
                "type": q_type,
                "desc": desc,
                "reward_cash": template["reward_cash"],
                "reward_renown": template["reward_renown"],
                "target_location": target_loc_id,
                "location_id": location_id,
            }
        else:
            continue

        # Phase 16: 领主性格影响任务报酬（慷慨者出手阔绰，吝啬者锱铢必较）
        lord = get_faction_lord(loc.get("faction_id"))
        if lord:
            modifier = LORD_PERSONALITY_MODIFIERS.get(lord["personality"], 1.0)
            quest["reward_cash"] = max(0, int(quest["reward_cash"] * modifier))
            quest["reward_renown"] = max(0, int(quest["reward_renown"] * modifier))
            quest["lord_id"] = lord["id"]

        active_quests.append(quest)


def accept_quest(state, quest_id):
    """玩家接取城镇任务板上的任务。

    返回:
        str: 操作结果描述信息
    """
    loc = LOCATIONS.get(state.location, {})
    active_quests = loc.get("active_quests", [])

    target_quest = None
    for q in active_quests:
        if q["id"] == quest_id:
            target_quest = q
            break

    if not target_quest:
        return f"城镇任务板上未找到任务 '{quest_id}'"

    active_quests.remove(target_quest)
    state.active_quests.append(target_quest)
    msg = f"成功接取任务：{target_quest['desc']}"
    state.add_log(msg)
    return msg


def complete_quest(state, quest_id):
    """尝试完成玩家接取的任务。

    返回:
        str: 操作结果描述信息
    """
    target_quest = None
    for q in state.active_quests:
        if q["id"] == quest_id:
            target_quest = q
            break

    if not target_quest:
        return f"你当前未接取任务 '{quest_id}'"

    q_type = target_quest["type"]

    if q_type == "deliver_goods":
        target_loc_id = target_quest["target_location"]
        target_loc_name = LOCATIONS.get(target_loc_id, {}).get("name", target_loc_id)
        if state.location != target_loc_id:
            return f"尚未到达目标地点！需要将货物运送到 [{target_loc_name}]"

        goods_id = target_quest["goods_id"]
        goods_name = GOODS.get(goods_id, {}).get("name", goods_id)
        amount = target_quest["amount"]
        current_amount = state.inventory.get(goods_id, 0)
        if current_amount < amount:
            return f"货物不足！需要 {amount} 单位 {goods_name}，当前持有 {current_amount} 单位"

        state.inventory[goods_id] -= amount

    elif q_type == "escort":
        target_loc_id = target_quest["target_location"]
        target_loc_name = LOCATIONS.get(target_loc_id, {}).get("name", target_loc_id)
        if state.location != target_loc_id:
            return f"尚未到达目标地点！需要护送商队到达 [{target_loc_name}]"

    elif q_type == "hunt_bandits":
        curr_cnt = target_quest.get("current_count", 0)
        target_cnt = target_quest.get("target_count", 1)
        if curr_cnt < target_cnt:
            return f"任务未完成！还需剿灭 {target_cnt - curr_cnt} 个匪徒"

    reward_cash = target_quest.get("reward_cash", 0)
    reward_renown = target_quest.get("reward_renown", 0)

    state.cash += reward_cash
    state.renown += reward_renown

    state.active_quests.remove(target_quest)
    state.completed_quests.append(quest_id)

    msg = f"成功完成任务 [{target_quest['desc']}]！获得 {reward_cash} 金币，{reward_renown} 声望。"
    state.add_log(msg)
    return msg


def hire_companion(state, companion_id):
    """在当前地点的酒馆招募同伴。

    返回:
        str: 操作结果描述信息
    """
    if companion_id not in COMPANIONS:
        return f"同伴 '{companion_id}' 不存在"

    if companion_id in state.companions:
        return f"已经招募过同伴 '{COMPANIONS[companion_id]['name']}'"

    comp = COMPANIONS[companion_id]
    cost = comp.get("cost", 0)
    req_renown = comp.get("required_renown", 0)

    if state.renown < req_renown:
        return f"声望不足！招募 '{comp['name']}' 需要 {req_renown} 声望，当前声望：{state.renown}"

    if state.cash < cost:
        return f"金钱不足！招募 '{comp['name']}' 需要 {cost} 金，当前金钱：{state.cash}"

    state.cash -= cost
    state.companions.append(companion_id)

    bonus_type = comp.get("bonus_type")
    bonus_value = comp.get("bonus_value", 0)

    if bonus_type == "combat":
        state.max_army_size += int(bonus_value)
    elif bonus_type == "morale":
        state.morale = min(100, state.morale + int(bonus_value))

    msg = f"成功招募同伴 '{comp['name']}'！花费 {cost} 金。"
    state.add_log(msg)
    return msg


def conquer_location(state, location_id, action):
    """掠夺或占领地点。

    返回:
        str: 操作结果描述信息
    """
    loc = LOCATIONS.get(location_id)
    if not loc:
        return f"地点 '{location_id}' 不存在"

    if action == "loot":
        tax = loc.get("tax_income", 20)
        loot_gold = tax * 10
        state.cash += loot_gold
        state.renown = max(0, state.renown - 10)
        loc["owner"] = "looted"
        msg = f"对 [{loc['name']}] 进行了掠夺！获得 {loot_gold} 金币，声望减少 10 点。"
        state.add_log(msg)
        return msg

    elif action == "occupy":
        if loc.get("owner") == "looted":
            return f"[{loc['name']}] 已被掠夺破坏，无法再占领！"

        if state.renown < 50:
            return f"声望不足，无法占领 [{loc['name']}]！需要 50 声望，当前声望：{state.renown}。"

        loc["owner"] = "player"
        if location_id not in state.fiefs:
            state.fiefs.append(location_id)
        state.renown += 20
        msg = f"成功占领 [{loc['name']}]！声望增加 20 点，该地点已成为你的封地。"
        state.add_log(msg)
        return msg

    else:
        return f"未知的征服行为 '{action}'"


def daily_update(state):
    """每日结算：收税、耗粮、势力关系演变、任务生成与士气/解散判定。

    返回:
        str: 每日结算报告字符串
    """
    # 0. 外交动态演变与任务生成
    update_faction_relations(state)
    for loc_id in LOCATIONS:
        generate_quests(loc_id)

    # 0.1 Phase 16: 生成世界新闻，并结算与玩家结怨领主的关系衰减
    generate_world_news(state)
    apply_lord_grudge_decay(state)

    # 1. 收税（领主管理，税收减半）
    tax_income = 0.0
    for fief_id in state.fiefs:
        f_info = LOCATIONS.get(fief_id, {})
        base_tax = f_info.get("tax_income", 0)
        if f_info.get("owner") == "lord":
            tax_income += base_tax * 0.5
        else:
            tax_income += base_tax

    # 1.1 政策叠加效果
    if state.is_king and state.current_policy:
        if state.current_policy == "tax_high":
            tax_income *= 1.5
            state.morale = max(0, state.morale - 5)
        elif state.current_policy == "tax_low":
            tax_income *= 0.8
            state.morale = min(100, state.morale + 5)
        elif state.current_policy == "conscription":
            state.renown = max(0, state.renown - 2)

    tax_income = int(tax_income)
    state.cash += tax_income

    # 2. 战败惩罚
    if getattr(state, "battle_lost_today", False):
        state.morale = max(0, state.morale - 20)
        state.battle_lost_today = False

    # 3. 耗粮与无粮惩罚
    total_food_consumed = 0.0
    for unit_id, count in state.troops.items():
        if count > 0:
            u_info = UNITS.get(unit_id, {})
            rate = u_info.get("food_consumption", 1.0)
            total_food_consumed += count * rate

    state.food -= total_food_consumed

    if state.food <= 0:
        state.food = 0.0
        state.morale = max(0, state.morale - 10)

    # 4. 脱队机制 (士气低落士气 < 30，每天流失 1-2 名最低级兵种)
    disband_msg = ""
    if state.morale < 30:
        total_soldiers = sum(state.troops.values())
        if total_soldiers > 0:
            to_desert = min(total_soldiers, random.randint(1, 2))
            remaining_desert = to_desert
            deserted_detail = {}

            priority_order = ["peasant", "archer", "infantry"]
            for unit_id in priority_order:
                if unit_id in state.troops and state.troops[unit_id] > 0 and remaining_desert > 0:
                    loss = min(state.troops[unit_id], remaining_desert)
                    state.troops[unit_id] -= loss
                    remaining_desert -= loss
                    deserted_detail[unit_id] = loss

            for unit_id in state.troops:
                if remaining_desert <= 0:
                    break
                if state.troops[unit_id] > 0:
                    loss = min(state.troops[unit_id], remaining_desert)
                    state.troops[unit_id] -= loss
                    remaining_desert -= loss
                    deserted_detail[unit_id] = loss

            desert_parts = [f"{UNITS.get(uid, {}).get('name', uid)} {cnt} 人" for uid, cnt in deserted_detail.items() if cnt > 0]
            desert_str = "、".join(desert_parts) if desert_parts else "无"
            disband_msg = f"⚠️ 士气低落，士兵正在逃跑！流失了 {to_desert} 名士兵（{desert_str}）。"

    report = (
        f"【每日结算】税收增加：{tax_income} 金 | 耗粮：{total_food_consumed:.1f} | "
        f"当前粮食：{state.food:.1f} | 当前士气：{state.morale}"
    )
    if disband_msg:
        report += f"\n【惩罚警告】{disband_msg}"

    state.add_log(report)
    add_log(state, f"第 {state.day} 天结束。税收: {tax_income}, 耗粮: {total_food_consumed:.1f}")
    return report


def calculate_army_power(troops):
    """根据部队成员数量与单位基础战斗力计算玩家军队总战力。"""
    total_power = 0
    for troop_id, count in troops.items():
        unit_info = UNITS.get(troop_id, {})
        power = unit_info.get("power", 1)
        total_power += power * count
    return total_power


def advance_day(state):
    """推进游戏时间一日。"""
    state.day += 1
    return state


def rest(state):
    """在当前地点休息一日，恢复士气。"""
    advance_day(state)
    morale_gain = 15
    state.morale = min(100, state.morale + morale_gain)
    state.add_log(f"部队进行了休整，恢复了 {morale_gain} 点士气。当前士气：{state.morale}")
    return state


def apply_casualties(troops, casualties):
    """根据需要扣除的伤亡总人数，依次扣减部队兵员数量。"""
    remaining_casualties = casualties
    loss_summary = {troop_id: 0 for troop_id in troops}

    # 按农民 -> 弓箭手 -> 步兵的顺序进行伤亡扣减
    priority_order = ["peasant", "archer", "infantry"]
    for troop_id in priority_order:
        if troop_id in troops and troops[troop_id] > 0 and remaining_casualties > 0:
            loss = min(troops[troop_id], remaining_casualties)
            troops[troop_id] -= loss
            remaining_casualties -= loss
            loss_summary[troop_id] += loss

    # 若还有剩余未扣除兵种，处理其它非标准兵种
    for troop_id in troops:
        if remaining_casualties <= 0:
            break
        if troops[troop_id] > 0:
            loss = min(troops[troop_id], remaining_casualties)
            troops[troop_id] -= loss
            remaining_casualties -= loss
            loss_summary[troop_id] += loss

    return loss_summary


def select_random_event():
    """根据权重随机抽取一个事件。"""
    event_list = list(EVENTS.values())
    weights = [evt.get("weight", 10) for evt in event_list]
    selected_event = random.choices(event_list, weights=weights, k=1)[0]
    return selected_event


def move(state, target_location_id):
    """尝试将玩家移动到目标地点。

    返回:
        (success, message, event_data)
    """
    current_loc = LOCATIONS.get(state.location)
    target_loc = LOCATIONS.get(target_location_id)

    if not current_loc or not target_loc:
        return False, "目标地点不存在", None

    if target_location_id not in current_loc.get("neighbors", []):
        return False, f"无法直接从 {current_loc['name']} 前往 {target_loc['name']}", None

    # 移动消耗1天
    advance_day(state)
    state.location = target_location_id

    # 移动消耗少量士气 (最低归零)
    state.morale = max(0, state.morale - 5)

    # 15% 概率触发倾国倾城仰慕者事件
    app_val = getattr(state, "appearance", 50)
    if app_val >= 96 and random.random() < 0.15:
        admirer_msg = trigger_admirer_event(state)
        state.add_log(admirer_msg)

    # 抽取随机事件
    event = select_random_event()
    event_type = event.get("type")
    event_data = dict(event)

    if event_type == "caravan":
        gold = event.get("gold_reward", 30)
        state.gold += gold
        state.add_log(f"移动至 {target_loc['name']} 途中：{event['description']} 获得 {gold} 金币。")
        add_log(state, f"你在移动途中遭遇了：{event['description']}")
    elif event_type == "treasure":
        gold = event.get("gold_reward", 50)
        state.gold += gold
        state.add_log(f"移动至 {target_loc['name']} 途中：{event['description']} 获得 {gold} 金币。")
        add_log(state, f"你在移动途中遭遇了：{event['description']}")
    elif event_type == "nothing":
        state.add_log(f"移动至 {target_loc['name']} 途中：{event['description']}")
        add_log(state, f"你在移动途中遭遇了：{event['description']}")
    elif event_type == "combat":
        min_pow = event.get("enemy_power_min", 5)
        max_pow = event.get("enemy_power_max", 20)
        enemy_power = random.randint(min_pow, max_pow)
        event_data["enemy_power"] = enemy_power
        state.add_log(f"移动至 {target_loc['name']} 途中：{event['description']} 敌方战力：{enemy_power}。")
        add_log(state, f"你在移动途中遭遇了：{event['description']}")

    return True, f"顺利到达 {target_loc['name']}", event_data


def resolve_combat_simple(state, enemy_power, choice):
    """结算简单战斗模式（包含装备加成、战利品与俘虏）。

    参数:
        state: 当前 GameState 实例
        enemy_power: 敌方战力数值
        choice: 玩家决策 ("attack", "defend", "retreat")

    返回:
        dict: {
            "victory": bool,
            "choice": str,
            "player_power": int,
            "enemy_power": int,
            "total_casualties": int,
            "casualties_detail": dict,
            "gold_gained": int,
            "loot_gained": list,
            "prisoners_gained": dict,
            "message": str
        }
    """
    eq_bonus = sum(
        EQUIPMENT[eq_id]["power_bonus"]
        for eq_id in state.equipment.values()
        if eq_id in EQUIPMENT
    )
    player_power = calculate_army_power(state.troops) + state.personal_power + eq_bonus
    total_soldiers = sum(state.troops.values())

    # 极丑外貌恐吓逻辑 (1 <= appearance <= 10 时敌方受恐吓)
    intimidate_msg = ""
    app_val = getattr(state, "appearance", 0)
    if 1 <= app_val <= 10:
        intimidate_msg = "你的凶恶面容让敌人感到恐惧，敌方士气大减！"
        # 敌方士气下降可表现为敌方有效战力折减
        enemy_power = max(1, int(enemy_power * 0.85))

    # Phase 15: 处决俘虏积累的威慑值按比例折减敌方战力。
    # intimidation 默认为 0，故未处决过俘虏时战斗结算与旧版完全一致。
    intimidation = getattr(state, "intimidation", 0)
    if intimidation > 0:
        reduction = min(0.5, intimidation * INTIMIDATION_ENEMY_REDUCTION)
        enemy_power = max(1, int(enemy_power * (1 - reduction)))
        intimidate_msg += f" 你处决俘虏的凶名传开，敌军未战先怯（敌方战力折减 {int(reduction * 100)}%）！"

    victory = False
    gold_gained = 0
    casualties = 0
    loot_gained = []
    prisoners_gained = {}

    if choice == "retreat":
        victory = False
        gold_gained = 0
        if total_soldiers > 0:
            casualties = min(total_soldiers, max(1, enemy_power // 10))
        else:
            casualties = 0

        loss_detail = apply_casualties(state.troops, casualties)
        message = f"有序撤退避开战斗。伤亡人数：{casualties}。"
        if intimidate_msg:
            message = intimidate_msg + " " + message
        state.add_log(f"遭遇战斗选择撤退。{message}")
        add_log(state, f"战斗撤退，伤亡 {casualties} 人。")

        return {
            "victory": victory,
            "choice": choice,
            "player_power": player_power,
            "enemy_power": enemy_power,
            "total_casualties": casualties,
            "casualties_detail": loss_detail,
            "gold_gained": gold_gained,
            "loot_gained": loot_gained,
            "prisoners_gained": prisoners_gained,
            "message": message,
        }

    elif choice == "attack":
        if player_power >= enemy_power:
            victory = True
            gold_gained = enemy_power * 5
            state.gold += gold_gained
            if total_soldiers > 0:
                damage_ratio = enemy_power / max(1, player_power)
                casualties = min(total_soldiers, int(total_soldiers * damage_ratio * 0.3))
            loss_detail = apply_casualties(state.troops, casualties)
            message = f"强力进攻取得大胜！获得战利品 {gold_gained} 金币，伤亡人数：{casualties}。"
        else:
            victory = False
            gold_gained = 0
            if total_soldiers > 0:
                casualties = min(total_soldiers, max(1, int(total_soldiers * 0.5)))
            loss_detail = apply_casualties(state.troops, casualties)
            message = f"进攻受阻不敌对手。伤亡人数：{casualties}。"

    elif choice == "defend":
        effective_power = int(player_power * 1.3)
        if effective_power >= enemy_power:
            victory = True
            gold_gained = enemy_power * 2
            state.gold += gold_gained
            if total_soldiers > 0:
                damage_ratio = enemy_power / max(1, effective_power)
                casualties = min(total_soldiers, int(total_soldiers * damage_ratio * 0.15))
            loss_detail = apply_casualties(state.troops, casualties)
            message = f"严密坚守击退敌军！获得战利品 {gold_gained} 金币，伤亡人数：{casualties}。"
        else:
            victory = False
            gold_gained = 0
            if total_soldiers > 0:
                casualties = min(total_soldiers, max(1, int(total_soldiers * 0.3)))
            loss_detail = apply_casualties(state.troops, casualties)
            message = f"防线被打破陷入苦战。伤亡人数：{casualties}。"

    else:
        raise ValueError(f"未知的战斗决策: {choice}")

    if intimidate_msg:
        message = intimidate_msg + " " + message

    if victory:
        # 1. 掉落装备 (30% 概率)
        if random.random() < 0.3:
            eq_id = random.choice(list(EQUIPMENT.keys()))
            eq_item = dict(EQUIPMENT[eq_id])
            state.loot.append(eq_item)
            loot_gained.append(eq_item)

        # 2. 生成俘虏 (按 50% 比例将敌方剩余兵力转化为俘虏)
        p_count = max(1, int(enemy_power * 0.5)) if enemy_power > 0 else 0
        if p_count > 0:
            state.prisoners["peasant"] = state.prisoners.get("peasant", 0) + p_count
            prisoners_gained["peasant"] = p_count

        # 3. 更新剿灭匪徒任务进度
        for q in state.active_quests:
            if q.get("type") == "hunt_bandits":
                q["current_count"] = min(q.get("target_count", 1), q.get("current_count", 0) + 1)
    else:
        state.battle_lost_today = True

    # 4. 势力关系扣减判定
    loc_info = LOCATIONS.get(state.location, {})
    faction_id = loc_info.get("faction_id")
    if faction_id and faction_id in state.faction_relations:
        state.faction_relations[faction_id] -= 10
        faction_name = FACTIONS.get(faction_id, {}).get("name", faction_id)
        faction_notice = f"你攻击了 {faction_name} 的部队，关系下降。"
        message += f" ({faction_notice})"

    state.add_log(f"选择{'主动进攻' if choice == 'attack' else '筑防坚守'}。{message}")
    add_log(state, f"战斗{'胜利' if victory else '失败'}，伤亡 {casualties} 人。")
    return {
        "victory": victory,
        "choice": choice,
        "player_power": player_power,
        "enemy_power": enemy_power,
        "total_casualties": casualties,
        "casualties_detail": loss_detail,
        "gold_gained": gold_gained,
        "loot_gained": loot_gained,
        "prisoners_gained": prisoners_gained,
        "message": message,
    }


def sell_prisoners(state, location_id, unit_id, quantity):
    """在指定地点的奴隶市场出售俘虏。

    返回:
        str: 操作结果描述信息
    """
    if quantity <= 0:
        return "卖出数量必须大于 0"

    loc = LOCATIONS.get(location_id)
    if not loc:
        return f"地点 '{location_id}' 不存在"

    if not loc.get("slave_market"):
        return f"[{loc.get('name', location_id)}] 没有奴隶市场！"

    current_prisoners = state.prisoners.get(unit_id, 0)
    unit_info = UNITS.get(unit_id, {})
    unit_name = unit_info.get("name", unit_id)

    if current_prisoners < quantity:
        return f"俘虏数量不足！当前持有 {unit_name} 俘虏：{current_prisoners}，尝试卖出：{quantity}"

    prisoner_val = unit_info.get("prisoner_value", 3)
    income = prisoner_val * quantity

    state.prisoners[unit_id] -= quantity
    state.gold += income

    msg = f"成功在 [{loc['name']}] 卖出 {quantity} 个 {unit_name} 俘虏，获得 {income} 金币。"
    state.add_log(msg)
    return msg


def recruit_prisoner(state, unit_id, quantity):
    """将俘虏招募为己方士兵。

    返回:
        str: 操作结果描述信息
    """
    if quantity <= 0:
        return "招募数量必须大于 0"

    if state.renown < 20:
        return f"声望不足！招募俘虏需要 20 声望，当前声望：{state.renown}"

    current_prisoners = state.prisoners.get(unit_id, 0)
    unit_info = UNITS.get(unit_id, {})
    unit_name = unit_info.get("name", unit_id)

    if current_prisoners < quantity:
        return f"俘虏数量不足！当前持有 {unit_name} 俘虏：{current_prisoners}，尝试招募：{quantity}"

    current_army = sum(state.troops.values())
    if current_army + quantity > state.max_army_size:
        return f"超出带兵上限！当前兵力：{current_army}，上限：{state.max_army_size}，无法招募 {quantity} 人"

    state.prisoners[unit_id] -= quantity
    state.troops[unit_id] = state.troops.get(unit_id, 0) + quantity

    msg = f"成功将 {quantity} 个 {unit_name} 俘虏招募为士兵！"
    state.add_log(msg)
    return msg


def arena_fight(state, location_id, rounds):
    """在城镇竞技场参加 1v1 擂台挑战。

    返回:
        str: 结算报告字符串
    """
    if rounds <= 0:
        return "竞技场轮数必须大于 0"

    loc = LOCATIONS.get(location_id)
    if not loc:
        return f"地点 '{location_id}' 不存在"

    if not loc.get("arena"):
        return f"[{loc.get('name', location_id)}] 没有竞技场！"

    eq_bonus = sum(
        EQUIPMENT[eq_id]["power_bonus"]
        for eq_id in state.equipment.values()
        if eq_id in EQUIPMENT
    )
    player_arena_power = state.personal_power + eq_bonus

    wins = 0
    losses = 0
    gold_change = 0
    renown_change = 0
    morale_change = 0

    for r in range(rounds):
        opp_power = max(1, int(player_arena_power * random.uniform(0.8, 1.2)))
        if player_arena_power >= opp_power:
            wins += 1
            gold_change += 100
            renown_change += 5
        else:
            losses += 1
            gold_change -= 50
            morale_change -= 10

    state.gold = max(0, state.gold + gold_change)
    state.renown = max(0, state.renown + renown_change)
    state.morale = max(0, min(100, state.morale + morale_change))

    report = (
        f"【竞技场结算】在 [{loc['name']}] 完成 {rounds} 轮擂台挑战！"
        f"战绩: {wins} 胜 {losses} 败 | 金币: {gold_change:+d} | "
        f"声望: {renown_change:+d} | 士气: {morale_change:+d}"
    )
    state.add_log(report)
    return report


def trade(state, location_id, action, goods_id, quantity):
    """在指定地点的市场交易商品（买入/卖出）。

    返回:
        str: 操作结果描述信息
    """
    if quantity <= 0:
        return "交易数量必须大于 0"

    loc = LOCATIONS.get(location_id)
    if not loc:
        return f"地点 '{location_id}' 不存在"

    # 计算同伴交易收益加成
    trade_bonus = 0.0
    for c_id in state.companions:
        c_info = COMPANIONS.get(c_id, {})
        if c_info.get("bonus_type") == "trade":
            trade_bonus += c_info.get("bonus_value", 0.0)

    # 特殊支持买粮食指令: buy grain [数量]
    if goods_id in ["grain", "food"]:
        if action == "buy":
            buy_price = 10
            total_cost = buy_price * quantity
            if state.cash < total_cost:
                return f"金钱不足！购买 {quantity} 单位粮食需要 {total_cost} 金，当前金钱：{state.cash}"
            state.cash -= total_cost
            food_gained = quantity * 10
            state.food += food_gained
            msg = f"成功购买 {quantity} 单位粮食（获得 {food_gained} 粮食），花费 {total_cost} 金"
            state.add_log(msg)
            return msg

    market = loc.get("market", {})
    if not market or goods_id not in market:
        goods_name = GOODS.get(goods_id, {}).get("name", goods_id)
        return f"{loc.get('name', location_id)} 的市场不提供商品 '{goods_name}' 的买卖"

    goods_info = GOODS.get(goods_id, {})
    goods_name = goods_info.get("name", goods_id)
    price_info = market[goods_id]

    if action == "buy":
        buy_price = price_info.get("buy_price", 0)
        total_cost = buy_price * quantity
        if state.cash < total_cost:
            return f"金钱不足！购买 {quantity} {goods_name} 需要 {total_cost} 金，当前金钱：{state.cash}"
        state.cash -= total_cost
        state.inventory[goods_id] = state.inventory.get(goods_id, 0) + quantity
        msg = f"成功购买 {quantity} {goods_name}，花费 {total_cost} 金"
        state.add_log(msg)
        return msg

    elif action == "sell":
        base_sell_price = price_info.get("sell_price", 0)
        # Phase 16: 动态物价 —— 世界新闻（瘟疫/战争/丰收等）实时影响卖出行情
        price_mult = get_price_multiplier(state, location_id, goods_id)
        sell_price = int(base_sell_price * (1.0 + trade_bonus) * price_mult)
        current_amount = state.inventory.get(goods_id, 0)
        if current_amount < quantity:
            return f"{goods_name} 数量不足！当前持有：{current_amount}，尝试卖出：{quantity}"
        total_income = sell_price * quantity
        state.inventory[goods_id] -= quantity
        state.cash += total_income
        msg = f"成功卖出 {quantity} {goods_name}，获得 {total_income} 金"
        if trade_bonus > 0:
            msg += f"（含同伴交易加成 +{int(trade_bonus * 100)}%）"
        if abs(price_mult - 1.0) > 1e-9:
            msg += f"（{goods_name} 当前行情 ×{price_mult:.1f}）"
        state.add_log(msg)
        return msg

    else:
        return f"未知的交易操作 '{action}'"


def recruit(state, location_id, unit_id, quantity):
    """在指定地点的兵营招募士兵。

    返回:
        str: 操作结果描述信息
    """
    if quantity <= 0:
        return "招募数量必须大于 0"

    loc = LOCATIONS.get(location_id)
    if not loc:
        return f"地点 '{location_id}' 不存在"

    barracks = loc.get("barracks", [])
    if unit_id not in barracks:
        unit_name = UNITS.get(unit_id, {}).get("name", unit_id)
        return f"{loc.get('name', location_id)} 的兵营不可招募 '{unit_name}'"

    current_army_count = sum(state.troops.values())
    if current_army_count + quantity > state.max_army_size:
        return f"超出带兵上限！当前兵力：{current_army_count}，上限：{state.max_army_size}，无法招募 {quantity} 人"

    unit_info = UNITS.get(unit_id, {})
    unit_name = unit_info.get("name", unit_id)
    base_cost_per_unit = unit_info.get("recruit_cost", 0)

    # 魅力招募折扣: 招募成本 = 基础成本 * (1 - state.attributes['charm'] * 0.02)
    charm = 5
    if hasattr(state, "attributes") and isinstance(state.attributes, dict):
        charm = state.attributes.get("charm", 5)
    cost_discount = max(0.0, 1.0 - charm * 0.02)
    discounted_cost_per_unit = max(1, int(base_cost_per_unit * cost_discount))
    total_cost = discounted_cost_per_unit * quantity

    if state.cash < total_cost:
        return f"金钱不足！招募 {quantity} {unit_name} 需要 {total_cost} 金，当前金钱：{state.cash}"

    state.cash -= total_cost
    state.troops[unit_id] = state.troops.get(unit_id, 0) + quantity
    msg = f"成功招募 {quantity} {unit_name}，花费 {total_cost} 金"
    state.add_log(msg)
    return msg


def declare_kingdom(state, kingdom_name):
    """建国称王逻辑。

    参数:
        state: 当前 GameState 实例
        kingdom_name: 建国名称

    返回:
        str: 操作结果描述信息
    """
    if state.is_king:
        return f"你已经建立了王国 [{state.kingdom_name}]，无需重复建国！"

    if state.renown < 500:
        return f"声望不足，无法建国！建国需要至少 500 声望，当前声望：{state.renown}。"

    if len(state.fiefs) < 3:
        return f"封地不足，无法建国！建国需要至少 3 个封地，当前封地数量：{len(state.fiefs)}。"

    state.is_king = True
    state.kingdom_name = kingdom_name
    msg = f"恭喜！你成功建立王国 [{kingdom_name}]，自立为王！"
    state.add_log(msg)
    add_log(state, f"伟大的 {kingdom_name} 成立了！")
    return msg


def assign_lord(state, companion_id, location_id):
    """分封同伴为领主管理封地。

    参数:
        state: 当前 GameState 实例
        companion_id: 同伴 ID
        location_id: 地点 ID

    返回:
        str: 操作结果描述信息
    """
    if not state.is_king:
        return "尚未建国，无法分封领主！"

    if companion_id not in state.companions:
        comp_name = COMPANIONS.get(companion_id, {}).get("name", companion_id)
        return f"未招募同伴 '{comp_name}'！"

    if companion_id in state.lords:
        comp_name = COMPANIONS.get(companion_id, {}).get("name", companion_id)
        return f"同伴 '{comp_name}' 已经被分封为领主！"

    if location_id not in state.fiefs:
        loc_name = LOCATIONS.get(location_id, {}).get("name", location_id)
        return f"地点 '{loc_name}' 不是你的封地！"

    state.lords.append(companion_id)
    loc = LOCATIONS.get(location_id)
    if loc:
        loc["owner"] = "lord"

    comp_name = COMPANIONS.get(companion_id, {}).get("name", companion_id)
    loc_name = LOCATIONS.get(location_id, {}).get("name", location_id)
    msg = f"成功分封同伴 [{comp_name}] 管理 [{loc_name}]！"
    state.add_log(msg)
    return msg


def set_policy(state, policy_id):
    """制定国家政策。

    参数:
        state: 当前 GameState 实例
        policy_id: 政策 ID

    返回:
        str: 操作结果描述信息
    """
    if not state.is_king:
        return "尚未建国，无法制定国家政策！"

    if policy_id not in POLICIES:
        return f"政策 '{policy_id}' 不存在！"

    old_policy = state.current_policy
    if old_policy != "conscription" and policy_id == "conscription":
        state.max_army_size += 20
    elif old_policy == "conscription" and policy_id != "conscription":
        state.max_army_size -= 20

    state.current_policy = policy_id
    policy_name = POLICIES[policy_id]["name"]
    msg = f"成功制定国家政策：[{policy_name}]！"
    state.add_log(msg)
    return msg


def upgrade_unit(state, unit_id, quantity):
    """将现有部队兵种晋升为高级兵种。

    返回:
        str: 操作结果描述信息
    """
    if quantity <= 0:
        return "晋升数量必须大于 0"

    current_count = state.troops.get(unit_id, 0)
    unit_info = UNITS.get(unit_id, {})
    unit_name = unit_info.get("name", unit_id)

    if current_count < quantity:
        return f"兵员不足！当前拥有 {unit_name}：{current_count}，尝试晋升：{quantity}"

    upgrade_to_id = unit_info.get("upgrade_to")
    if not upgrade_to_id or upgrade_to_id not in UNITS:
        return f"兵种 '{unit_name}' 无法继续晋升"

    target_info = UNITS.get(upgrade_to_id, {})
    target_name = target_info.get("name", upgrade_to_id)
    upgrade_cost_per_unit = unit_info.get("upgrade_cost", 0)
    total_cost = upgrade_cost_per_unit * quantity

    if state.cash < total_cost:
        return f"金钱不足！晋升 {quantity} {unit_name} 需要 {total_cost} 金，当前金钱：{state.cash}"

    state.cash -= total_cost
    state.troops[unit_id] -= quantity
    state.troops[upgrade_to_id] = state.troops.get(upgrade_to_id, 0) + quantity
    msg = f"成功将 {quantity} {unit_name} 晋升为 {quantity} {target_name}，花费 {total_cost} 金"
    state.add_log(msg)
    return msg


def buy_gear(state, gear_id, quantity=1):
    """购买钓鱼装备（鱼竿或饵料）。

    返回:
        str: 操作结果描述信息
    """
    if gear_id not in FISHING_GEAR:
        return f"装备/物品 '{gear_id}' 不存在！"

    if quantity <= 0:
        return "购买数量必须大于 0"

    gear_info = FISHING_GEAR[gear_id]
    gear_name = gear_info["name"]
    price = gear_info["price"]

    if gear_id == "rod":
        if state.equipment_gear.get("rod"):
            return "你已经拥有鱼竿，无需重复购买！"
        quantity = 1

    total_cost = price * quantity
    if state.cash < total_cost:
        return f"金钱不足！购买 {quantity} 个 [{gear_name}] 需要 {total_cost} 金，当前金钱：{state.cash}"

    state.cash -= total_cost
    if gear_id == "rod":
        state.equipment_gear["rod"] = True
        msg = f"成功购买 [{gear_name}]！花费 {total_cost} 金。"
    elif gear_id == "bait":
        state.bait_count += quantity
        msg = f"成功购买 {quantity} 个 [{gear_name}]！花费 {total_cost} 金。"

    state.add_log(msg)
    return msg


def fish(state, location_id):
    """在可钓鱼地点进行钓鱼行动。

    返回:
        str: 操作结果描述信息
    """
    loc = LOCATIONS.get(location_id)
    if not loc:
        return f"地点 '{location_id}' 不存在"

    terrain = loc.get("terrain_type")
    if terrain not in ["river", "lake", "sea"]:
        return f"[{loc.get('name', location_id)}] 不是水源地（河流/湖泊/海边），无法钓鱼！"

    if not state.equipment_gear.get("rod"):
        return "你没有鱼竿，无法钓鱼！请先购买鱼竿。"

    if state.bait_count <= 0:
        return "你的饵料用尽了，无法钓鱼！请先购买饵料。"

    # 消耗 1 单位饵料
    state.bait_count -= 1

    # 推进 1 天时间并触发每日耗粮与结算
    advance_day(state)
    daily_report = daily_update(state)

    # 根据 FISH_LOOT_TABLE 权重随机产出
    items = list(FISH_LOOT_TABLE.keys())
    weights = [FISH_LOOT_TABLE[k]["weight"] for k in items]
    loot_id = random.choices(items, weights=weights, k=1)[0]
    loot_info = FISH_LOOT_TABLE[loot_id]
    loot_name = loot_info["name"]

    state.fish_inventory[loot_id] = state.fish_inventory.get(loot_id, 0) + 1
    msg = f"经过一天的等待，你钓到了 [{loot_name}]！"

    # 同伴自动钓鱼判定
    companion_notes = []
    for comp_id in state.companions:
        comp_info = COMPANIONS.get(comp_id, {})
        if comp_info.get("likes_fishing") and random.random() < 0.30:
            comp_loot_id = random.choices(items, weights=weights, k=1)[0]
            comp_loot_info = FISH_LOOT_TABLE[comp_loot_id]
            comp_loot_name = comp_loot_info["name"]
            state.fish_inventory[comp_loot_id] = state.fish_inventory.get(comp_loot_id, 0) + 1
            comp_name = comp_info.get("name", comp_id)
            companion_notes.append(f"[{comp_name}] 也钓到了一条 [{comp_loot_name}]！")

    if companion_notes:
        msg += "\n" + "\n".join(companion_notes)

    msg += f"\n{daily_report}"
    state.add_log(f"在 [{loc.get('name')}] 钓鱼，获得 [{loot_name}]。")
    return msg


def sell_fish(state, item_id, quantity):
    """在拥有市场的地点出售钓到的鱼或垃圾。

    返回:
        str: 操作结果描述信息
    """
    if quantity <= 0:
        return "出售数量必须大于 0"

    loc = LOCATIONS.get(state.location)
    if not loc or loc.get("market") is None:
        return f"[{loc.get('name', state.location) if loc else state.location}] 没有市场，无法出售物品！"

    if item_id not in FISH_LOOT_TABLE:
        return f"物品 '{item_id}' 不是钓鱼产物！"

    current_qty = state.fish_inventory.get(item_id, 0)
    item_info = FISH_LOOT_TABLE[item_id]
    item_name = item_info["name"]

    if current_qty < quantity:
        return f"[{item_name}] 数量不足！当前持有：{current_qty}，尝试出售：{quantity}"

    unit_val = item_info["value"]
    total_income = unit_val * quantity

    state.fish_inventory[item_id] -= quantity
    state.cash += total_income

    msg = f"成功卖出 {quantity} 个 [{item_name}]，获得 {total_income} 金币。"
    state.add_log(msg)
    return msg


def visit_tavern(state, action=None, tip_amount=20):
    """访问酒馆，与酒馆老板交互并处理喝酒与听传闻选项。"""
    welcome_dialogue = get_formatted_npc_dialogue("tavern_keeper", "enter_tavern", state)

    if action == "drink":
        cost = max(10, tip_amount)
        if state.cash < cost:
            msg = f"金币不足！在酒馆喝酒需要 {cost} 金，当前只有 {state.cash} 金。"
            return {
                "success": False,
                "welcome": welcome_dialogue,
                "dialogue": welcome_dialogue,
                "message": msg,
            }

        state.cash -= cost
        state.morale = min(100, state.morale + 10)
        state.npc_states["tavern_keeper"]["mood"] = "happy"
        drink_dialogue = get_formatted_npc_dialogue("tavern_keeper", "tavern_drink", state)
        msg = f"你花了 {cost} 金币痛饮了一杯。老板收了你的钱，脸色好多了！（士气 +10）"
        state.add_log(msg)
        return {
            "success": True,
            "welcome": welcome_dialogue,
            "dialogue": drink_dialogue,
            "message": msg,
        }

    elif action == "rumor":
        rumors = [
            "听说迷雾森林附近近期有匪徒出没，打败他们能拿到不少战利品。",
            "许昌大都的市场特产丰富，运送麦子过去能卖个好价钱！",
            "黑风山上的强盗凶悍无比，没有足够的精兵切勿贸然前往。",
            "竞技场里经常能见到高筹码押注，有眼光的人一晚就能暴富！",
        ]
        rumor_text = random.choice(rumors)
        msg = f"【酒馆小道消息】{rumor_text}"
        state.add_log(msg)
        return {
            "success": True,
            "welcome": welcome_dialogue,
            "dialogue": welcome_dialogue,
            "message": msg,
        }

    return {
        "success": True,
        "welcome": welcome_dialogue,
        "dialogue": welcome_dialogue,
        "message": "你走进了喧闹的酒馆。",
    }


def visit_smithy(state, action=None):
    """访问铁匠铺，与铁匠交互并处理装备升级选项。"""
    welcome_dialogue = get_formatted_npc_dialogue("blacksmith", "enter_smithy", state)

    if action == "upgrade":
        cost_gold = 100
        cost_iron = 1
        iron_count = state.inventory.get("iron", 0)

        if state.cash < cost_gold or iron_count < cost_iron:
            state.npc_states["blacksmith"]["mood"] = "angry"
            taunt_dialogue = get_formatted_npc_dialogue("blacksmith", "blacksmith_no_money", state)
            msg = f"资源不足！升级装备需要 {cost_gold} 金与 {cost_iron} 单位铁。铁匠见你没钱，气得哼了一声！"
            state.add_log(msg)
            return {
                "success": False,
                "welcome": welcome_dialogue,
                "dialogue": taunt_dialogue,
                "message": msg,
            }

        state.cash -= cost_gold
        state.inventory["iron"] -= cost_iron
        state.personal_power += 3
        state.npc_states["blacksmith"]["mood"] = "happy"
        upgrade_dialogue = get_formatted_npc_dialogue("blacksmith", "blacksmith_upgrade", state)
        msg = "升级成功！铁匠为你打造了更精良的兵刃，个人战力 +3！铁匠收了材料与工钱，心情大好！"
        state.add_log(msg)
        return {
            "success": True,
            "welcome": welcome_dialogue,
            "dialogue": upgrade_dialogue,
            "message": msg,
        }

    return {
        "success": True,
        "welcome": welcome_dialogue,
        "dialogue": welcome_dialogue,
        "message": "你走进了火光熊熊的铁匠铺。",
    }


def visit_arena(state, action=None, bet_amount=50):
    """访问竞技场，与主持人交互并处理自己打或押注选项。"""
    welcome_dialogue = get_formatted_npc_dialogue("arena_host", "enter_arena", state)

    if action == "fight":
        report = arena_fight(state, state.location, 1)
        return {
            "success": True,
            "welcome": welcome_dialogue,
            "dialogue": welcome_dialogue,
            "message": report,
        }

    elif action == "bet":
        if bet_amount <= 0:
            return {
                "success": False,
                "welcome": welcome_dialogue,
                "dialogue": welcome_dialogue,
                "message": "押注金额必须大于 0！",
            }

        if state.cash < bet_amount:
            msg = f"金币不足！无法下注 {bet_amount} 金币，当前拥有 {state.cash} 金币。"
            return {
                "success": False,
                "welcome": welcome_dialogue,
                "dialogue": welcome_dialogue,
                "message": msg,
            }

        state.cash -= bet_amount
        win = random.random() < 0.5

        if win:
            gain = bet_amount * 2
            state.cash += gain
            state.npc_states["arena_host"]["mood"] = "happy"
            win_dialogue = get_formatted_npc_dialogue("arena_host", "arena_bet_win", state)
            msg = f"押注胜利！赢得了 {gain} 金币（净赚 {bet_amount} 金）。主持人看你赢了大钱，笑脸相迎！"
            state.add_log(msg)
            return {
                "success": True,
                "welcome": welcome_dialogue,
                "dialogue": win_dialogue,
                "message": msg,
            }
        else:
            state.npc_states["arena_host"]["mood"] = "angry"
            lose_dialogue = get_formatted_npc_dialogue("arena_host", "arena_bet_lose", state)
            msg = f"押注失败！损失了 {bet_amount} 金币。主持人肆意嘲笑了你的决策！"
            state.add_log(msg)
            return {
                "success": False,
                "welcome": welcome_dialogue,
                "dialogue": lose_dialogue,
                "message": msg,
            }

    return {
        "success": True,
        "welcome": welcome_dialogue,
        "dialogue": welcome_dialogue,
        "message": "你来到了热血沸腾的竞技场。",
    }


# ===== Phase 14：酒馆真实感重构 —— 三教九流与市井生态 =====

def set_npc_mood(state, npc_id, mood):
    """安全地设置某个 NPC 的心情，若其状态条目缺失（旧存档）则自动补建。"""
    if not hasattr(state, "npc_states") or state.npc_states is None:
        state.npc_states = {}
    if npc_id not in state.npc_states:
        state.npc_states[npc_id] = {"mood": "neutral", "last_interaction": ""}
    state.npc_states[npc_id]["mood"] = mood


def listen_bard(state):
    """聆听游吟诗人弹唱：花费金钱、恢复士气，并逐步解锁大陆世界观故事。"""
    welcome_dialogue = get_formatted_npc_dialogue("bard", "bard_listen", state)
    if state.cash < BARD_LISTEN_COST:
        msg = f"金币不足！聆听一曲需要 {BARD_LISTEN_COST} 金，你当前只有 {state.cash} 金。"
        return {"success": False, "welcome": welcome_dialogue, "dialogue": welcome_dialogue, "story": "", "message": msg}
    state.cash -= BARD_LISTEN_COST
    state.morale = min(100, state.morale + BARD_MORALE_GAIN)
    set_npc_mood(state, "bard", "happy")
    unheard = [s for s in BARD_STORIES if s not in state.unlocked_lore]
    story = random.choice(unheard) if unheard else random.choice(BARD_STORIES)
    if unheard:
        state.unlocked_lore.append(story)
    end_dialogue = get_formatted_npc_dialogue("bard", "bard_story_end", state)
    msg = f"你花 {BARD_LISTEN_COST} 金听了一段弹唱，心绪为之一振（士气 +{BARD_MORALE_GAIN}）。\n{story}"
    state.add_log(msg)
    return {"success": True, "welcome": welcome_dialogue, "dialogue": end_dialogue, "story": story, "message": msg}


def gamble_dice(state, bet):
    """与赌徒掷骰子赌博：双方各掷一枚骰子比大小，输赢改变赌徒心情。"""
    welcome_dialogue = get_formatted_npc_dialogue("gambler", "gambler_invite", state)
    if bet < GAMBLER_MIN_BET:
        return {"success": False, "welcome": welcome_dialogue, "dialogue": welcome_dialogue,
                "message": f"押注过少！赌徒嗤笑一声：最少押 {GAMBLER_MIN_BET} 金才配坐下。",
                "result": "invalid", "net": 0, "player_die": 0, "gambler_die": 0}
    if state.cash < bet:
        set_npc_mood(state, "gambler", "angry")
        return {"success": False, "welcome": welcome_dialogue, "dialogue": welcome_dialogue,
                "message": f"金币不足！你无法押注 {bet} 金，当前只有 {state.cash} 金。赌徒不耐烦地轰你走。",
                "result": "invalid", "net": 0, "player_die": 0, "gambler_die": 0}
    state.cash -= bet
    player_die = random.randint(1, 6)
    gambler_die = random.randint(1, 6)
    if player_die > gambler_die:
        state.cash += bet * 2
        net, result = bet, "win"
        set_npc_mood(state, "gambler", "angry")
        result_dialogue = get_formatted_npc_dialogue("gambler", "gambler_win", state)
        msg = f"骰子落定：你 {player_die} 点 vs 赌徒 {gambler_die} 点，你赢了！净赚 {net} 金。"
    elif player_die < gambler_die:
        net, result = -bet, "lose"
        set_npc_mood(state, "gambler", "happy")
        result_dialogue = get_formatted_npc_dialogue("gambler", "gambler_lose", state)
        msg = f"骰子落定：你 {player_die} 点 vs 赌徒 {gambler_die} 点，你输了！损失 {bet} 金。"
    else:
        net, result = 0, "tie"
        state.cash += bet
        set_npc_mood(state, "gambler", "neutral")
        result_dialogue = welcome_dialogue
        msg = f"骰子落定：双方都是 {player_die} 点，平局！赌徒悻悻退还了你的押注。"
    state.add_log(msg)
    return {"success": result == "win", "welcome": welcome_dialogue, "dialogue": result_dialogue,
            "message": msg, "result": result, "net": net, "player_die": player_die, "gambler_die": gambler_die}


def beggar_interact(state, action=None):
    """与乞丐进行道德抉择交互：施舍加声望，拒绝则可能被顺手牵羊。"""
    welcome_dialogue = get_formatted_npc_dialogue("beggar", "beggar_plead", state)
    if action == "give":
        cost = BEGGAR_ALMS
        if state.cash < cost:
            return {"success": False, "welcome": welcome_dialogue, "dialogue": welcome_dialogue,
                    "message": f"你摸了摸干瘪的钱袋，连 {cost} 金的施舍都拿不出，只得讪讪走开。", "stolen": 0}
        state.cash -= cost
        state.renown += BEGGAR_RENOWN_GAIN
        set_npc_mood(state, "beggar", "happy")
        grateful = get_formatted_npc_dialogue("beggar", "beggar_grateful", state)
        msg = f"你施舍了 {cost} 金。乞丐千恩万谢，你的仁义之名悄然传开（声望 +{BEGGAR_RENOWN_GAIN}）。"
        state.add_log(msg)
        return {"success": True, "welcome": welcome_dialogue, "dialogue": grateful, "message": msg, "stolen": 0}
    elif action == "refuse":
        set_npc_mood(state, "beggar", "angry")
        curse = get_formatted_npc_dialogue("beggar", "beggar_curse", state)
        stolen = 0
        if state.cash > 0 and random.random() < BEGGAR_STEAL_CHANCE:
            stolen = min(BEGGAR_STEAL_AMOUNT, state.cash)
            state.cash -= stolen
            msg = f"你冷冷拒绝。乞丐眼中闪过一丝怨毒，趁乱摸走了你 {stolen} 金！(声望未增)"
        else:
            msg = "你摇了摇头，转身离去。乞丐在身后咒骂了几句，却不敢真的动手。"
        state.add_log(msg)
        return {"success": True, "welcome": welcome_dialogue, "dialogue": curse, "message": msg, "stolen": stolen}
    return {"success": True, "welcome": welcome_dialogue, "dialogue": welcome_dialogue,
            "message": "一个衣衫褴褛的乞丐拦在你面前，伸出枯瘦的手乞求施舍。", "stolen": 0}


def recruit_deserter(state):
    """招揽酒馆中的逃兵：强力但会因窝藏逃兵而得罪各势力。"""
    welcome_dialogue = get_formatted_npc_dialogue("deserter", "deserter_hide", state)
    if getattr(state, "deserter_recruited", False):
        return {"success": False, "welcome": welcome_dialogue, "dialogue": welcome_dialogue,
                "message": "那名逃兵早已归入你的麾下，此刻正在营中当值。"}
    if state.cash < DESERTER_RECRUIT_COST:
        return {"success": False, "welcome": welcome_dialogue, "dialogue": welcome_dialogue,
                "message": f"金币不足！替逃兵打点官府、收买缉兵需要 {DESERTER_RECRUIT_COST} 金，你当前只有 {state.cash} 金。"}
    state.cash -= DESERTER_RECRUIT_COST
    state.deserter_recruited = True
    state.personal_power += DESERTER_POWER_BONUS
    state.max_army_size += DESERTER_ARMY_BONUS
    for fid in state.faction_relations:
        state.faction_relations[fid] -= DESERTER_RELATION_PENALTY
    set_npc_mood(state, "deserter", "happy")
    join_dialogue = get_formatted_npc_dialogue("deserter", "deserter_join", state)
    msg = (f"你花 {DESERTER_RECRUIT_COST} 金替逃兵打点了官府，将他收为麾下死士！"
           f"（个人战力 +{DESERTER_POWER_BONUS}，带兵上限 +{DESERTER_ARMY_BONUS}）"
           f"但窝藏逃兵的行径传了出去，三大势力对你的观感皆下降 {DESERTER_RELATION_PENALTY} 点。")
    state.add_log(msg)
    return {"success": True, "welcome": welcome_dialogue, "dialogue": join_dialogue, "message": msg}


def decline_deserter(state):
    """婉拒逃兵的投靠请求，仅返回其台词而不改变数值。"""
    welcome_dialogue = get_formatted_npc_dialogue("deserter", "deserter_hide", state)
    refuse_dialogue = get_formatted_npc_dialogue("deserter", "deserter_refuse", state)
    return {"success": True, "welcome": welcome_dialogue, "dialogue": refuse_dialogue,
            "message": "你婉言谢绝了逃兵的投靠，他黯然退回了酒馆的阴影里。"}


# ===== Phase 15：战场真实感 —— 打扫战场与俘虏处理 =====

def quick_withdraw(state):
    """战后快速撤离：安全返回，不消耗额外天数、无额外收益。"""
    msg = "你当机立断，率部快速撤离了战场，敌军残部无从追击，全军而退。"
    state.add_log(msg)
    add_log(state, "战后快速撤离，安全返回。")
    return {"success": True, "message": msg, "days": 0}


def scavenge_battlefield(state, enemy_power=10):
    """打扫战场：耗时 1-2 天，获得高额金币与概率装备，但有概率遭遇伏击。"""
    days = random.randint(SCAVENGE_MIN_DAYS, SCAVENGE_MAX_DAYS)
    gold_gained = max(10, enemy_power * SCAVENGE_GOLD_PER_ENEMY_POWER)
    state.cash += gold_gained
    loot_gained = []
    if random.random() < SCAVENGE_LOOT_CHANCE:
        eq_id = random.choice(list(EQUIPMENT.keys()))
        eq_item = dict(EQUIPMENT[eq_id])
        state.loot.append(eq_item)
        loot_gained.append(eq_item)
    narr = random.choice(SCAVENGE_SUCCESS_TEXTS)
    msg = f"你决定打扫战场。{narr}获得 {gold_gained} 金币"
    if loot_gained:
        msg += f"，并搜得装备 [{loot_gained[0]['name']}]"
    ambushed = False
    losses = 0
    stolen_gold = 0
    if random.random() < SCAVENGE_AMBUSH_CHANCE:
        ambushed = True
        ambush_text = random.choice(SCAVENGE_AMBUSH_TEXTS)
        total_soldiers = sum(state.troops.values())
        msg += f"\n【遭遇伏击】{ambush_text}"
        if total_soldiers > 0 and random.random() < 0.6:
            losses = min(total_soldiers, random.randint(1, 3))
            apply_casualties(state.troops, losses)
            msg += f" 混战之中，你损失了 {losses} 名士兵！"
        else:
            stolen_gold = min(state.cash, random.randint(20, 60))
            state.cash -= stolen_gold
            msg += f" 慌乱之中，被夺走了 {stolen_gold} 金币！"
    reports = []
    for _ in range(days):
        advance_day(state)
        reports.append(daily_update(state))
    msg += f"\n打扫战场共耗时 {days} 天。"
    state.add_log(msg)
    add_log(state, f"打扫战场耗时 {days} 天" + ("，途中遭遇伏击" if ambushed else ""))
    return {"success": True, "message": msg, "days": days, "gold_gained": gold_gained,
            "loot_gained": loot_gained, "ambushed": ambushed, "reports": reports}


def _get_prisoner_unit_name(unit_id):
    return UNITS.get(unit_id, {}).get("name", unit_id)


def _reduce_faction_relation(state, penalty):
    loc = LOCATIONS.get(state.location, {})
    faction_id = loc.get("faction_id")
    if faction_id and faction_id in state.faction_relations:
        state.faction_relations[faction_id] -= penalty
        return FACTIONS.get(faction_id, {}).get("name", faction_id)
    for fid in state.faction_relations:
        state.faction_relations[fid] -= penalty
    return "各大势力"


def ransom_prisoners(state, unit_id, quantity):
    """索要赎金：换取大量金币，但会降低势力关系。"""
    if quantity <= 0:
        return "数量必须大于 0"
    have = state.prisoners.get(unit_id, 0)
    if have < quantity:
        unit_name = _get_prisoner_unit_name(unit_id)
        return f"俘虏不足！当前 {unit_name} 俘虏：{have}，尝试勒索：{quantity}"
    unit_name = _get_prisoner_unit_name(unit_id)
    income = RANSOM_GOLD_PER_PRISONER * quantity
    state.prisoners[unit_id] -= quantity
    state.cash += income
    hit_faction = _reduce_faction_relation(state, RANSOM_RELATION_PENALTY)
    msg = f"你派使者向俘虏的家族索要赎金，成功换得 {income} 金币！但此举令 {hit_faction} 对你的观感下降 {RANSOM_RELATION_PENALTY} 点。"
    state.add_log(msg)
    return msg


def release_prisoners(state, unit_id, quantity):
    """释放俘虏：赢得声望与仁义之名（提升道德值）。"""
    if quantity <= 0:
        return "数量必须大于 0"
    have = state.prisoners.get(unit_id, 0)
    if have < quantity:
        unit_name = _get_prisoner_unit_name(unit_id)
        return f"俘虏不足！当前 {unit_name} 俘虏：{have}，尝试释放：{quantity}"
    unit_name = _get_prisoner_unit_name(unit_id)
    state.prisoners[unit_id] -= quantity
    renown_gain = RELEASE_RENOWN_PER_PRISONER * quantity
    morality_gain = RELEASE_MORALITY_GAIN * quantity
    state.renown += renown_gain
    state.morality = min(100, state.morality + morality_gain)
    msg = f"你解开了 {quantity} 名 {unit_name} 俘虏的绳索，放他们归乡。你的仁义之名远播（声望 +{renown_gain}，道德 +{morality_gain}）。"
    state.add_log(msg)
    return msg


def execute_prisoners(state, unit_id, quantity):
    """处决俘虏：道德大损、势力震怒，但积累威慑值并折减来犯敌军战力。"""
    if quantity <= 0:
        return "数量必须大于 0"
    have = state.prisoners.get(unit_id, 0)
    if have < quantity:
        unit_name = _get_prisoner_unit_name(unit_id)
        return f"俘虏不足！当前 {unit_name} 俘虏：{have}，尝试处决：{quantity}"
    unit_name = _get_prisoner_unit_name(unit_id)
    state.prisoners[unit_id] -= quantity
    state.morality = max(0, state.morality - EXECUTE_MORALITY_LOSS * quantity)
    state.intimidation = min(INTIMIDATION_CAP, state.intimidation + EXECUTE_INTIMIDATION_GAIN * quantity)
    state.renown += EXECUTE_RENOWN_GAIN * quantity
    hit_faction = _reduce_faction_relation(state, EXECUTE_RELATION_PENALTY)
    msg = (f"你下令当众处决了 {quantity} 名 {unit_name} 俘虏！你的凶名传遍四方"
           f"（威慑 +{EXECUTE_INTIMIDATION_GAIN * quantity}，声望 +{EXECUTE_RENOWN_GAIN * quantity}），"
           f"但道德大损、{hit_faction} 对你怒不可遏（关系 -{EXECUTE_RELATION_PENALTY}）。")

    # Phase 16: 恩怨系统 —— 处决会令该势力的某位领主与你结下血仇
    loc_faction = LOCATIONS.get(state.location, {}).get("faction_id")
    if loc_faction:
        lords = lords_of_faction(loc_faction)
        if lords:
            angered = random.choice(lords)
            if provoke_lord_grudge(state, angered["id"]):
                msg += f"\n【结下血仇】{angered['title']} 因你残害其子民而与你结怨，其家族将世代记恨。"

    state.add_log(msg)
    return msg


def get_loot_opinion_quotes(state):
    """战斗胜利后，已招募同伴依据各自性格对分赃发表意见。"""
    quotes = []
    for comp_id in getattr(state, "companions", []):
        comp_info = COMPANIONS.get(comp_id)
        if not comp_info:
            comp_info = {"id": comp_id, "name": comp_id, "personality": "cautious"}
        comp_name = comp_info.get("name", comp_id)
        text = get_dialogue(comp_info, "loot_opinion", state)
        quotes.append(f"[{comp_name}]: “{text}”")
    return quotes


# ===== Phase 16：世界真实感 —— 领主、动态新闻与恩怨系统 =====

def lords_of_faction(faction_id):
    """返回某势力旗下的全部领主（按名册插入顺序）。"""
    return [lord for lord in LORDS.values() if lord["faction_id"] == faction_id]


def get_faction_lord(faction_id):
    """返回某势力的主要领主（名册首位），用于决定其治下任务报酬风格。"""
    lords = lords_of_faction(faction_id)
    return lords[0] if lords else None


def provoke_lord_grudge(state, lord_id):
    """记录与某领主结下的血仇；若已存在或领主非法则返回 False。"""
    if lord_id not in LORDS:
        return False
    if not hasattr(state, "lord_grudges") or state.lord_grudges is None:
        state.lord_grudges = []
    if lord_id in state.lord_grudges:
        return False
    state.lord_grudges.append(lord_id)
    add_log(state, f"你与 {LORDS[lord_id]['title']} 结下了血仇。")
    return True


def apply_lord_grudge_decay(state):
    """每日结算：与你结怨的领主，其所属势力关系持续缓慢恶化（永不修复）。"""
    grudges = getattr(state, "lord_grudges", [])
    if not grudges:
        return
    for lord_id in grudges:
        lord = LORDS.get(lord_id)
        if not lord:
            continue
        fid = lord["faction_id"]
        if fid in state.faction_relations:
            state.faction_relations[fid] -= LORD_GRUDGE_DECAY


def get_lord_stance(state, lord_id):
    """判断某领主对你的立场：血仇 / 敌对 / 友好 / 中立。"""
    lord = LORDS.get(lord_id)
    if not lord:
        return "unknown"
    if lord_id in getattr(state, "lord_grudges", []):
        return "grudge"
    rel = state.faction_relations.get(lord["faction_id"], 0)
    if rel <= -20:
        return "hostile"
    if rel >= 40:
        return "friendly"
    return "neutral"


def meet_lord(state, lord_id):
    """拜会领主：依据声望、性格与恩怨返回动态台词与当前立场。"""
    lord = LORDS.get(lord_id)
    if not lord:
        return {"success": False, "title": "", "stance": "unknown", "dialogue": "", "message": f"查无此领主: '{lord_id}'"}
    stance = get_lord_stance(state, lord_id)
    npc = dict(lord)
    if stance == "grudge":
        npc["mood"] = "angry"
    dialogue = get_formatted_npc_dialogue(npc, "lord_talk", state)
    stance_label = {"grudge": "血仇", "hostile": "敌对", "friendly": "友好", "neutral": "中立"}.get(stance, "未知")
    faction_name = FACTIONS[lord["faction_id"]]["name"]
    msg = f"你拜会了 {lord['title']}。（所属：{faction_name}，当前立场：{stance_label}）"
    state.add_log(msg)
    return {"success": True, "title": lord["title"], "stance": stance, "dialogue": dialogue, "message": msg}


def generate_world_news(state):
    """按概率生成一条世界新闻并写入 state.world_news（会真实影响物价）。"""
    if not hasattr(state, "world_news") or state.world_news is None:
        state.world_news = []
    if random.random() >= WORLD_NEWS_CHANCE:
        return None
    tpl = random.choice(NEWS_TEMPLATES)
    if tpl["scope"] == "location":
        loc_id = random.choice(list(LOCATIONS.keys()))
        desc = tpl["template"].format(loc=LOCATIONS[loc_id]["name"])
        location_id = loc_id
    else:
        fid = random.choice(list(FACTIONS.keys()))
        desc = tpl["template"].format(faction=FACTIONS[fid]["name"])
        location_id = None
    entry = {
        "id": f"news_{state.day}_{random.randint(1, 9999)}",
        "day": state.day,
        "type": tpl["type"],
        "desc": desc,
        "goods": tpl["goods"],
        "sell_multiplier": tpl["sell_multiplier"],
        "location_id": location_id,
        "expires_day": state.day + tpl["duration"],
    }
    state.world_news.append(entry)
    if len(state.world_news) > WORLD_NEWS_HISTORY_LIMIT:
        state.world_news = state.world_news[-WORLD_NEWS_HISTORY_LIMIT:]
    state.add_log(f"【世界新闻】{desc}")
    add_log(state, f"世界新闻：{desc}")
    return entry


def get_active_news(state):
    """返回当前尚未过期的世界新闻列表。"""
    return [n for n in getattr(state, "world_news", []) if state.day <= n.get("expires_day", 0)]


def get_price_multiplier(state, location_id, goods_id):
    """依据当前生效的世界新闻，计算某地点某商品卖出价的倍率（最低 0.1）。"""
    multiplier = 1.0
    for news in get_active_news(state):
        if news.get("goods") != goods_id:
            continue
        nloc = news.get("location_id")
        if nloc is not None and nloc != location_id:
            continue
        multiplier *= news.get("sell_multiplier", 1.0)
    return max(0.1, multiplier)


# ===== Phase 17：经济真实感 —— 产业链加工与讨价还价 =====

def has_facility(location_id, facility):
    """判断某地点是否拥有指定加工设施。"""
    return facility in LOCATIONS.get(location_id, {}).get("facilities", [])


def list_recipes(location_id):
    """返回某地点凭借现有设施可承接的加工配方列表。"""
    return [r for r in RECIPES.values() if has_facility(location_id, r["facility"])]


def commission_crafting(state, recipe_id, location_id=None):
    """委托加工：以原料 + 手续费换取更高价值的成品。"""
    loc_id = location_id if location_id is not None else state.location
    recipe = RECIPES.get(recipe_id)
    if not recipe:
        return f"未知的加工配方 '{recipe_id}'"
    loc = LOCATIONS.get(loc_id, {})
    fac_name = FACILITY_NAMES.get(recipe["facility"], "工坊")
    if not has_facility(loc_id, recipe["facility"]):
        return f"[{loc.get('name', loc_id)}] 没有{fac_name}，无法进行 [{recipe['name']}] 加工！"
    in_goods, in_amount, fee = recipe["input_goods"], recipe["input_amount"], recipe["fee"]
    in_name = GOODS.get(in_goods, {}).get("name", in_goods)
    have = state.inventory.get(in_goods, 0)
    if have < in_amount:
        return f"原料不足！[{recipe['name']}] 需要 {in_amount} 单位 {in_name}，当前持有 {have}"
    if state.cash < fee:
        return f"金钱不足！[{recipe['name']}] 委托手续费需 {fee} 金，当前只有 {state.cash} 金"
    out_goods, out_amount = recipe["output_goods"], recipe["output_amount"]
    out_name = GOODS.get(out_goods, {}).get("name", out_goods)
    state.inventory[in_goods] -= in_amount
    state.cash -= fee
    state.inventory[out_goods] = state.inventory.get(out_goods, 0) + out_amount
    msg = (f"你在 [{loc.get('name', loc_id)}] 的{fac_name}委托 [{recipe['name']}]："
           f"{in_amount} {in_name} + {fee} 金手续费 → {out_amount} {out_name}。成品售价远高于原料！")
    state.add_log(msg)
    return msg


def haggle_trade(state, location_id, action, goods_id, quantity):
    """讨价还价交易：魅力决定议价空间，掷骰决定成败，并叠加世界新闻行情。不改动原 trade()。"""
    loc = LOCATIONS.get(location_id, {})
    market = loc.get("market", {})
    goods_name = GOODS.get(goods_id, {}).get("name", goods_id)
    if quantity <= 0:
        return {"success": False, "result": "invalid", "discount": 0.0, "dialogue": "", "message": "交易数量必须大于 0"}
    if not market or goods_id not in market:
        return {"success": False, "result": "invalid", "discount": 0.0, "dialogue": "",
                "message": f"{loc.get('name', location_id)} 不提供 {goods_name} 的买卖"}
    price_info = market[goods_id]
    price_mult = get_price_multiplier(state, location_id, goods_id)
    if action == "buy":
        ref_price = price_info.get("buy_price", 0) * price_mult
    elif action == "sell":
        ref_price = price_info.get("sell_price", 0) * price_mult
    else:
        return {"success": False, "result": "invalid", "discount": 0.0, "dialogue": "", "message": f"未知的交易操作 '{action}'"}
    charm = 5
    if getattr(state, "attributes", None):
        charm = state.attributes.get("charm", 5)
    base_power = min(HAGGLE_MAX_DISCOUNT, charm * HAGGLE_CHARM_FACTOR)
    roll = random.random()
    if roll < HAGGLE_FAIL_RATE:
        result, discount = "fail", 0.0
        dialogue = get_formatted_npc_dialogue("merchant", "haggle_fail", state)
    elif roll < HAGGLE_FAIL_RATE + HAGGLE_BIG_SUCCESS_RATE:
        result = "big"
        discount = min(HAGGLE_MAX_DISCOUNT, base_power * 1.5)
        dialogue = get_formatted_npc_dialogue("merchant", "haggle_win", state)
    else:
        result, discount = "ok", base_power
        dialogue = get_formatted_npc_dialogue("merchant", "haggle_ok", state)
    if action == "buy":
        unit = max(1, int(ref_price * (1 - discount)))
        total = unit * quantity
        if state.cash < total:
            return {"success": False, "result": result, "discount": discount, "dialogue": dialogue,
                    "message": f"金钱不足！议定单价 {unit} 金，购买 {quantity} {goods_name} 需 {total} 金，当前 {state.cash} 金"}
        state.cash -= total
        state.inventory[goods_id] = state.inventory.get(goods_id, 0) + quantity
        msg = f"讨价还价后买入 {quantity} {goods_name}，单价 {unit} 金（原价 {int(ref_price)}），共 {total} 金。"
    else:
        have = state.inventory.get(goods_id, 0)
        if have < quantity:
            return {"success": False, "result": result, "discount": discount, "dialogue": dialogue,
                    "message": f"{goods_name} 数量不足！当前持有 {have}，尝试卖出 {quantity}"}
        unit = int(ref_price * (1 + discount))
        total = unit * quantity
        state.inventory[goods_id] -= quantity
        state.cash += total
        msg = f"讨价还价后卖出 {quantity} {goods_name}，单价 {unit} 金（原价 {int(ref_price)}），共 {total} 金。"
    state.add_log(msg)
    return {"success": True, "result": result, "discount": discount, "dialogue": dialogue, "message": msg}
