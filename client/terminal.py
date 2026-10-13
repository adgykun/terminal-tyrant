from core.data import LOCATIONS, UNITS, GOODS


def render_state(state):
    """Renders the current game state to the terminal."""
    location_info = LOCATIONS.get(state.location, {})
    loc_name = location_info.get("name", state.location)

    print("\n" + "=" * 40)
    print(f"【终端暴君 (Terminal Tyrant)】 第 {state.day} 天")
    print(f"当前位置: {loc_name} ({state.location})")
    print(f"拥有金钱: {state.gold} 金币")

    print("\n[部队成员]")
    has_troops = False
    for troop_id, count in state.troops.items():
        if count > 0:
            troop_name = UNITS.get(troop_id, {}).get("name", troop_id)
            print(f"  - {troop_name} ({troop_id}): {count}")
            has_troops = True
    if not has_troops:
        print("  无部队")

    print("\n[背包物品]")
    has_items = False
    for item_id, count in state.inventory.items():
        if count > 0:
            item_name = GOODS.get(item_id, {}).get("name", item_id)
            print(f"  - {item_name} ({item_id}): {count}")
            has_items = True
    if not has_items:
        print("  无物品")

    print("=" * 40)


def start_cli(state):
    """Starts the terminal game loop."""
    print("正在初始化终端程序...")
    while True:
        render_state(state)
        print("\n可用指令:")
        print("  q - 退出游戏")

        choice = input("\n请输入指令 > ").strip().lower()
        if choice == "q":
            print("感谢游玩，再见！")
            break
        else:
            print(f"未知指令: '{choice}'，当前阶段仅支持 'q' 退出。")
