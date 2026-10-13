"""终端交互界面模块：实现三国群英传式的大地图移动与遭遇系统。"""

from core.data import LOCATIONS, UNITS, GOODS, COMPANIONS, EQUIPMENT, FACTIONS, POLICIES
from core.engine import (
    move,
    rest,
    resolve_combat_simple,
    calculate_army_power,
    trade,
    recruit,
    upgrade_unit,
    hire_companion,
    conquer_location,
    daily_update,
    sell_prisoners,
    recruit_prisoner,
    arena_fight,
    accept_quest,
    complete_quest,
    declare_kingdom,
    assign_lord,
    set_policy,
)

TYPE_NAMES = {
    "village": "村庄",
    "town": "城镇",
    "wild": "野外",
}


def format_market_info(loc_info):
    """格式化地点的市场信息。"""
    market = loc_info.get("market", {})
    if not market:
        return None
    items = []
    for g_id, price in market.items():
        g_name = GOODS.get(g_id, {}).get("name", g_id)
        buy_p = price.get("buy_price", 0)
        sell_p = price.get("sell_price", 0)
        items.append(f"{g_name}(买{buy_p}/卖{sell_p})")
    return f"【市场】可买卖：{', '.join(items)}"


def format_barracks_info(loc_info):
    """格式化地点的兵营信息。"""
    barracks = loc_info.get("barracks", [])
    if not barracks:
        return None
    items = []
    for u_id in barracks:
        u_name = UNITS.get(u_id, {}).get("name", u_id)
        cost = UNITS.get(u_id, {}).get("recruit_cost", 0)
        items.append(f"{u_name}({cost}金)")
    return f"【兵营】可招募：{', '.join(items)}"


def format_tavern_info(loc_info):
    """格式化地点的酒馆与任务板信息。"""
    tavern = loc_info.get("tavern", [])
    active_quests = loc_info.get("active_quests", [])
    items = []
    if tavern:
        for c_id in tavern:
            c_info = COMPANIONS.get(c_id, {})
            c_name = c_info.get("name", c_id)
            cost = c_info.get("cost", 0)
            req_r = c_info.get("required_renown", 0)
            items.append(f"{c_name}(id:{c_id}, {cost}金/需{req_r}声望)")

    res = f"【酒馆】可招募同伴：{', '.join(items)}" if items else ""
    if loc_info.get("type") == "town":
        if res:
            res += "\n"
        if active_quests:
            q_strs = [f"[{q['id']}] {q['desc']} (报酬:{q['reward_cash']}金/{q['reward_renown']}声望)" for q in active_quests]
            res += f"【任务板】可用任务：\n  " + "\n  ".join(q_strs)
        else:
            res += "【任务板】暂无可用任务"
    return res if res else None


def render_location_header(state):
    """渲染当前地点及周围邻居节点信息。"""
    curr_info = LOCATIONS.get(state.location, {})
    loc_name = curr_info.get("name", state.location)
    loc_type_raw = curr_info.get("type", "unknown")
    loc_type = TYPE_NAMES.get(loc_type_raw, loc_type_raw)
    current_soldiers = sum(state.troops.values())

    print("\n" + "=" * 55)
    print(f"【三国大地图】 第 {state.day} 天")
    print(
        f"位置: [{loc_name}] ({loc_type}) | 金币: {state.gold} | 声望: {state.renown} | "
        f"粮食: {state.food:.1f} | 士气: {state.morale}/100 | "
        f"兵力: {current_soldiers}/{state.max_army_size} | 封地: {len(state.fiefs)}"
    )

    market_str = format_market_info(curr_info)
    if market_str:
        print(market_str)

    barracks_str = format_barracks_info(curr_info)
    if barracks_str:
        print(barracks_str)

    tavern_str = format_tavern_info(curr_info)
    if tavern_str:
        print(tavern_str)

    neighbor_ids = curr_info.get("neighbors", [])
    neighbor_names = []
    for nid in neighbor_ids:
        n_info = LOCATIONS.get(nid, {})
        n_name = n_info.get("name", nid)
        neighbor_names.append(f"{n_name}({nid})")

    neighbors_str = ", ".join(neighbor_names) if neighbor_names else "无"
    print(f"周围可前往的地点: {neighbors_str}")
    print("=" * 45)


def get_relation_label(val):
    """获取玩家与势力关系的文本标签。"""
    if val >= 40:
        return f"友好({val})"
    elif val <= -20:
        return f"敌对({val})"
    else:
        return f"中立({val})"


def render_status(state):
    """显示玩家当前的势力关系、军队、装备、俘虏、背包、同伴与封地状态信息。"""
    curr_info = LOCATIONS.get(state.location, {})
    loc_name = curr_info.get("name", state.location)
    eq_bonus = sum(
        EQUIPMENT[eq_id]["power_bonus"]
        for eq_id in state.equipment.values()
        if eq_id in EQUIPMENT
    )
    army_power = calculate_army_power(state.troops)
    total_power = army_power + state.personal_power + eq_bonus
    current_soldiers = sum(state.troops.values())

    print("\n" + "-" * 40)
    print("【当前详细状态】")
    print(f"当前时间: 第 {state.day} 天")
    print(f"所在位置: {loc_name}")
    print(f"金币数量: {state.gold}")
    print(f"玩家声望: {state.renown}")
    print(f"粮食储备: {state.food:.1f}")
    print(f"部队士气: {state.morale}/100")
    print(f"带兵数量: {current_soldiers}/{state.max_army_size}")
    print(f"个人战力: {state.personal_power} | 装备加成: +{eq_bonus}")
    print(f"军队总战力: {army_power} | 综合战力: {total_power}")

    print("\n[势力关系]")
    for fid, f_info in FACTIONS.items():
        fname = f_info.get("name", fid)
        rel_val = state.faction_relations.get(fid, 0)
        label = get_relation_label(rel_val)
        print(f"  - {fname}: {label}")

    print("\n[已接取任务]")
    if state.active_quests:
        for q in state.active_quests:
            progress = ""
            if q.get("type") == "hunt_bandits":
                progress = f" (进度: {q.get('current_count', 0)}/{q.get('target_count', 1)})"
            print(f"  - [{q['id']}] {q['desc']}{progress}")
    else:
        print("  无接取任务")

    print("\n[玩家装备]")
    if state.equipment:
        for eq_type, eq_id in state.equipment.items():
            eq_info = EQUIPMENT.get(eq_id, {})
            eq_name = eq_info.get("name", eq_id)
            eq_power = eq_info.get("power_bonus", 0)
            print(f"  - [{eq_type}]: {eq_name} (战力 +{eq_power})")
    else:
        print("  未穿戴装备")

    print("\n[俘虏列表]")
    has_prisoners = False
    for u_id, p_cnt in state.prisoners.items():
        if p_cnt > 0:
            u_name = UNITS.get(u_id, {}).get("name", u_id)
            val = UNITS.get(u_id, {}).get("prisoner_value", 3)
            print(f"  - {u_name}俘虏 ({u_id}): {p_cnt} 人 (回收单价: {val} 金)")
            has_prisoners = True
    if not has_prisoners:
        print("  无俘虏")

    print("\n[已招募同伴]")
    if state.companions:
        for c_id in state.companions:
            c_info = COMPANIONS.get(c_id, {})
            c_name = c_info.get("name", c_id)
            print(f"  - {c_name} ({c_id})")
    else:
        print("  暂无同伴")

    print("\n[领地/封地]")
    if state.fiefs:
        for f_id in state.fiefs:
            f_info = LOCATIONS.get(f_id, {})
            f_name = f_info.get("name", f_id)
            f_tax = f_info.get("tax_income", 0)
            f_owner = f_info.get("owner", "player")
            owner_label = "领主代管" if f_owner == "lord" else "亲自管理"
            print(f"  - {f_name} ({f_id}) [每日基础税收: {f_tax} 金 / 管理模式: {owner_label}]")
    else:
        print("  暂无封地")

    print("\n[王国状态]")
    if state.is_king:
        policy_info = POLICIES.get(state.current_policy, {})
        policy_name = policy_info.get("name", "未制定")
        lord_names = [COMPANIONS.get(lid, {}).get("name", lid) for lid in state.lords]
        lords_str = ", ".join(lord_names) if lord_names else "无"
        print(f"  - 王国名称: {state.kingdom_name}")
        print(f"  - 当前政策: {policy_name}")
        print(f"  - 分封领主: {lords_str}")
    else:
        print("  - 尚未建国")

    print("\n[部队成员]")
    has_troops = False
    for troop_id, count in state.troops.items():
        if count > 0:
            troop_name = UNITS.get(troop_id, {}).get("name", troop_id)
            unit_power = UNITS.get(troop_id, {}).get("power", 1)
            print(f"  - {troop_name} ({troop_id}): {count} 人 (单兵战力: {unit_power})")
            has_troops = True
    if not has_troops:
        print("  无部队兵员")

    print("\n[背包物品]")
    has_items = False
    for item_id, count in state.inventory.items():
        if count > 0:
            item_name = GOODS.get(item_id, {}).get("name", item_id)
            print(f"  - {item_name} ({item_id}): {count}")
            has_items = True
    if not has_items:
        print("  无物品")

    if state.logs:
        print("\n[最近日志]")
        for log in state.logs[-5:]:
            print(f"  {log}")

    print("-" * 40)


def handle_combat_encounter(state, event_data):
    """处理遭遇战的交互决策与结算。"""
    enemy_power = event_data.get("enemy_power", 10)
    evt_desc = event_data.get("description", "遇到敌人！")
    player_power = calculate_army_power(state.troops)

    print("\n" + "!" * 45)
    print(f"遭遇战触发！{evt_desc}")
    print(f"敌方预估战力: {enemy_power}  |  我方总战力: {player_power}")
    print("!" * 45)

    while True:
        print("\n请选择应对策略:")
        print("  1. 进攻 (高伤亡高收益)")
        print("  2. 防御 (低伤亡低收益)")
        print("  3. 撤退 (可能损失少量兵员但安全)")

        choice_input = input("\n请选择指令 [1-3] > ").strip()
        if choice_input in ["1", "进攻", "attack"]:
            choice = "attack"
            break
        elif choice_input in ["2", "防御", "defend"]:
            choice = "defend"
            break
        elif choice_input in ["3", "撤退", "retreat"]:
            choice = "retreat"
            break
        else:
            print("无效的选择，请输入 1、2 或 3。")

    result = resolve_combat_simple(state, enemy_power, choice)

    print("\n" + "*" * 40)
    print("【战斗结算】")
    print(f"结果: {result['message']}")
    if result["total_casualties"] > 0:
        print("伤亡详情:")
        for t_id, cnt in result["casualties_detail"].items():
            if cnt > 0:
                t_name = UNITS.get(t_id, {}).get("name", t_id)
                print(f"  - {t_name}: 损失 {cnt} 人")
    if result["gold_gained"] > 0:
        print(f"获得金币战利品: {result['gold_gained']} 金币")

    if result.get("loot_gained"):
        print("掉落装备战利品:")
        for item in result["loot_gained"]:
            eq_type = item.get("type")
            eq_name = item.get("name")
            eq_power = item.get("power_bonus", 0)
            eq_price = item.get("price", 0)
            print(f"  - 装备: {eq_name} (类型: {eq_type}, 战力 +{eq_power})")
            if eq_type not in state.equipment or not state.equipment[eq_type]:
                state.equipment[eq_type] = item["id"]
                print(f"    -> 自动穿戴 [{eq_name}]！（战力 +{eq_power}）")
            else:
                state.gold += eq_price
                print(f"    -> 已有同类型装备，放入背包（自动卖钱变现 +{eq_price} 金币）")

    if result.get("prisoners_gained"):
        print("捕获俘虏:")
        for p_id, p_cnt in result["prisoners_gained"].items():
            if p_cnt > 0:
                p_name = UNITS.get(p_id, {}).get("name", p_id)
                print(f"  - {p_name}俘虏: {p_cnt} 人")

    print("*" * 40)

    # 如果战斗胜利，且当前地点类型是城镇或村庄，弹出占领/掠夺/离开选项
    curr_loc = LOCATIONS.get(state.location, {})
    if result["victory"] and curr_loc.get("type") in ["town", "village"]:
        loc_name = curr_loc.get("name", state.location)
        print("\n" + "=" * 40)
        print(f"胜利！你可以对 [{loc_name}] 采取后续行动：")
        print("  [1] 掠夺 (得钱扣声望)")
        print("  [2] 占领 (需50声望，得封地)")
        print("  [3] 离开")
        print("=" * 40)

        while True:
            post_choice = input("请选择行动 [1-3] > ").strip()
            if post_choice in ["1", "掠夺", "loot"]:
                res = conquer_location(state, state.location, "loot")
                print(f"\n{res}")
                break
            elif post_choice in ["2", "占领", "occupy"]:
                res = conquer_location(state, state.location, "occupy")
                print(f"\n{res}")
                break
            elif post_choice in ["3", "离开", "leave"]:
                print(f"\n你选择了离开 [{loc_name}]。")
                break
            else:
                print("无效的选择，请输入 1、2 或 3。")


def resolve_location_target(target_arg):
    """将输入的地点名称或ID解析为对应的地点ID。"""
    target_arg = target_arg.strip()
    if target_arg in LOCATIONS:
        return target_arg

    for loc_id, loc_info in LOCATIONS.items():
        if loc_info.get("name") == target_arg:
            return loc_id

    return None


def start_cli(state):
    """启动主终端交互循环。"""
    print("欢迎来到《终端暴君：三国群英》！大地图系统已启动。")

    while True:
        render_location_header(state)
        print("\n可用指令:")
        print("  move <地点名/ID>         - 移动到相邻地点")
        print("  buy <商品/grain> <数量>   - 购买商品或粮草")
        print("  sell <商品id> <数量>      - 卖出商品")
        print("  recruit <兵种id> <数量>   - 招募士兵")
        print("  upgrade <兵种id> <数量>   - 晋升兵种")
        print("  hire <同伴id>            - 招募酒馆同伴")
        print("  sell_prisoner <兵种id> <数量> - 出售俘虏")
        print("  recruit_prisoner <兵种id> <数量> - 招募俘虏为士兵")
        print("  arena <轮数>            - 竞技场打擂")
        print("  quest list               - 查看当前接取的任务及进度")
        print("  quest accept <任务id>    - 接取任务")
        print("  quest complete <任务id>  - 尝试完成任务")
        print("  kingdom declare <名称>   - 建立你的王国（需500声望与3个封地）")
        print("  kingdom status          - 查看王国状态")
        print("  lord assign <同伴id> <地点id> - 分封领主管理封地")
        print("  policy set <政策id>      - 制定国家政策")
        print("  rest                     - 原地休整（恢复士气）")
        print("  status                   - 查看军队与物品状态")
        print("  q                        - 退出游戏")

        user_input = input("\n请输入指令 > ").strip()
        if not user_input:
            continue

        parts = user_input.split()
        cmd = parts[0].lower()

        if cmd == "q":
            print("感谢游玩，再见！")
            break

        elif cmd == "status":
            render_status(state)

        elif cmd == "quest":
            if len(parts) < 2:
                print("请指定 quest 子指令！用法: quest list | quest accept <任务id> | quest complete <任务id>")
                continue
            sub_cmd = parts[1].lower()
            if sub_cmd == "list":
                print("\n【当前接取任务列表】")
                if state.active_quests:
                    for q in state.active_quests:
                        progress = ""
                        if q.get("type") == "hunt_bandits":
                            progress = f" (进度: {q.get('current_count', 0)}/{q.get('target_count', 1)})"
                        print(f"  - [{q['id']}] {q['desc']}{progress}")
                else:
                    print("  暂未接取任何任务")
            elif sub_cmd == "accept":
                if len(parts) < 3:
                    print("请指定要接取的任务ID！例如: quest accept q_1")
                    continue
                q_id = parts[2]
                res = accept_quest(state, q_id)
                print(f"\n{res}")
            elif sub_cmd == "complete":
                if len(parts) < 3:
                    print("请指定要完成的任务ID！例如: quest complete q_1")
                    continue
                q_id = parts[2]
                res = complete_quest(state, q_id)
                print(f"\n{res}")
            else:
                print(f"未知的 quest 子指令: '{sub_cmd}'")

        elif cmd == "kingdom":
            if len(parts) < 2:
                print("请指定 kingdom 子指令！用法: kingdom declare <名称> | kingdom status")
                continue
            sub_cmd = parts[1].lower()
            if sub_cmd == "declare":
                if len(parts) < 3:
                    print("请指定王国名称！例如: kingdom declare 蜀汉")
                    continue
                k_name = parts[2]
                res = declare_kingdom(state, k_name)
                print(f"\n{res}")
            elif sub_cmd == "status":
                print("\n【王国详细状态】")
                if state.is_king:
                    policy_info = POLICIES.get(state.current_policy, {})
                    policy_name = policy_info.get("name", "未制定")
                    policy_eff = policy_info.get("effect", "无")
                    fief_names = [LOCATIONS.get(fid, {}).get("name", fid) for fid in state.fiefs]
                    fiefs_str = ", ".join(fief_names) if fief_names else "无"
                    lord_names = [COMPANIONS.get(lid, {}).get("name", lid) for lid in state.lords]
                    lords_str = ", ".join(lord_names) if lord_names else "无"
                    print(f"  - 王国名称: {state.kingdom_name}")
                    print(f"  - 拥有的封地: {fiefs_str}")
                    print(f"  - 分封的领主: {lords_str}")
                    print(f"  - 当前政策: {policy_name} ({policy_eff})")
                else:
                    print("  尚未建国。需达到 500 声望与 3 个封地后方可建国。")
            else:
                print(f"未知的 kingdom 子指令: '{sub_cmd}'")

        elif cmd == "lord":
            if len(parts) < 2:
                print("请指定 lord 子指令！用法: lord assign <同伴id> <地点id>")
                continue
            sub_cmd = parts[1].lower()
            if sub_cmd == "assign":
                if len(parts) < 4:
                    print("请指定同伴ID和地点ID！例如: lord assign c1 river_town")
                    continue
                comp_id = parts[2]
                target_loc = resolve_location_target(parts[3]) or parts[3]
                res = assign_lord(state, comp_id, target_loc)
                print(f"\n{res}")
            else:
                print(f"未知的 lord 子指令: '{sub_cmd}'")

        elif cmd == "policy":
            if len(parts) < 2:
                print("请指定 policy 子指令！用法: policy set <政策id>")
                continue
            sub_cmd = parts[1].lower()
            if sub_cmd == "set":
                if len(parts) < 3:
                    print("请指定政策ID！可选政策: tax_high (重税), tax_low (轻薄赋), conscription (强制征兵)")
                    continue
                p_id = parts[2]
                res = set_policy(state, p_id)
                print(f"\n{res}")
            else:
                print(f"未知的 policy 子指令: '{sub_cmd}'")

        elif cmd == "rest":
            rest(state)
            daily_report = daily_update(state)
            print(f"\n{daily_report}")

        elif cmd == "hire":
            if len(parts) < 2:
                print("请指定同伴ID！例如: hire c1")
                continue
            companion_id = parts[1]
            res = hire_companion(state, companion_id)
            print(f"\n{res}")

        elif cmd == "buy":
            if len(parts) < 3:
                print("请指定商品ID和数量！例如: buy wheat 10")
                continue
            goods_id = parts[1]
            try:
                quantity = int(parts[2])
            except ValueError:
                print("数量必须是有效数字！")
                continue
            res = trade(state, state.location, "buy", goods_id, quantity)
            print(f"\n{res}")

        elif cmd == "sell":
            if len(parts) < 3:
                print("请指定商品ID和数量！例如: sell wheat 10")
                continue
            goods_id = parts[1]
            try:
                quantity = int(parts[2])
            except ValueError:
                print("数量必须是有效数字！")
                continue
            res = trade(state, state.location, "sell", goods_id, quantity)
            print(f"\n{res}")

        elif cmd == "recruit":
            if len(parts) < 3:
                print("请指定兵种ID和数量！例如: recruit peasant 5")
                continue
            unit_id = parts[1]
            try:
                quantity = int(parts[2])
            except ValueError:
                print("数量必须是有效数字！")
                continue
            res = recruit(state, state.location, unit_id, quantity)
            print(f"\n{res}")

        elif cmd == "upgrade":
            if len(parts) < 3:
                print("请指定兵种ID和数量！例如: upgrade peasant 3")
                continue
            unit_id = parts[1]
            try:
                quantity = int(parts[2])
            except ValueError:
                print("数量必须是有效数字！")
                continue
            res = upgrade_unit(state, unit_id, quantity)
            print(f"\n{res}")

        elif cmd in ["sell_prisoner", "sell_prisoners"]:
            if len(parts) < 3:
                print("请指定兵种ID和数量！例如: sell_prisoner peasant 5")
                continue
            unit_id = parts[1]
            try:
                quantity = int(parts[2])
            except ValueError:
                print("数量必须是有效数字！")
                continue
            res = sell_prisoners(state, state.location, unit_id, quantity)
            print(f"\n{res}")

        elif cmd in ["recruit_prisoner", "recruit_prisoners"]:
            if len(parts) < 3:
                print("请指定兵种ID和数量！例如: recruit_prisoner peasant 5")
                continue
            unit_id = parts[1]
            try:
                quantity = int(parts[2])
            except ValueError:
                print("数量必须是有效数字！")
                continue
            res = recruit_prisoner(state, unit_id, quantity)
            print(f"\n{res}")

        elif cmd == "arena":
            if len(parts) < 2:
                print("请指定打擂轮数！例如: arena 3")
                continue
            try:
                rounds = int(parts[1])
            except ValueError:
                print("轮数必须是有效数字！")
                continue
            res = arena_fight(state, state.location, rounds)
            print(f"\n{res}")

        elif cmd == "move":
            if len(parts) < 2:
                print("请指定要移动的目标地点！例如: move 离附近的地点名")
                continue

            target_arg = parts[1]
            target_id = resolve_location_target(target_arg)

            if not target_id:
                print(f"未找到名称或ID为 '{target_arg}' 的地点。")
                continue

            success, msg, event_data = move(state, target_id)
            print(f"\n{msg}")

            if success:
                if event_data:
                    if event_data.get("type") == "combat":
                        handle_combat_encounter(state, event_data)
                    elif event_data.get("type") in ["caravan", "treasure"]:
                        print(f"【遭遇事件】{event_data.get('description')} 获得 {event_data.get('gold_reward', 0)} 金币！")
                    else:
                        print(f"【遭遇事件】{event_data.get('description')}")

                daily_report = daily_update(state)
                print(f"\n{daily_report}")

        else:
            print(f"未知指令: '{cmd}'。请输入 'move', 'rest', 'status' 或 'q'。")
