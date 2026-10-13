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
)

_quest_id_counter = 1


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
        sell_price = int(base_sell_price * (1.0 + trade_bonus))
        current_amount = state.inventory.get(goods_id, 0)
        if current_amount < quantity:
            return f"{goods_name} 数量不足！当前持有：{current_amount}，尝试卖出：{quantity}"
        total_income = sell_price * quantity
        state.inventory[goods_id] -= quantity
        state.cash += total_income
        msg = f"成功卖出 {quantity} {goods_name}，获得 {total_income} 金"
        if trade_bonus > 0:
            msg += f"（含同伴交易加成 +{int(trade_bonus * 100)}%）"
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
    cost_per_unit = unit_info.get("recruit_cost", 0)
    total_cost = cost_per_unit * quantity

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
