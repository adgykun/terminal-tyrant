/**
 * lord_ai.ts —— 大地图领主/军团 AI 内核（骑砍式活世界）。
 *
 * 取代原 map_units.ts 中的「随机选点游走 + 战败坐标设为 999 消失」。
 *
 * 设计：
 *  - 每支军团持有明确 **意图 Intent**：驻防 / 驰援 / 围城 / 劫掠 / 撤退 / 追击；
 *  - 每帧重新评估：看到强敌就退，看到弱敌就追，己方城镇被围就去救；
 *  - 遭遇战不再"比战力后消失"，而是**真打一场**：双方按战力损失兵力，
 *    败方残部撤向最近己方城镇，兵力可能归零（真正被歼灭）；
 *  - 玩家介入：玩家与敌方军团接触时交给上层发起 3D 战斗。
 */
import { MapUnit } from "./map_units";

export type Intent = "garrison" | "reinforce" | "siege" | "raid" | "retreat" | "pursue" | "patrol";

export interface ArmyMemory {
  /** 当前意图 */
  intent: Intent;
  /** 意图目标坐标 */
  intentX: number;
  intentY: number;
  /** 意图目标据点 id（若有） */
  targetLocId: string | null;
  /** 已执行当前意图的天数 */
  intentAge: number;
  /** 士气/补给 0..1，影响战斗力与是否撤退 */
  supply: number;
  /** 被击败后的残余兵力比例（用于撤退行为） */
  shattered: boolean;
}

/** 军团记忆表：unitId → 状态（运行时，不强制持久化）。 */
const memory = new Map<string, ArmyMemory>();

/** 交战冷却表：pairKey → 剩余帧数（防止同一对军团每帧重复结算）。 */
const battleCooldown = new Map<string, number>();

export function getMemory(u: MapUnit): ArmyMemory {
  let m = memory.get(u.id);
  if (!m) {
    m = {
      intent: "patrol",
      intentX: u.targetX,
      intentY: u.targetY,
      targetLocId: null,
      intentAge: 0,
      supply: 0.8 + Math.random() * 0.2,
      shattered: false,
    };
    memory.set(u.id, m);
  }
  return m;
}

export function clearMemory(unitId: string): void {
  memory.delete(unitId);
}

export function armyPower(u: MapUnit, troopPower: (troops?: Record<string, number>) => number): number {
  return troopPower(u.troops);
}

export interface LordContext {
  /** 当前所有单位 */
  units: MapUnit[];
  /** 所有可用据点 */
  locations: any[];
  /** 判定两国是否交战 */
  isAtWar: (a: string, b: string) => boolean;
  /** 兵力计算 */
  troopPower: (troops?: Record<string, number>) => number;
  /** 据点的所属王国 key */
  locKingdom: (loc: any) => string;
  /** 据点当前是否被围攻（返回围攻者 kingdom key） */
  siegeOf: (locId: string) => string | null;
}

export interface EncounterResult {
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
  loserDestroyed: boolean;
  loserTroopsLost: number;
  /** 败方是否为玩家（由上层判断是否要玩家亲自打） */
  loserIsPlayer: boolean;
  message: string;
}

const ENGAGE_RANGE = 2.2;
const DETECT_RANGE = 18;
const FLEE_RANGE = 6;

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 找最近的己方据点。 */
function nearestFriendlyLoc(u: MapUnit, ctx: LordContext): any | null {
  let best: any = null;
  let bestD = Infinity;
  for (const loc of ctx.locations) {
    const k = ctx.locKingdom(loc);
    if (k !== u.factionKey) continue;
    const d = dist(u, loc);
    if (d < bestD) {
      bestD = d;
      best = loc;
    }
  }
  return best;
}

/** 找最近的敌国据点（围城/劫掠目标）。 */
function nearestEnemyLoc(u: MapUnit, ctx: LordContext): any | null {
  let best: any = null;
  let bestD = Infinity;
  for (const loc of ctx.locations) {
    const k = ctx.locKingdom(loc);
    if (!k || k === u.factionKey) continue;
    if (!ctx.isAtWar(u.factionKey!, k)) continue;
    const d = dist(u, loc);
    if (d < bestD) {
      bestD = d;
      best = loc;
    }
  }
  return best;
}

/** 找范围内最强/最弱的敌对军团。 */
function findEnemyArmy(u: MapUnit, ctx: LordContext, range: number, wantWeakest: boolean): MapUnit | null {
  let best: MapUnit | null = null;
  let bestP = wantWeakest ? Infinity : -Infinity;
  const myP = ctx.troopPower(u.troops);
  for (const o of ctx.units) {
    if (o.id === u.id || o.type !== "army") continue;
    if (!o.factionKey || !u.factionKey) continue;
    if (!ctx.isAtWar(u.factionKey, o.factionKey)) continue;
    if (dist(u, o) > range) continue;
    const p = ctx.troopPower(o.troops);
    // 只考虑胜算合理的对手
    if (wantWeakest) {
      if (p < myP * 1.15 && p < bestP) {
        bestP = p;
        best = o;
      }
    } else {
      if (p > myP * 1.25 && p > bestP) {
        bestP = p;
        best = o;
      }
    }
  }
  return best;
}

/**
 * 为军团重新决定意图（每 N 帧或到达目标时调用）。
 */
export function decideIntent(u: MapUnit, ctx: LordContext): ArmyMemory {
  const m = getMemory(u);
  m.intentAge += 1;
  if (!u.factionKey) return m;

  const myPower = ctx.troopPower(u.troops);

  // 1. 残兵 → 撤往最近己方城镇补给
  if (m.shattered || myPower < 25) {
    const home = nearestFriendlyLoc(u, ctx);
    if (home) {
      m.intent = "retreat";
      m.intentX = home.x;
      m.intentY = home.y;
      m.targetLocId = home.id;
      return m;
    }
  }

  // 2. 附近有压倒性强敌 → 撤退（仅当对方战力 > 己方 1.8 倍时才逃，
  //    否则骑砍式地"迎战"——否则双方互相回避永远打不起来）
  const threat = findEnemyArmy(u, ctx, FLEE_RANGE, false);
  if (threat) {
    const myP = ctx.troopPower(u.troops);
    const tp = ctx.troopPower(threat.troops);
    if (tp > myP * 1.8) {
      const home = nearestFriendlyLoc(u, ctx);
      if (home) {
        m.intent = "retreat";
        m.intentX = home.x;
        m.intentY = home.y;
        m.targetLocId = home.id;
        return m;
      }
    } else {
      // 势均力敌或占优 → 主动迎战
      m.intent = "pursue";
      m.intentX = threat.x;
      m.intentY = threat.y;
      m.targetLocId = null;
      return m;
    }
  }

  // 3. 附近有弱敌且己方占优 → 追击
  const prey = findEnemyArmy(u, ctx, DETECT_RANGE, true);
  if (prey && myPower > ctx.troopPower(prey.troops) * 1.3) {
    m.intent = "pursue";
    m.intentX = prey.x;
    m.intentY = prey.y;
    m.targetLocId = null;
    return m;
  }

  // 4. 己方据点正被围攻 → 驰援
  for (const loc of ctx.locations) {
    if (ctx.locKingdom(loc) !== u.factionKey) continue;
    const attacker = ctx.siegeOf(loc.id);
    if (attacker && ctx.isAtWar(u.factionKey, attacker)) {
      m.intent = "reinforce";
      m.intentX = loc.x;
      m.intentY = loc.y;
      m.targetLocId = loc.id;
      return m;
    }
  }

  // 5. 战时：前往敌国据点围城/劫掠
  if (ctx.isAtWar !== undefined) {
    const enemyLoc = nearestEnemyLoc(u, ctx);
    if (enemyLoc) {
      // 兵力充足 → 围城；否则在外围劫掠
      m.intent = myPower > 70 ? "siege" : "raid";
      m.intentX = enemyLoc.x + (myPower > 70 ? 0 : 3 * Math.sin(u.x + u.y));
      m.intentY = enemyLoc.y;
      m.targetLocId = enemyLoc.id;
      return m;
    }
  }

  // 6. 和平：回己方城镇驻防
  const home = nearestFriendlyLoc(u, ctx);
  if (home) {
    m.intent = "garrison";
    m.intentX = home.x;
    m.intentY = home.y;
    m.targetLocId = home.id;
    return m;
  }

  m.intent = "patrol";
  return m;
}

/**
 * 推进所有军团一天/一帧的地图行为，返回遭遇战结果。
 */
export function advanceArmies(
  dt: number,
  ctx: LordContext,
): EncounterResult[] {
  const results: EncounterResult[] = [];
  const dead = new Set<string>();

  // 预处理：兵力为 0 的军团视为已覆灭，加入 dead 并清空残兵
  for (const u of ctx.units) {
    if (u.type !== "army") continue;
    const total = Object.values(u.troops || {}).reduce((s, n) => s + n, 0);
    if (total <= 0) {
      dead.add(u.id);
      clearMemory(u.id);
    }
  }

  // 递减交战冷却
  for (const [k, v] of battleCooldown) {
    if (v <= 1) battleCooldown.delete(k);
    else battleCooldown.set(k, v - 1);
  }

  for (const u of ctx.units) {
    if (u.type !== "army" || !u.factionKey) continue;
    if (dead.has(u.id)) continue;
    if (u.dwell > 0) {
      u.dwell -= dt;
      // 驻留时回补补给
      const m0 = getMemory(u);
      m0.supply = Math.min(1, m0.supply + dt * 0.05);
      continue;
    }

    const m = getMemory(u);
    // 每 1.5 秒重新评估意图
    if (m.intentAge <= 0 || m.intentAge % 90 === 0) {
      decideIntent(u, ctx);
    }

    // 追击时目标会动，实时校正为最近的交战敌人
    if (m.intent === "pursue") {
      let closest: MapUnit | null = null;
      let cd = Infinity;
      for (const o of ctx.units) {
        if (o.id === u.id || o.type !== "army" || !o.factionKey) continue;
        if (!u.factionKey || !ctx.isAtWar(u.factionKey, o.factionKey)) continue;
        const total = Object.values(o.troops || {}).reduce((s, n) => s + n, 0);
        if (total <= 0) continue;
        const dd = dist(u, o);
        if (dd < cd) {
          cd = dd;
          closest = o;
        }
      }
      if (closest) {
        m.intentX = closest.x;
        m.intentY = closest.y;
      }
    }

    // 移动
    const dx = m.intentX - u.x;
    const dy = m.intentY - u.y;
    const d = Math.hypot(dx, dy);
    // 撤退与追击更快
    const speedMul = m.intent === "retreat" ? 1.35 : m.intent === "pursue" ? 1.15 : 1;
    const supplyMul = 0.6 + m.supply * 0.4;
    if (d > 0.3) {
      const step = Math.min(u.speed * speedMul * supplyMul * dt, d);
      u.x += (dx / d) * step;
      u.y += (dy / d) * step;
      // 行军消耗补给
      m.supply = Math.max(0.15, m.supply - dt * 0.004);
    } else {
      // 到达意图点
      if (m.intent === "siege" || m.intent === "raid" || m.intent === "garrison" || m.intent === "reinforce") {
        u.dwell = 3 + Math.random() * 4;
      }
      m.intentAge = 1;
      decideIntent(u, ctx);
    }
  }

  // 遭遇战：距离足够近即开战
  const armies = ctx.units.filter((u) => u.type === "army" && u.factionKey && !dead.has(u.id));
  for (let i = 0; i < armies.length; i++) {
    for (let j = i + 1; j < armies.length; j++) {
      const a = armies[i];
      const b = armies[j];
      if (!a.factionKey || !b.factionKey) continue;
      if (!ctx.isAtWar(a.factionKey, b.factionKey)) continue;
      if (dead.has(a.id) || dead.has(b.id)) continue;
      // 兵力已归零的军团跳过（已被歼灭）
      const totA = Object.values(a.troops || {}).reduce((s, n) => s + n, 0);
      const totB = Object.values(b.troops || {}).reduce((s, n) => s + n, 0);
      if (totA <= 0) { dead.add(a.id); continue; }
      if (totB <= 0) { dead.add(b.id); continue; }
      if (dist(a, b) > ENGAGE_RANGE) continue;

      const pa = ctx.troopPower(a.troops);
      const pb = ctx.troopPower(b.troops);
      // 战力差距 + 补给加成决定胜负
      const sa = pa * (0.7 + getMemory(a).supply * 0.3) * (0.85 + Math.random() * 0.3);
      const sb = pb * (0.7 + getMemory(b).supply * 0.3) * (0.85 + Math.random() * 0.3);
      const winner = sa >= sb ? a : b;
      const loser = winner === a ? b : a;

      // 同一对军团交战后进入冷却，避免每帧重复结算
      const pairKey = [a.id, b.id].sort().join("#");
      if (!battleCooldown.has(pairKey)) battleCooldown.set(pairKey, 0);
      if (battleCooldown.get(pairKey)! > 0) continue;
      battleCooldown.set(pairKey, 240); // 4 秒冷却（60fps）

      const pw = winner === a ? pa : pb;
      const pl = winner === a ? pb : pa;

      // 败方损失：战力差距越大损失越惨重（30%~90%）
      const ratio = Math.min(1, pl / Math.max(1, pw));
      const lossFrac = Math.min(0.92, 0.35 + (1 - ratio) * 0.6);
      let lost = 0;
      let remaining = 0;

      if (loser.troops) {
        for (const [uid, cntRaw] of Object.entries(loser.troops)) {
          const cnt = cntRaw as number;
          const keep = Math.max(0, Math.round(cnt * (1 - lossFrac)));
          lost += cnt - keep;
          remaining += keep;
          loser.troops[uid] = keep;
        }
      }
      // 胜方也付出代价（10%~25%）
      const winLoss = Math.min(0.25, 0.08 + ratio * 0.15);
      if (winner.troops) {
        for (const [uid, cntRaw] of Object.entries(winner.troops)) {
          const cnt = cntRaw as number;
          winner.troops[uid] = Math.max(0, Math.round(cnt * (1 - winLoss)));
        }
        // 清理空兵种
        for (const k of Object.keys(winner.troops)) {
          if (!winner.troops[k]) delete winner.troops[k];
        }
      }

      const lm = getMemory(loser);
      const destroyed = remaining <= 0;
      if (destroyed) {
        dead.add(loser.id);
        clearMemory(loser.id);
      } else {
        // 残部撤向己方城镇
        lm.shattered = true;
        lm.supply = Math.max(0.2, lm.supply - 0.4);
        decideIntent(loser, ctx);
      }

      const nMm = getMemory(winner);
      nMm.supply = Math.min(1, nMm.supply + 0.15);
      // 胜方在战场停留
      winner.dwell = 2 + Math.random() * 2;

      results.push({
        winnerId: winner.id,
        loserId: loser.id,
        winnerName: winner.name,
        loserName: loser.name,
        loserDestroyed: destroyed,
        loserTroopsLost: lost,
        loserIsPlayer: false,
        message: destroyed
          ? `${winner.name} 全歼了 ${loser.name}！`
          : `${winner.name} 击败 ${loser.name}，歼敌 ${lost}，残部溃逃。`,
      });
    }
  }

  return results;
}

/** 从单位列表中移除已覆灭的军团（供调用方清理）。 */
export function pruneDestroyed(units: MapUnit[]): MapUnit[] {
  return units.filter((u) => !(u.type === "army" && u.troops && Object.values(u.troops).reduce((s, n) => s + n, 0) <= 0));
}
