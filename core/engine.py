"""核心引擎逻辑模块：包含大地图移动、休息、事件触发与简单战斗结算。

纯逻辑计算，不包含任何 UI、print() 或 input()。
"""

import random
from core.data import LOCATIONS, EVENTS, UNITS


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
