"""Phase 8 单元测试：字符大地图与每日日志系统测试。"""

import io
import sys
import unittest
from core.data import LOCATIONS
from core.state import GameState
from core.engine import (
    add_log,
    move,
    resolve_combat_simple,
    daily_update,
    declare_kingdom,
)
from client.terminal import draw_map


class TestPhase8MapAndLog(unittest.TestCase):
    """测试字符大地图与每日日志系统。"""

    def setUp(self):
        """初始化测试环境。"""
        self.state = GameState()

    def test_locations_coordinates(self):
        """测试所有地点是否包含有效 x, y 坐标。"""
        for loc_id, loc_data in LOCATIONS.items():
            self.assertIn("x", loc_data)
            self.assertIn("y", loc_data)
            self.assertGreaterEqual(loc_data["x"], 0)
            self.assertLessEqual(loc_data["x"], 100)
            self.assertGreaterEqual(loc_data["y"], 0)
            self.assertLessEqual(loc_data["y"], 100)

    def test_state_log_history_serialization(self):
        """测试 log_history 的初始化与序列化反序列化。"""
        self.assertEqual(self.state.log_history, [])
        add_log(self.state, "测试日志条目1")
        self.assertEqual(len(self.state.log_history), 1)
        self.assertEqual(self.state.log_history[0]["event"], "测试日志条目1")

        data_dict = self.state.to_dict()
        self.assertIn("log_history", data_dict)
        self.assertEqual(len(data_dict["log_history"]), 1)

        restored_state = GameState.from_dict(data_dict)
        self.assertEqual(len(restored_state.log_history), 1)
        self.assertEqual(restored_state.log_history[0]["event"], "测试日志条目1")

    def test_add_log_max_limit(self):
        """测试日志历史最多只保留最近 50 条记录。"""
        for i in range(60):
            add_log(self.state, f"事件 {i}")

        self.assertEqual(len(self.state.log_history), 50)
        self.assertEqual(self.state.log_history[0]["event"], "事件 10")
        self.assertEqual(self.state.log_history[-1]["event"], "事件 59")

    def test_engine_events_add_log(self):
        """测试 engine 中主要操作触发日志记录。"""
        # 测试 daily_update
        daily_update(self.state)
        self.assertTrue(any("天结束" in item["event"] for item in self.state.log_history))

        # 测试 move
        target_loc = "river_town"
        move(self.state, target_loc)
        self.assertTrue(any("移动途中" in item["event"] for item in self.state.log_history))

        # 测试 resolve_combat_simple
        resolve_combat_simple(self.state, 10, "attack")
        self.assertTrue(any("战斗" in item["event"] for item in self.state.log_history))

        # 测试 declare_kingdom
        self.state.renown = 600
        self.state.fiefs = ["fief1", "fief2", "fief3"]
        declare_kingdom(self.state, "大秦")
        self.assertTrue(any("伟大的 大秦 成立了！" in item["event"] for item in self.state.log_history))

    def test_draw_map_output(self):
        """测试 draw_map 函数能正常打印大地图，包含 T, V, W 和 @。"""
        captured_output = io.StringIO()
        sys.stdout = captured_output
        try:
            draw_map(self.state)
        finally:
            sys.stdout = sys.__stdout__

        output = captured_output.getvalue()
        self.assertIn("【三国简易大地图】", output)
        self.assertIn("@", output)
        self.assertIn("T", output)
        self.assertIn("V", output)
        self.assertIn("W", output)


if __name__ == "__main__":
    unittest.main()
