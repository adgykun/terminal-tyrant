/**
 * lords_system.ts —— 领主运行时系统。
 *
 * 与 lords_bannerlord.ts（静态定义）配合：
 *  - 为每位领主生成初始私兵；
 *  - 领主战败后部队大幅减员、关系下降，可能被俘；
 *  - 俘虏可被释放/赎金/处决；
 *  - 领主部队会随王国战争状态缓慢补充。
 */
import { BANNERLORD_TROOPS, troopsByCulture } from "./troops_bannerlord";
import { LORDS_BANNERLORD, PERSONALITY_TRAIT, type LordDef, type LordState, type LordRuntime } from "./lords_bannerlord";

/** 王国 → 文化（用于挑选兵种）。 */
const KINGDOM_CULTURE: Record<string, string> = {
  empire_n: "empire", empire_w: "empire", empire_s: "empire",
  sturgia: "sturgia", aserai: "aserai", vlandia: "vlandia",
  battania: "battania", khuzait: "khuzait",
};

/** 简单的确定性随机（同一存档可复现）。 */
function seededRand(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** 为某位领主生成初始部队（规模由 armySize 决定）。 */
export function generateLordTroops(lord: LordDef): Record<string, number> {
  const rnd = seededRand(lord.id);
  const culture = KINGDOM_CULTURE[lord.kingdom] ?? "empire";
  let pool: any[] = [];
  try {
    pool = troopsByCulture(culture) ?? [];
  } catch {
    pool = [];
  }
  // 兜底：文化池为空则用全表里 power 适中的兵种
  if (!pool || pool.length === 0) {
    pool = Object.values(BANNERLORD_TROOPS).slice(0, 12);
  }

  const total = lord.armySize * 4 + Math.floor(rnd() * 6);
  const troops: Record<string, number> = {};
  for (let i = 0; i < total; i++) {
    const t = pool[Math.floor(rnd() * pool.length)];
    const uid = t?.id ?? t?.name;
    if (!uid) continue;
    troops[uid] = (troops[uid] ?? 0) + 1;
  }
  return troops;
}

/** 初始化全部领主的运行时状态。 */
export function buildInitialLordRuntime(): LordRuntime {
  const rt: LordRuntime = {};
  for (const lord of Object.values(LORDS_BANNERLORD)) {
    rt[lord.id] = {
      relationWithPlayer: 0,
      captive: false,
      troops: generateLordTroops(lord),
      dead: false,
      timesDefeated: 0,
    };
  }
  return rt;
}

/** 取/建领主运行时状态（幂等）。 */
export function ensureLords(state: any): LordRuntime {
  if (!state.lords_runtime || typeof state.lords_runtime !== "object") {
    state.lords_runtime = buildInitialLordRuntime();
  }
  return state.lords_runtime as LordRuntime;
}

/** 领主部队总人数。 */
export function lordTroopCount(ls: LordState | undefined): number {
  if (!ls?.troops) return 0;
  return Object.values(ls.troops).reduce((s, n) => s + n, 0);
}

/** 领主部队总战力。 */
export function lordPower(ls: LordState | undefined): number {
  if (!ls?.troops) return 0;
  return Object.entries(ls.troops).reduce(
    (s, [uid, cnt]) => s + (BANNERLORD_TROOPS[uid]?.power ?? 1) * cnt,
    0,
  );
}

export interface LordDefeatResult {
  lordId: string;
  lordName: string;
  /** 是否被俘 */
  captured: boolean;
  /** 是否被玩家处决（由外部决定，此处默认否） */
  executed: boolean;
  troopsLost: number;
  troopsRemaining: number;
  relationDelta: number;
  message: string;
}

/**
 * 领主被玩家击败。
 *
 * @param lordId 领主 id
 * @param playerHonor 玩家荣誉（0-100，影响是否放人以换取好感）
 * @param captureChance 基础俘虏概率
 */
export function defeatLord(
  state: any,
  lordId: string,
  captureChance = 0.45,
): LordDefeatResult | null {
  const lord = LORDS_BANNERLORD[lordId];
  if (!lord) return null;
  const rt = ensureLords(state);
  const ls = rt[lordId];
  if (!ls || ls.dead) return null;

  const before = lordTroopCount(ls);
  // 战败：损失 60%-85% 兵力
  const lossFrac = 0.6 + Math.random() * 0.25;
  const kept: Record<string, number> = {};
  let remaining = 0;
  for (const [uid, cnt] of Object.entries(ls.troops)) {
    const keep = Math.max(0, Math.round(cnt * (1 - lossFrac)));
    if (keep > 0) {
      kept[uid] = keep;
      remaining += keep;
    }
  }
  ls.troops = kept;
  ls.timesDefeated += 1;

  // 俘虏判定：性格越谨慎越容易被俘（跑得慢），好战的更容易死战
  const trait = PERSONALITY_TRAIT[lord.personality];
  const chance = captureChance * (1.3 - trait.aggression * 0.5);
  const captured = Math.random() < chance;
  if (captured) ls.captive = true;

  // 关系惩罚
  const relationDelta = -8;
  ls.relationWithPlayer = Math.max(-100, ls.relationWithPlayer + relationDelta);

  const lost = before - remaining;
  const msg = captured
    ? `${lord.name}（${lord.title}）被你的部队击败并俘获！歼敌 ${lost} 人。`
    : `${lord.name}（${lord.title}）被你的部队击败，歼敌 ${lost} 人，残部溃逃。`;

  return {
    lordId,
    lordName: lord.name,
    captured,
    executed: false,
    troopsLost: lost,
    troopsRemaining: remaining,
    relationDelta,
    message: msg,
  };
}

/** 释放被俘领主（提升好感）。 */
export function releaseLord(state: any, lordId: string): string {
  const rt = ensureLords(state);
  const ls = rt[lordId];
  const lord = LORDS_BANNERLORD[lordId];
  if (!ls || !lord) return "无效的领主。";
  if (!ls.captive) return `${lord.name} 并不在你的掌握之中。`;
  ls.captive = false;
  ls.relationWithPlayer = Math.min(100, ls.relationWithPlayer + 20);
  return `你释放了 ${lord.name}。对方承诺铭记此恩（好感 +20）。`;
}

/** 处决被俘领主（大幅降低该国所有领主好感）。 */
export function executeLord(state: any, lordId: string): string {
  const rt = ensureLords(state);
  const ls = rt[lordId];
  const lord = LORDS_BANNERLORD[lordId];
  if (!ls || !lord) return "无效的领主。";
  if (!ls.captive) return `${lord.name} 并不在你的掌握之中。`;
  ls.dead = true;
  ls.captive = false;
  ls.troops = {};
  // 同国领主好感集体下降
  for (const other of Object.values(LORDS_BANNERLORD)) {
    if (other.kingdom !== lord.kingdom) continue;
    const os = rt[other.id];
    if (os) os.relationWithPlayer = Math.max(-100, os.relationWithPlayer - 30);
  }
  return `你处决了 ${lord.name}。${lord.kingdom} 的领主们将永远憎恨你。`;
}

/** 索要赎金释放。 */
export function ransomLord(state: any, lordId: string, amount: number): string {
  const rt = ensureLords(state);
  const ls = rt[lordId];
  const lord = LORDS_BANNERLORD[lordId];
  if (!ls || !lord) return "无效的领主。";
  if (!ls.captive) return `${lord.name} 并不在你的掌握之中。`;
  ls.captive = false;
  state.gold = (state.gold ?? 0) + amount;
  // 收赎金会略微降低好感
  ls.relationWithPlayer = Math.max(-100, ls.relationWithPlayer - 5);
  return `你以 ${amount} 金币为代价放走了 ${lord.name}。`;
}

/** 每日：领主部队缓慢补充（除非被俘或已死）。 */
export function lordsDailyUpdate(state: any): void {
  const rt = ensureLords(state);
  for (const [id, lord] of Object.entries(LORDS_BANNERLORD)) {
    const ls = rt[id];
    if (!ls || ls.dead) continue;
    if (ls.captive) continue;
    const cur = lordTroopCount(ls);
    const target = lord.armySize * 4;
    if (cur >= target) continue;
    // 每天补充 1-2 人
    const culture = KINGDOM_CULTURE[lord.kingdom] ?? "empire";
    let pool: any[] = [];
    try {
      pool = troopsByCulture(culture) ?? [];
    } catch {
      pool = [];
    }
    if (!pool || pool.length === 0) continue;
    const add = Math.min(target - cur, 1 + Math.floor(Math.random() * 2));
    for (let i = 0; i < add; i++) {
      const t = pool[Math.floor(Math.random() * pool.length)];
      const uid = t?.id ?? t?.name;
      if (!uid) continue;
      ls.troops[uid] = (ls.troops[uid] ?? 0) + 1;
    }
  }
}

/** 列出玩家可交互的领主（同国或俘虏中的）。 */
export function availableLords(state: any): { lord: LordDef; ls: LordState }[] {
  const rt = ensureLords(state);
  const out: { lord: LordDef; ls: LordState }[] = [];
  for (const lord of Object.values(LORDS_BANNERLORD)) {
    const ls = rt[lord.id];
    if (!ls || ls.dead) continue;
    out.push({ lord, ls });
  }
  return out;
}
