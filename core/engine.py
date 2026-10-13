"""核心引擎逻辑模块：包含大地图移动、休息、事件触发与简单战斗结算。

纯逻辑计算，不包含任何 UI、print() 或 input()。
"""

import random
from core.data import LOCATIONS, EVENTS, UNITS, GOODS, COMPANIONS


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
    """每日结算：收税、耗粮与士气/解散判定。

    返回:
        str: 每日结算报告字符串
    """
    # 1. 收税
    tax_income = 0
    for fief_id in state.fiefs:
        f_info = LOCATIONS.get(fief_id, {})
        tax_income += f_info.get("tax_income", 0)
    state.cash += tax_income

    # 2. 耗粮
    total_food_consumed = 0.0
    for unit_id, count in state.troops.items():
        if count > 0:
            u_info = UNITS.get(unit_id, {})
            rate = u_info.get("food_consumption", 1.0)
            total_food_consumed += count * rate

    state.food -= total_food_consumed

    disband_msg = ""
    # 3. 士气与粮草断绝判定
    if state.food < 0:
        state.food = 0.0
        state.morale = max(0, state.morale - 20)

    if state.morale <= 0:
        # 强制解散一半兵力（从低级兵开始）
        total_soldiers = sum(state.troops.values())
        to_disband = total_soldiers // 2
        remaining_disband = to_disband
        disbanded_detail = {}

        priority_order = ["peasant", "archer", "infantry"]
        for unit_id in priority_order:
            if unit_id in state.troops and state.troops[unit_id] > 0 and remaining_disband > 0:
                loss = min(state.troops[unit_id], remaining_disband)
                state.troops[unit_id] -= loss
                remaining_disband -= loss
                disbanded_detail[unit_id] = loss

        for unit_id in state.troops:
            if remaining_disband <= 0:
                break
            if state.troops[unit_id] > 0:
                loss = min(state.troops[unit_id], remaining_disband)
                state.troops[unit_id] -= loss
                remaining_disband -= loss
                disbanded_detail[unit_id] = loss

        state.morale = 50
        disband_parts = [f"{UNITS.get(uid, {}).get('name', uid)} {cnt} 人" for uid, cnt in disbanded_detail.items() if cnt > 0]
        disband_str = "、".join(disband_parts) if disband_parts else "无"
        disband_msg = f"军队士气归零崩盘！解散了半数军队（{to_disband} 人: {disband_str}），士气恢复至 50。"

    report = (
        f"【每日结算】税收增加：{tax_income} 金 | 耗粮：{total_food_consumed:.1f} | "
        f"当前粮食：{state.food:.1f} | 当前士气：{state.morale}"
    )
    if disband_msg:
        report += f"\n【惩罚警告】{disband_msg}"

    state.add_log(report)
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
    elif event_type == "treasure":
        gold = event.get("gold_reward", 50)
        state.gold += gold
        state.add_log(f"移动至 {target_loc['name']} 途中：{event['description']} 获得 {gold} 金币。")
    elif event_type == "nothing":
        state.add_log(f"移动至 {target_loc['name']} 途中：{event['description']}")
    elif event_type == "combat":
        min_pow = event.get("enemy_power_min", 5)
        max_pow = event.get("enemy_power_max", 20)
        enemy_power = random.randint(min_pow, max_pow)
        event_data["enemy_power"] = enemy_power
        state.add_log(f"移动至 {target_loc['name']} 途中：{event['description']} 敌方战力：{enemy_power}。")

    return True, f"顺利到达 {target_loc['name']}", event_data


def resolve_combat_simple(state, enemy_power, choice):
    """结算简单战斗模式（无兵种克制）。

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
            "message": str
        }
    """
    player_power = calculate_army_power(state.troops)
    total_soldiers = sum(state.troops.values())

    victory = False
    gold_gained = 0
    casualties = 0

    if choice == "retreat":
        # 撤退：可能损失极少量兵员但绝对安全
        victory = False
        gold_gained = 0
        if total_soldiers > 0:
            casualties = min(total_soldiers, max(1, enemy_power // 10))
        else:
            casualties = 0

        loss_detail = apply_casualties(state.troops, casualties)
        message = f"有序撤退避开战斗。伤亡人数：{casualties}。"
        state.add_log(f"遭遇战斗选择撤退。{message}")

        return {
            "victory": victory,
            "choice": choice,
            "player_power": player_power,
            "enemy_power": enemy_power,
            "total_casualties": casualties,
            "casualties_detail": loss_detail,
            "gold_gained": gold_gained,
            "message": message,
        }

    elif choice == "attack":
        # 进攻：高伤亡高收益
        if player_power >= enemy_power:
            victory = True
            gold_gained = enemy_power * 5
            state.gold += gold_gained
            # 胜仗伤亡较低
            if total_soldiers > 0:
                damage_ratio = enemy_power / max(1, player_power)
                casualties = min(total_soldiers, int(total_soldiers * damage_ratio * 0.3))
            loss_detail = apply_casualties(state.troops, casualties)
            message = f"强力进攻取得大胜！获得战利品 {gold_gained} 金币，伤亡人数：{casualties}。"
        else:
            victory = False
            gold_gained = 0
            # 败仗伤亡较高
            if total_soldiers > 0:
                casualties = min(total_soldiers, max(1, int(total_soldiers * 0.5)))
            loss_detail = apply_casualties(state.troops, casualties)
            message = f"进攻受阻不敌对手。伤亡人数：{casualties}。"

        state.add_log(f"选择主动进攻。{message}")
        return {
            "victory": victory,
            "choice": choice,
            "player_power": player_power,
            "enemy_power": enemy_power,
            "total_casualties": casualties,
            "casualties_detail": loss_detail,
            "gold_gained": gold_gained,
            "message": message,
        }

    elif choice == "defend":
        # 防御：低伤亡低收益
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

        state.add_log(f"选择筑防坚守。{message}")
        return {
            "victory": victory,
            "choice": choice,
            "player_power": player_power,
            "enemy_power": enemy_power,
            "total_casualties": casualties,
            "casualties_detail": loss_detail,
            "gold_gained": gold_gained,
            "message": message,
        }

    else:
        raise ValueError(f"未知的战斗决策: {choice}")


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
