import { useMemo } from "react";
import type { GameState } from "../core/state";
import { derivePlayerCombat } from "../core/player_combat";

/**
 * usePlayerCombat —— 推导玩家英雄的战斗属性（供 3D 战场使用）。
 *
 * 独立成 hook 的原因：App.tsx 需要在早退分支（未开始游戏）之前调用它，
 * 抽出后 App 只需一行调用，避免 hooks 顺序问题。
 */
export function usePlayerCombat(state: GameState | null) {
    return useMemo(
          () => (state ? derivePlayerCombat(state.attributes ?? {}, state.equipment ?? {}) : null),
          // 依赖取具体字段：属性/装备变化才重新推导
          [state, state?.attributes?.strength, state?.attributes?.intellect, state?.attributes?.charm, state?.equipment],
        );
}
