/**
 * battle_bridge.ts —— 3D 战场与大地图军团之间的结果通道。
 *
 * 背景：军团单位（MapUnit）存在 WorldMapCanvas 的 useRef 里，不进入 React state。
 * 3D 战斗在 App 层结束后，需要通过这个模块把「打的是哪支军团、战果如何」
 * 送回到地图层，让军团真实减员甚至覆灭。
 *
 * 用法：
 *   App 层战后调用 reportBattle(unitId, won)
 *   WorldMapCanvas 在每帧渲染时调用 drainBattleReports() 取出并处理
 */

export interface BattleReport {
  unitId: string;
  won: boolean;
  /** 若这场仗对付的是某位具名领主，记录其 id。 */
  lordId?: string;
}

let queue: BattleReport[] = [];

/** 提交一次战斗结果（App 层调用）。 */
export function reportBattle(unitId: string, won: boolean, lordId?: string): void {
  queue.push({ unitId, won, lordId });
}

/** 取出并清空全部待处理战报（地图层调用）。 */
export function drainBattleReports(): BattleReport[] {
  const out = queue;
  queue = [];
  return out;
}

/**
 * 把战报应用到军团上：
 *  - 玩家胜利：敌军损失 55%~85% 兵力，剩余不足 10% 则视为被歼灭
 *  - 玩家失败：敌军损失 20%~35%
 */
export function applyReportToTroops(
  troops: Record<string, number> | undefined,
  won: boolean,
): { troops: Record<string, number>; destroyed: boolean; lost: number } {
  if (!troops) return { troops: {}, destroyed: true, lost: 0 };
  const lossFrac = won ? 0.55 + Math.random() * 0.3 : 0.2 + Math.random() * 0.15;
  const out: Record<string, number> = {};
  let lost = 0;
  let remaining = 0;
  for (const [uid, cntRaw] of Object.entries(troops)) {
    const cnt = cntRaw as number;
    const keep = Math.max(0, Math.round(cnt * (1 - lossFrac)));
    lost += cnt - keep;
    remaining += keep;
    if (keep > 0) out[uid] = keep;
  }
  const totalBefore = Object.values(troops).reduce((s, n) => s + n, 0);
  // 剩余不足原兵力 10% 或总数 <= 2 → 全军覆没
  const destroyed = remaining <= 2 || remaining < totalBefore * 0.1;
  return { troops: destroyed ? {} : out, destroyed, lost };
}
