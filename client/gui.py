"""Terminal Tyrant - Pygame 图形化界面客户端模块

处理大地图渲染、UI 面板绘制以及鼠标/键盘交互。
"""

import sys
import pygame
from core.data import LOCATIONS, UNITS, GOODS, FISHING_GEAR
from core import engine


# 颜色定义
COLOR_BG = (30, 30, 35)
COLOR_MAP_BG = (45, 50, 55)
COLOR_PANEL_BG = (25, 25, 30)
COLOR_ROAD = (120, 120, 130)
COLOR_TOWN = (50, 120, 220)       # 城镇：蓝色
COLOR_VILLAGE = (50, 180, 80)     # 村庄：绿色
COLOR_WILD = (180, 130, 60)       # 野外：黄褐色
COLOR_WATER = (40, 100, 180)      # 水域标注
COLOR_PLAYER = (230, 50, 50)      # 玩家：红色
COLOR_TEXT = (240, 240, 240)
COLOR_TEXT_DIM = (160, 160, 170)
COLOR_HIGHLIGHT = (255, 215, 0)
COLOR_BUTTON = (60, 70, 90)
COLOR_BUTTON_HOVER = (90, 105, 135)
COLOR_MODAL_BG = (20, 20, 25, 240)
COLOR_BORDER = (80, 80, 95)
COLOR_SUCCESS = (80, 200, 120)
COLOR_WARNING = (230, 160, 50)


def get_font(size):
    """尝试加载支持中文的系统字体，若不可用则回退至默认字体。"""
    font_names = [
        "wenquanyizenhei",
        "wqy-zenhei",
        "simhei",
        "stheititi",
        "arialunicodems",
        "microsoftyahei",
    ]
    for name in font_names:
        font = pygame.font.SysFont(name, size)
        if font:
            return font
    return pygame.font.Font(None, size)


class GUIClient:
    """Pygame 图形界面客户端主逻辑类。"""

    def __init__(self, state):
        self.state = state
        self.running = True

        # 窗口与显示区域尺寸
        self.screen_width = 800
        self.screen_height = 600
        self.map_width = 600
        self.map_height = 600

        # 初始化 Pygame 与窗口
        pygame.init()
        pygame.font.init()
        self.screen = pygame.display.set_mode((self.screen_width, self.screen_height))
        pygame.display.set_caption("Terminal Tyrant - GUI")
        self.clock = pygame.time.Clock()

        # 初始化字体
        self.font_main = get_font(16)
        self.font_title = get_font(20)
        self.font_small = get_font(14)
        self.font_large = get_font(24)

        # UI 状态与弹窗 (None, 'shop', 'recruit', 'tavern', 'smithy', 'arena', 'combat', 'combat_result')
        self.overlay = None
        self.combat_event = None
        self.combat_result = None
        self.message = "欢迎来到 Terminal Tyrant！点击相邻地点进行移动。"

        # 交互按钮列表 (用于点击判断)
        self.buttons = []

    def logic_to_screen(self, x, y):
        """将 0-100 的逻辑坐标映射至 600x600 地图渲染区域中的像素坐标。"""
        screen_x = int(60 + (x / 100.0) * 480)
        screen_y = int(60 + (y / 100.0) * 480)
        return screen_x, screen_y

    def draw_button(self, rect, text, callback, hover_color=COLOR_BUTTON_HOVER, default_color=COLOR_BUTTON):
        """绘制可点击的 UI 按钮，并记录响应区域。"""
        mouse_pos = pygame.mouse.get_pos()
        is_hover = rect.collidepoint(mouse_pos)
        color = hover_color if is_hover else default_color

        pygame.draw.rect(self.screen, color, rect, border_radius=5)
        pygame.draw.rect(self.screen, COLOR_BORDER, rect, width=1, border_radius=5)

        txt_surf = self.font_main.render(text, True, COLOR_TEXT)
        txt_rect = txt_surf.get_rect(center=rect.center)
        self.screen.blit(txt_surf, txt_rect)

        self.buttons.append((rect, callback))

    def render_map(self):
        """绘制左侧 600x600 大地图区域，包含道路、水域、地点节点与玩家位置。"""
        map_rect = pygame.Rect(0, 0, self.map_width, self.map_height)
        pygame.draw.rect(self.screen, COLOR_MAP_BG, map_rect)

        # 1. 绘制道路 (连接相邻地点)
        drawn_roads = set()
        for loc_id, loc in LOCATIONS.items():
            start_pos = self.logic_to_screen(loc["x"], loc["y"])
            for neighbor_id in loc.get("neighbors", []):
                road_pair = tuple(sorted([loc_id, neighbor_id]))
                if road_pair not in drawn_roads and neighbor_id in LOCATIONS:
                    drawn_roads.add(road_pair)
                    end_pos = self.logic_to_screen(
                        LOCATIONS[neighbor_id]["x"], LOCATIONS[neighbor_id]["y"]
                    )
                    pygame.draw.line(self.screen, COLOR_ROAD, start_pos, end_pos, 3)

        # 2. 绘制地点节点
        for loc_id, loc in LOCATIONS.items():
            pos = self.logic_to_screen(loc["x"], loc["y"])
            loc_type = loc.get("type", "village")
            terrain = loc.get("terrain_type", "plain")

            # 绘制水域背景标识
            if terrain in ["river", "lake", "sea"]:
                pygame.draw.circle(self.screen, COLOR_WATER, pos, 18)
                # 绘制小波浪线代表水域
                wave_x, wave_y = pos[0] - 8, pos[1] - 12
                pygame.draw.arc(self.screen, COLOR_TEXT, (wave_x, wave_y, 8, 6), 0, 3.14, 2)
                pygame.draw.arc(self.screen, COLOR_TEXT, (wave_x + 8, wave_y, 8, 6), 0, 3.14, 2)

            # 根据地点类型决定图标颜色与形状
            if loc_type == "town":
                rect = pygame.Rect(pos[0] - 12, pos[1] - 12, 24, 24)
                pygame.draw.rect(self.screen, COLOR_TOWN, rect)
                pygame.draw.rect(self.screen, COLOR_TEXT, rect, 1)
            elif loc_type == "village":
                rect = pygame.Rect(pos[0] - 10, pos[1] - 10, 20, 20)
                pygame.draw.rect(self.screen, COLOR_VILLAGE, rect)
                pygame.draw.rect(self.screen, COLOR_TEXT, rect, 1)
            else:  # 野外/荒野
                rect = pygame.Rect(pos[0] - 10, pos[1] - 10, 20, 20)
                pygame.draw.rect(self.screen, COLOR_WILD, rect)
                pygame.draw.rect(self.screen, COLOR_TEXT, rect, 1)

            # 标识当前选中的地点或相邻地点高亮
            if loc_id == self.state.location:
                highlight_rect = pygame.Rect(pos[0] - 16, pos[1] - 16, 32, 32)
                pygame.draw.rect(self.screen, COLOR_HIGHLIGHT, highlight_rect, 2)

            # 绘制地点名称标签
            name_surf = self.font_small.render(loc["name"], True, COLOR_TEXT)
            name_rect = name_surf.get_rect(center=(pos[0], pos[1] + 20))
            bg_rect = name_rect.inflate(6, 2)
            pygame.draw.rect(self.screen, COLOR_BG, bg_rect)
            self.screen.blit(name_surf, name_rect)

        # 3. 绘制玩家标识 (红色圆点)
        current_loc = LOCATIONS.get(self.state.location)
        if current_loc:
            player_pos = self.logic_to_screen(current_loc["x"], current_loc["y"])
            pygame.draw.circle(self.screen, COLOR_PLAYER, player_pos, 7)
            pygame.draw.circle(self.screen, COLOR_TEXT, player_pos, 7, 1)

    def render_panel(self):
        """绘制右侧 200x600 UI 信息面板。"""
        panel_rect = pygame.Rect(600, 0, 200, 600)
        pygame.draw.rect(self.screen, COLOR_PANEL_BG, panel_rect)
        pygame.draw.line(self.screen, COLOR_BORDER, (600, 0), (600, 600), 2)

        x_margin = 615
        y = 15

        # 标题
        title_surf = self.font_title.render("Terminal Tyrant", True, COLOR_HIGHLIGHT)
        self.screen.blit(title_surf, (x_margin, y))
        y += 30

        # 分割线
        pygame.draw.line(self.screen, COLOR_BORDER, (x_margin, y), (785, y), 1)
        y += 10

        # 基础状态信息
        stats = [
            f"天数: 第 {self.state.day} 天",
            f"金币: {self.state.gold} 金",
            f"粮食: {self.state.food:.1f}",
            f"士气: {self.state.morale} / 100",
            f"声望: {self.state.renown}",
        ]
        for stat in stats:
            surf = self.font_main.render(stat, True, COLOR_TEXT)
            self.screen.blit(surf, (x_margin, y))
            y += 22

        y += 10
        pygame.draw.line(self.screen, COLOR_BORDER, (x_margin, y), (785, y), 1)
        y += 10

        # 当前位置信息
        curr_loc = LOCATIONS.get(self.state.location, {})
        type_str = {"town": "城镇", "village": "村庄", "wild": "野外"}.get(
            curr_loc.get("type"), "未知"
        )
        terrain_str = {
            "plain": "平原",
            "river": "河流",
            "lake": "湖泊",
            "sea": "海滨",
        }.get(curr_loc.get("terrain_type"), "平原")

        loc_info = [
            f"当前位置: {curr_loc.get('name', '未知')}",
            f"地点类型: {type_str}",
            f"地形环境: {terrain_str}",
        ]
        for info in loc_info:
            surf = self.font_main.render(info, True, COLOR_HIGHLIGHT if "当前" in info else COLOR_TEXT)
            self.screen.blit(surf, (x_margin, y))
            y += 22

        y += 10
        pygame.draw.line(self.screen, COLOR_BORDER, (x_margin, y), (785, y), 1)
        y += 10

        # 操作快捷键说明
        controls_title = self.font_main.render("【快捷按键】", True, COLOR_TEXT_DIM)
        self.screen.blit(controls_title, (x_margin, y))
        y += 22

        controls = [
            "[点击] 移动至相邻地点",
            "[S] 键  商店 / 市场",
            "[R] 键  兵营招募",
            "[T] 键  酒馆 (喝酒/传闻)",
            "[M] 键  铁匠铺 (升级)",
            "[A] 键  竞技场 (打擂/押注)",
            "[F] 键  钓鱼 (需在水边)",
            "[ESC]  关闭弹窗 / 退出",
        ]
        for ctrl in controls:
            surf = self.font_small.render(ctrl, True, COLOR_TEXT_DIM)
            self.screen.blit(surf, (x_margin, y))
            y += 20

        y += 10
        pygame.draw.line(self.screen, COLOR_BORDER, (x_margin, y), (785, y), 1)
        y += 10

        # 提示与状态日志区域
        msg_title = self.font_main.render("【提示与日志】", True, COLOR_TEXT_DIM)
        self.screen.blit(msg_title, (x_margin, y))
        y += 22

        # 自动拆分多行显示当前提示消息
        words = self.message.split("\n")
        for line in words:
            # 按字数简易换行
            while len(line) > 0:
                chunk = line[:11]
                line = line[11:]
                surf = self.font_small.render(chunk, True, COLOR_SUCCESS)
                self.screen.blit(surf, (x_margin, y))
                y += 18

    def render_shop_overlay(self):
        """渲染商店/市场交易弹窗。"""
        overlay_rect = pygame.Rect(100, 80, 600, 440)
        s = pygame.Surface((600, 440), pygame.SRCALPHA)
        s.fill(COLOR_MODAL_BG)
        self.screen.blit(s, (100, 80))
        pygame.draw.rect(self.screen, COLOR_BORDER, overlay_rect, 2, border_radius=8)

        y = 100
        title_surf = self.font_large.render("—— 市场交易 ——", True, COLOR_HIGHLIGHT)
        self.screen.blit(title_surf, title_surf.get_rect(centerx=400, top=y))
        y += 40

        loc = LOCATIONS.get(self.state.location, {})
        loc_name = loc.get("name", "当前地点")
        market = loc.get("market", {})

        info_surf = self.font_main.render(
            f"地点: {loc_name} | 当前持有金币: {self.state.gold} 金 | 粮食: {self.state.food:.1f}",
            True,
            COLOR_TEXT,
        )
        self.screen.blit(info_surf, (130, y))
        y += 35

        # 显示通用购买粮食选项
        pygame.draw.line(self.screen, COLOR_BORDER, (130, y), (670, y), 1)
        y += 15

        grain_info = f"补给粮食: 10 金/单位 (可增加 10 粮食)"
        self.screen.blit(self.font_main.render(grain_info, True, COLOR_TEXT), (130, y))

        btn_rect_buy_grain = pygame.Rect(520, y - 5, 120, 30)
        def buy_grain():
            res = engine.trade(self.state, self.state.location, "buy", "grain", 1)
            self.message = res
        self.draw_button(btn_rect_buy_grain, "购买 1 单位", buy_grain)
        y += 45

        # 显示可交易的商品列表
        if not market:
            no_m_surf = self.font_main.render("该地点暂无特色市场商品交易。", True, COLOR_TEXT_DIM)
            self.screen.blit(no_m_surf, (130, y))
            y += 40
        else:
            for goods_id, prices in market.items():
                goods_name = GOODS.get(goods_id, {}).get("name", goods_id)
                owned = self.state.inventory.get(goods_id, 0)
                buy_p = prices.get("buy_price", 0)
                sell_p = prices.get("sell_price", 0)

                g_text = f"{goods_name} (持有: {owned}) - 买入: {buy_p} 金 | 卖出: {sell_p} 金"
                self.screen.blit(self.font_main.render(g_text, True, COLOR_TEXT), (130, y))

                # 买入按钮
                btn_buy = pygame.Rect(460, y - 5, 80, 30)
                def make_buy(gid=goods_id):
                    res = engine.trade(self.state, self.state.location, "buy", gid, 1)
                    self.message = res
                self.draw_button(btn_buy, "买入 1", make_buy)

                # 卖出按钮
                btn_sell = pygame.Rect(550, y - 5, 80, 30)
                def make_sell(gid=goods_id):
                    res = engine.trade(self.state, self.state.location, "sell", gid, 1)
                    self.message = res
                self.draw_button(btn_sell, "卖出 1", make_sell)

                y += 45

        # 离开按钮
        btn_close = pygame.Rect(340, 460, 120, 35)
        def close_shop():
            self.overlay = None
        self.draw_button(btn_close, "返回地图 (ESC)", close_shop)

    def render_recruit_overlay(self):
        """渲染兵营招募弹窗。"""
        overlay_rect = pygame.Rect(100, 80, 600, 440)
        s = pygame.Surface((600, 440), pygame.SRCALPHA)
        s.fill(COLOR_MODAL_BG)
        self.screen.blit(s, (100, 80))
        pygame.draw.rect(self.screen, COLOR_BORDER, overlay_rect, 2, border_radius=8)

        y = 100
        title_surf = self.font_large.render("—— 兵营招募 ——", True, COLOR_HIGHLIGHT)
        self.screen.blit(title_surf, title_surf.get_rect(centerx=400, top=y))
        y += 40

        loc = LOCATIONS.get(self.state.location, {})
        barracks = loc.get("barracks", [])
        current_army = sum(self.state.troops.values())

        info_surf = self.font_main.render(
            f"当前兵力: {current_army} / {self.state.max_army_size} 人 | 持有金币: {self.state.gold} 金",
            True,
            COLOR_TEXT,
        )
        self.screen.blit(info_surf, (130, y))
        y += 35

        pygame.draw.line(self.screen, COLOR_BORDER, (130, y), (670, y), 1)
        y += 15

        if not barracks:
            no_b_surf = self.font_main.render("该地点没有可招募的兵营。", True, COLOR_TEXT_DIM)
            self.screen.blit(no_b_surf, (130, y))
            y += 40
        else:
            for unit_id in barracks:
                unit_info = UNITS.get(unit_id, {})
                unit_name = unit_info.get("name", unit_id)
                cost = unit_info.get("recruit_cost", 0)
                power = unit_info.get("power", 1)
                owned_cnt = self.state.troops.get(unit_id, 0)

                u_text = f"{unit_name} (战力: {power}) - 费用: {cost} 金/人 | 已招募: {owned_cnt} 人"
                self.screen.blit(self.font_main.render(u_text, True, COLOR_TEXT), (130, y))

                # 招募 1 人按钮
                btn_rec1 = pygame.Rect(460, y - 5, 80, 30)
                def make_rec1(uid=unit_id):
                    res = engine.recruit(self.state, self.state.location, uid, 1)
                    self.message = res
                self.draw_button(btn_rec1, "招募 1", make_rec1)

                # 招募 5 人按钮
                btn_rec5 = pygame.Rect(550, y - 5, 80, 30)
                def make_rec5(uid=unit_id):
                    res = engine.recruit(self.state, self.state.location, uid, 5)
                    self.message = res
                self.draw_button(btn_rec5, "招募 5", make_rec5)

                y += 45

        # 离开按钮
        btn_close = pygame.Rect(340, 460, 120, 35)
        def close_recruit():
            self.overlay = None
        self.draw_button(btn_close, "返回地图 (ESC)", close_recruit)

    def render_tavern_overlay(self):
        """渲染酒馆交互弹窗。"""
        overlay_rect = pygame.Rect(100, 80, 600, 440)
        s = pygame.Surface((600, 440), pygame.SRCALPHA)
        s.fill(COLOR_MODAL_BG)
        self.screen.blit(s, (100, 80))
        pygame.draw.rect(self.screen, COLOR_BORDER, overlay_rect, 2, border_radius=8)

        y = 100
        title_surf = self.font_large.render("—— 喧闹酒馆 ——", True, COLOR_HIGHLIGHT)
        self.screen.blit(title_surf, title_surf.get_rect(centerx=400, top=y))
        y += 45

        res = engine.visit_tavern(self.state)
        dlg_text = res["welcome"]

        dlg_surf = self.font_main.render(dlg_text, True, COLOR_TEXT)
        self.screen.blit(dlg_surf, (130, y))
        y += 45

        pygame.draw.line(self.screen, COLOR_BORDER, (130, y), (670, y), 1)
        y += 25

        btn_drink = pygame.Rect(160, y, 180, 40)
        def do_drink():
            ret = engine.visit_tavern(self.state, "drink", 20)
            self.message = f"{ret['dialogue']}\n{ret['message']}"
        self.draw_button(btn_drink, "喝酒 (扣20金/加士气)", do_drink)

        btn_rumor = pygame.Rect(380, y, 180, 40)
        def do_rumor():
            ret = engine.visit_tavern(self.state, "rumor")
            self.message = f"{ret['message']}"
        self.draw_button(btn_rumor, "打听传闻", do_rumor)

        btn_close = pygame.Rect(340, 460, 120, 35)
        def close_tavern():
            self.overlay = None
        self.draw_button(btn_close, "返回地图 (ESC)", close_tavern)

    def render_smithy_overlay(self):
        """渲染铁匠铺交互弹窗。"""
        overlay_rect = pygame.Rect(100, 80, 600, 440)
        s = pygame.Surface((600, 440), pygame.SRCALPHA)
        s.fill(COLOR_MODAL_BG)
        self.screen.blit(s, (100, 80))
        pygame.draw.rect(self.screen, COLOR_BORDER, overlay_rect, 2, border_radius=8)

        y = 100
        title_surf = self.font_large.render("—— 铁匠铺 ——", True, COLOR_HIGHLIGHT)
        self.screen.blit(title_surf, title_surf.get_rect(centerx=400, top=y))
        y += 45

        res = engine.visit_smithy(self.state)
        dlg_text = res["welcome"]

        dlg_surf = self.font_main.render(dlg_text, True, COLOR_TEXT)
        self.screen.blit(dlg_surf, (130, y))
        y += 45

        pygame.draw.line(self.screen, COLOR_BORDER, (130, y), (670, y), 1)
        y += 25

        iron_cnt = self.state.inventory.get("iron", 0)
        info_str = f"强化需要：100 金 + 1 铁块 | 当前持有：{self.state.gold} 金, {iron_cnt} 铁"
        self.screen.blit(self.font_main.render(info_str, True, COLOR_WARNING), (130, y))
        y += 35

        btn_upgrade = pygame.Rect(250, y, 220, 40)
        def do_upgrade():
            ret = engine.visit_smithy(self.state, "upgrade")
            self.message = f"{ret['dialogue']}\n{ret['message']}"
        self.draw_button(btn_upgrade, "强化兵刃 (+3战力)", do_upgrade)

        btn_close = pygame.Rect(340, 460, 120, 35)
        def close_smithy():
            self.overlay = None
        self.draw_button(btn_close, "返回地图 (ESC)", close_smithy)

    def render_arena_overlay(self):
        """渲染竞技场交互弹窗。"""
        overlay_rect = pygame.Rect(100, 80, 600, 440)
        s = pygame.Surface((600, 440), pygame.SRCALPHA)
        s.fill(COLOR_MODAL_BG)
        self.screen.blit(s, (100, 80))
        pygame.draw.rect(self.screen, COLOR_BORDER, overlay_rect, 2, border_radius=8)

        y = 100
        title_surf = self.font_large.render("—— 热血竞技场 ——", True, COLOR_HIGHLIGHT)
        self.screen.blit(title_surf, title_surf.get_rect(centerx=400, top=y))
        y += 45

        res = engine.visit_arena(self.state)
        dlg_text = res["welcome"]

        dlg_surf = self.font_main.render(dlg_text, True, COLOR_TEXT)
        self.screen.blit(dlg_surf, (130, y))
        y += 45

        pygame.draw.line(self.screen, COLOR_BORDER, (130, y), (670, y), 1)
        y += 25

        btn_fight = pygame.Rect(160, y, 180, 40)
        def do_fight():
            ret = engine.visit_arena(self.state, "fight")
            self.message = f"{ret['message']}"
        self.draw_button(btn_fight, "自己下场打擂 (1轮)", do_fight)

        btn_bet = pygame.Rect(380, y, 180, 40)
        def do_bet():
            ret = engine.visit_arena(self.state, "bet", 50)
            self.message = f"{ret['dialogue']}\n{ret['message']}"
        self.draw_button(btn_bet, "押注角斗比赛 (50金)", do_bet)

        btn_close = pygame.Rect(340, 460, 120, 35)
        def close_arena():
            self.overlay = None
        self.draw_button(btn_close, "返回地图 (ESC)", close_arena)

    def render_combat_overlay(self):
        """渲染战斗抉择与结算弹窗。"""
        overlay_rect = pygame.Rect(120, 100, 560, 400)
        s = pygame.Surface((560, 400), pygame.SRCALPHA)
        s.fill(COLOR_MODAL_BG)
        self.screen.blit(s, (120, 100))
        pygame.draw.rect(self.screen, COLOR_BORDER, overlay_rect, 2, border_radius=8)

        y = 120
        if self.combat_result is None:
            # 战斗决策阶段
            title_surf = self.font_large.render("⚠️ 遭遇敌对敌人！", True, COLOR_WARNING)
            self.screen.blit(title_surf, title_surf.get_rect(centerx=400, top=y))
            y += 45

            enemy_power = self.combat_event.get("enemy_power", 10)
            player_power = engine.calculate_army_power(self.state.troops) + self.state.personal_power

            info1 = f"敌方估算战力: {enemy_power}"
            info2 = f"我方军队战力: {player_power}"
            self.screen.blit(self.font_main.render(info1, True, COLOR_WARNING), (160, y))
            y += 25
            self.screen.blit(self.font_main.render(info2, True, COLOR_SUCCESS), (160, y))
            y += 40

            desc = "请做出你的指挥决策："
            self.screen.blit(self.font_main.render(desc, True, COLOR_TEXT), (160, y))
            y += 35

            # 选项按钮
            btn_attack = pygame.Rect(160, y, 120, 35)
            def do_attack():
                self.combat_result = engine.resolve_combat_simple(
                    self.state, enemy_power, "attack"
                )
            self.draw_button(btn_attack, "[1] 主动进攻", do_attack)

            btn_defend = pygame.Rect(300, y, 120, 35)
            def do_defend():
                self.combat_result = engine.resolve_combat_simple(
                    self.state, enemy_power, "defend"
                )
            self.draw_button(btn_defend, "[2] 筑防坚守", do_defend)

            btn_retreat = pygame.Rect(440, y, 120, 35)
            def do_retreat():
                self.combat_result = engine.resolve_combat_simple(
                    self.state, enemy_power, "retreat"
                )
            self.draw_button(btn_retreat, "[3] 有序撤退", do_retreat)

        else:
            # 战斗结算界面
            res = self.combat_result
            title_text = "🎉 战斗胜利！" if res.get("victory") else "💥 战斗不利/撤退！"
            color = COLOR_SUCCESS if res.get("victory") else COLOR_WARNING

            title_surf = self.font_large.render(title_text, True, color)
            self.screen.blit(title_surf, title_surf.get_rect(centerx=400, top=y))
            y += 45

            msg_lines = [
                res.get("message", ""),
                f"战利品金币: +{res.get('gold_gained', 0)} 金",
                f"我方伤亡总计: {res.get('total_casualties', 0)} 人",
            ]
            for line in msg_lines:
                self.screen.blit(self.font_main.render(line, True, COLOR_TEXT), (160, y))
                y += 28

            y += 20
            btn_confirm = pygame.Rect(340, y, 120, 35)
            def finish_combat():
                self.message = res.get("message", "战斗结束")
                self.combat_event = None
                self.combat_result = None
                self.overlay = None
            self.draw_button(btn_confirm, "确认 (ESC)", finish_combat)

    def handle_fishing(self):
        """按 F 键触发钓鱼行动。"""
        res = engine.fish(self.state, self.state.location)
        self.message = res

    def handle_map_click(self, pos):
        """处理地图区域的鼠标点击逻辑。"""
        # 遍历所有地点，判断是否点击在节点感应区域内 (半径 22px)
        for loc_id, loc in LOCATIONS.items():
            screen_pos = self.logic_to_screen(loc["x"], loc["y"])
            dist_sq = (pos[0] - screen_pos[0]) ** 2 + (pos[1] - screen_pos[1]) ** 2
            if dist_sq <= 22 * 22:
                # 判断是否为当前地点
                if loc_id == self.state.location:
                    self.message = f"你当前就在 [{loc['name']}]。"
                    return

                # 判断是否与当前地点相邻
                curr_neighbors = LOCATIONS.get(self.state.location, {}).get("neighbors", [])
                if loc_id not in curr_neighbors:
                    self.message = f"无法直接前往，[{loc['name']}] 不与当前地点相邻。"
                    return

                # 执行移动操作
                success, msg, event_data = engine.move(self.state, loc_id)
                self.message = msg

                # 检查是否触发战斗事件
                if event_data and event_data.get("type") == "combat":
                    self.overlay = "combat"
                    self.combat_event = event_data
                    self.combat_result = None
                return

    def process_events(self):
        """处理 Pygame 事件循环。"""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
                return

            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                mouse_pos = event.pos

                # 优先检查弹窗或界面中的按钮点击
                button_clicked = False
                for rect, callback in self.buttons:
                    if rect.collidepoint(mouse_pos):
                        callback()
                        button_clicked = True
                        break

                # 若未点击按钮且处于常规地图界面，检查地图节点点击
                if not button_clicked and self.overlay is None:
                    if mouse_pos[0] < self.map_width:
                        self.handle_map_click(mouse_pos)

            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    if self.overlay == "combat":
                        if self.combat_result is not None:
                            self.message = self.combat_result.get("message", "战斗结束")
                            self.combat_event = None
                            self.combat_result = None
                            self.overlay = None
                    elif self.overlay is not None:
                        self.overlay = None
                    else:
                        self.running = False

                elif self.overlay is None:
                    if event.key == pygame.K_s:
                        self.overlay = "shop"
                    elif event.key == pygame.K_r:
                        self.overlay = "recruit"
                    elif event.key == pygame.K_t:
                        self.overlay = "tavern"
                    elif event.key == pygame.K_m:
                        self.overlay = "smithy"
                    elif event.key == pygame.K_a:
                        self.overlay = "arena"
                    elif event.key == pygame.K_f:
                        self.handle_fishing()

                elif self.overlay == "combat" and self.combat_result is None:
                    # 战斗阶段键盘数字映射快捷键
                    enemy_power = self.combat_event.get("enemy_power", 10)
                    if event.key == pygame.K_1:
                        self.combat_result = engine.resolve_combat_simple(
                            self.state, enemy_power, "attack"
                        )
                    elif event.key == pygame.K_2:
                        self.combat_result = engine.resolve_combat_simple(
                            self.state, enemy_power, "defend"
                        )
                    elif event.key == pygame.K_3:
                        self.combat_result = engine.resolve_combat_simple(
                            self.state, enemy_power, "retreat"
                        )

    def run(self):
        """启动图形客户端主绘制与循环。"""
        while self.running:
            # 1. 清空上一帧的按钮响应区注册表
            self.buttons = []

            # 2. 基础地图与 UI 面板绘制
            self.render_map()
            self.render_panel()

            # 3. 绘制覆盖层弹窗 (注册弹窗按钮)
            if self.overlay == "shop":
                self.render_shop_overlay()
            elif self.overlay == "recruit":
                self.render_recruit_overlay()
            elif self.overlay == "tavern":
                self.render_tavern_overlay()
            elif self.overlay == "smithy":
                self.render_smithy_overlay()
            elif self.overlay == "arena":
                self.render_arena_overlay()
            elif self.overlay == "combat":
                self.render_combat_overlay()

            # 4. 事件处理 (能够正确匹配当前帧已绘制的按钮)
            self.process_events()

            pygame.display.flip()
            self.clock.tick(60)

        pygame.quit()


def start_gui(state):
    """图形客户端入口函数。"""
    client = GUIClient(state)
    client.run()
