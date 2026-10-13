"""Terminal Tyrant - 图形界面 (GUI) 入口程序。"""

from core.state import GameState
from client.gui import start_gui


def main():
    state = GameState()
    start_gui(state)


if __name__ == "__main__":
    main()
