from core.state import GameState
from client.terminal import start_cli


def main():
    state = GameState()
    start_cli(state)


if __name__ == "__main__":
    main()
