"""Core Engine logic for settlement (combat, economy, time progression).

Pure logic calculations only. Strictly no UI, input(), or print().
"""


def advance_day(state):
    """Advance the game time by one day."""
    state.day += 1
    return state
