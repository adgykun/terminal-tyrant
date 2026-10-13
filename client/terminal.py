"""终端交互界面模块：实现三国群英传式的大地图移动与遭遇系统。"""

from core.data import LOCATIONS, UNITS, GOODS
from core.engine import move, rest, resolve_combat_simple, calculate_army_power

TYPE_NAMES = {
    "village": "村庄",
    "town": "城镇",
    "wild": "野外",
}


def render_location_header(state):
    """渲染当前地点及周围邻居节点信息。"""
    curr_info = LOCATIONS.get(state.location, {})
    loc_name = curr_info.get("name", state.location)
    loc_type_raw = curr_info.get("type", "unknown")
    loc_type = TYPE_NAMES.get(loc_type_raw, loc_type_raw)

    print("\n" + "=" * 45)
    print(f"【三国大地图】 第 {state.day} 天")
    print(f"你位于 [{loc_name}] ({loc_type}) | 部队士气: {state.morale}/100 | 金币: {state.gold}")

    neighbor_ids = curr_info.get("neighbors", [])
    neighbor_names = []
    for nid in neighbor_ids:
        n_info = LOCATIONS.get(nid, {})
        n_name = n_info.get("name", nid)
        neighbor_names.append(f"{n_name}({nid})")

    neighbors_str = ", ".join(neighbor_names) if neighbor_names else "无"
    print(f"周围可前往的地点: {neighbors_str}")
    print("=" * 45)


def render_status(state):
    """显示玩家当前的军队与背包状态信息。"""
    curr_info = LOCATIONS.get(state.location, {})
    loc_name = curr_info.get("name", state.location)
    army_power = calculate_army_power(state.troops)

    print("\n" + "-" * 40)
    print("【当前详细状态】")
    print(f"当前时间: 第 {state.day} 天")
    print(f"所在位置: {loc_name}")
    print(f"金币数量: {state.gold}")
    print(f"部队士气: {state.morale}/100")
    print(f"军队总战力: {army_power}")

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
        print(f"获得战利品: {result['gold_gained']} 金币")
    print("*" * 40)


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
        print("  move <地点名/ID>  - 移动到相邻地点")
        print("  rest              - 原地休整（恢复士气）")
        print("  status            - 查看军队与物品状态")
        print("  q                 - 退出游戏")

        user_input = input("\n请输入指令 > ").strip()
        if not user_input:
            continue

        parts = user_input.split(maxsplit=1)
        cmd = parts[0].lower()

        if cmd == "q":
            print("感谢游玩，再见！")
            break

        elif cmd == "status":
            render_status(state)

        elif cmd == "rest":
            rest(state)

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

            if success and event_data:
                if event_data.get("type") == "combat":
                    handle_combat_encounter(state, event_data)
                elif event_data.get("type") in ["caravan", "treasure"]:
                    print(f"【遭遇事件】{event_data.get('description')} 获得 {event_data.get('gold_reward', 0)} 金币！")
                else:
                    print(f"【遭遇事件】{event_data.get('description')}")

        else:
            print(f"未知指令: '{cmd}'。请输入 'move', 'rest', 'status' 或 'q'。")
