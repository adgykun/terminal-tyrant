/**
 * diplomacy.ts —— 势力外交内核（骑砍式战争/和平决策）。
 *
 * 取代原 engine.ts 中 `if (Math.random() < 0.10)` 的掷骰子实现。
 *
 * 设计原则：
 *  1. 每个王国持有「战争意愿」warWeariness（0-100，越高越厌战）与「好战度」aggression；
 *  2. 宣战/议和由**可解释的评分**驱动，任何决定都能给出理由文本；
 *  3. 关系值不再是 0/-50 的二值跳变，而是连续值（-100..100），带惯性；
 *  4. 所有状态运行时可变，不再依赖静态 KINGDOM_REL 表。
 *
 * 世界状态保存在 state.diplomacy 中，随存档持久化。
 */

export interface KingdomState {
  /** 关系值 -100（血仇）..100（联盟） */
  relations: Record<string, number>;
  /** 厌战度 0..100，越高越倾向议和，战争持续则持续上升 */
  warWeariness: number;
  /** 好战度 0..1，影响主动宣战倾向（库赛特高、瓦兰迪亚中等） */
  aggression: number;
  /** 战争累计天数（用于厌战计算） */
  warDays: Record<string, number>;
  /** 与某国停战的日号（用于冷却，防止立刻重燃） */
  lastPeaceDay?: Record<string, number>;
  /** 该王国控制的据点数量（由外部同步） */
  fiefCount: number;
  /** 军事力量评估（由外部同步） */
  strength: number;
}

export interface DiplomacyState {
  kingdoms: Record<string, KingdomState>;
  /** 最近一次外交决策的日志（便于 UI 展示与调试） */
  lastDecisions: { day: number; text: string }[];
  /** 是否已初始化 */
  initialized: boolean;
}

/** 各国好战倾向（对照骑砍2 的文化性格）。 */
const AGGRESSION: Record<string, number> = {
  khuzait: 0.72,   // 库赛特：草原掠夺者，最嗜战
  aserai: 0.60,
  battania: 0.58,
  sturgia: 0.55,
  empire_w: 0.50,
  empire_n: 0.46,
  empire_s: 0.46,
  vlandia: 0.42,   // 瓦兰迪亚：重商主义，更愿维持和平
};

/** 三国鼎立的帝国诸省彼此默认敌意更高。 */
const ETERNAL_RIVALRY: [string, string][] = [
  ["empire_n", "empire_w"],
  ["empire_n", "empire_s"],
  ["empire_w", "empire_s"],
];

/** 初始关系（对照骑砍2 开局态势）。 */
const INITIAL_RELATIONS: Record<string, Record<string, number>> = {
  empire_n: { empire_w: -50, empire_s: -35, sturgia: -45, vlandia: 30, khuzait: -10, aserai: 25, battania: 30 },
  empire_w: { empire_n: -50, empire_s: -45, sturgia: 30, vlandia: -50, khuzait: -10, aserai: 25, battania: 5 },
  empire_s: { empire_n: -35, empire_w: -45, sturgia: 5, vlandia: 25, khuzait: -50, aserai: -45, battania: 20 },
  sturgia: { empire_n: -45, empire_w: 30, empire_s: 5, vlandia: 5, khuzait: -50, aserai: 5, battania: 30 },
  aserai: { empire_n: 25, empire_w: 25, empire_s: -45, sturgia: 5, vlandia: 5, khuzait: -50, battania: 5 },
  vlandia: { empire_n: 30, empire_w: -50, empire_s: 25, sturgia: 5, aserai: 5, khuzait: 5, battania: -50 },
  battania: { empire_n: 30, empire_w: 5, empire_s: 20, sturgia: 30, aserai: 5, khuzait: 5, vlandia: -50 },
  khuzait: { empire_n: -10, empire_w: -10, empire_s: -50, sturgia: -50, aserai: -50, vlandia: 5, battania: 5 },
};

const KINGDOM_IDS = [
  "empire_n", "empire_w", "empire_s", "sturgia", "aserai", "vlandia", "battania", "khuzait",
];

/** 战争判定阈值：关系低于此值即处于战争状态。 */
export const WAR_THRESHOLD = -20;
/** 和平判定所需的最低关系。 */
export const PEACE_THRESHOLD = 0;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 创建/取得外交状态（幂等）。 */
export function ensureDiplomacy(state: any): DiplomacyState {
  if (!state.diplomacy) {
    state.diplomacy = buildInitialDiplomacy();
  }
  return state.diplomacy as DiplomacyState;
}

export function buildInitialDiplomacy(): DiplomacyState {
  const kingdoms: Record<string, KingdomState> = {};
  for (const id of KINGDOM_IDS) {
    kingdoms[id] = {
      relations: { ...(INITIAL_RELATIONS[id] ?? {}) },
      warWeariness: 0,
      aggression: AGGRESSION[id] ?? 0.5,
      warDays: {},
      fiefCount: 0,
      strength: 100,
    };
  }
  return { kingdoms, lastDecisions: [], initialized: true };
}

/** 两名王国之间的对称关系值（取平均，避免单边不一致）。 */
export function getRelation(dip: DiplomacyState, a: string, b: string): number {
  const ra = dip.kingdoms[a]?.relations?.[b];
  const rb = dip.kingdoms[b]?.relations?.[a];
  if (ra === undefined && rb === undefined) return 0;
  if (ra === undefined) return rb as number;
  if (rb === undefined) return ra;
  return (ra + rb) / 2;
}

/** 写入对称关系。 */
export function setRelation(dip: DiplomacyState, a: string, b: string, value: number): void {
  const v = clamp(value, -100, 100);
  if (dip.kingdoms[a]) {
    dip.kingdoms[a].relations = dip.kingdoms[a].relations ?? {};
    dip.kingdoms[a].relations[b] = v;
  }
  if (dip.kingdoms[b]) {
    dip.kingdoms[b].relations = dip.kingdoms[b].relations ?? {};
    dip.kingdoms[b].relations[a] = v;
  }
}

/** 是否处于战争状态。 */
export function isAtWar(dip: DiplomacyState, a: string, b: string): boolean {
  return getRelation(dip, a, b) < WAR_THRESHOLD;
}

/**
 * 计算 A 对 B 的宣战意愿评分（越高越可能宣战）。
 *
 * 评分构成（可解释）：
 *  - 实力优势：A.strength / (A+B)，> 0.5 为正
 *  - 好战度：A.aggression
 *  - 现有敌意：关系越低越容易再开一枪
 *  - 厌战度：warWeariness 高则抑制
 *  - 多线作战：已在交战中会显著降低意愿
 *  - 帝国宿敌：帝国三省之间额外加成
 */
export function warDesire(dip: DiplomacyState, a: string, b: string): { score: number; reasons: string[] } {
  const A = dip.kingdoms[a];
  const B = dip.kingdoms[b];
  if (!A || !B) return { score: 0, reasons: ["王国不存在"] };

  const reasons: string[] = [];
  let score = 0;

  // 1. 实力优势（-1 .. +1）
  const total = Math.max(1, A.strength + B.strength);
  const advantage = A.strength / total - 0.5;
  score += advantage * 60;
  if (advantage > 0.15) reasons.push(`军力占优（${Math.round(A.strength)} vs ${Math.round(B.strength)}）`);

  // 2. 好战度（0..1 → 0..40）
  score += A.aggression * 40;
  if (A.aggression > 0.6) reasons.push("举国好战");

  // 3. 现有敌意（关系 -100..100 → +40..-20）
  const rel = getRelation(dip, a, b);
  score += (-rel / 100) * 40;
  if (rel < -30) reasons.push("积怨已深");

  // 4. 厌战抑制
  score -= A.warWeariness * 0.8;
  if (A.warWeariness > 50) reasons.push("国力疲敝，厌战");

  // 5. 多线作战惩罚
  const activeWars = countActiveWars(dip, a);
  if (activeWars > 0) {
    score -= activeWars * 25;
    reasons.push(`已身陷 ${activeWars} 场战争`);
  }

  // 6. 帝国宿敌
  if (ETERNAL_RIVALRY.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) {
    score += 20;
    reasons.push("帝国正统之争");
  }

  // 7. 领土失衡：强者对小国更贪婪
  if (A.fiefCount > B.fiefCount * 1.5 && A.fiefCount > 2) {
    score += 15;
    reasons.push("觊觎其领土");
  }

  return { score, reasons };
}

/**
 * 计算 A 对 B 的议和意愿评分（越高越可能求和）。
 */
export function peaceDesire(dip: DiplomacyState, a: string, b: string): { score: number; reasons: string[] } {
  const A = dip.kingdoms[a];
  const B = dip.kingdoms[b];
  if (!A || !B) return { score: 0, reasons: [] };

  const reasons: string[] = [];
  let score = A.warWeariness;

  if (A.warWeariness > 40) reasons.push("厌战情绪高涨");

  // 军事劣势 → 更想停战
  const total = Math.max(1, A.strength + B.strength);
  const disadvantage = 0.5 - A.strength / total;
  if (disadvantage > 0.1) {
    score += disadvantage * 80;
    reasons.push("前线失利");
  }

  // 疆域缩水 → 更想停战
  if (A.fiefCount <= 1) {
    score += 30;
    reasons.push("几乎失去全部领地");
  }

  // 多线作战 → 强烈求和
  const wars = countActiveWars(dip, a);
  if (wars > 1) {
    score += wars * 20;
    reasons.push("腹背受敌");
  }

  return { score, reasons };
}

/** 某王国当前交战中的对手数量。 */
export function countActiveWars(dip: DiplomacyState, a: string): number {
  let n = 0;
  for (const b of Object.keys(dip.kingdoms)) {
    if (b === a) continue;
    if (isAtWar(dip, a, b)) n++;
  }
  return n;
}

/** 当前所有交战配对（去重）。 */
export function activeWars(dip: DiplomacyState): [string, string][] {
  const out: [string, string][] = [];
  const ids = Object.keys(dip.kingdoms);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (isAtWar(dip, ids[i], ids[j])) out.push([ids[i], ids[j]]);
    }
  }
  return out;
}

export interface DiplomacyTickResult {
  /** 新宣战的配对 */
  declared: { attacker: string; defender: string; reasons: string[] }[];
  /** 达成和平的配对 */
  peaced: { a: string; b: string; reasons: string[] }[];
  /** 未触发但仍需推进的关系变化说明（可为空） */
  notes: string[];
}

/**
 * 推进一天的外交演化。
 *
 * @param day 当前天数
 * @param nameOf 王国 id → 显示名
 */
export function tickDiplomacy(
  dip: DiplomacyState,
  day: number,
  nameOf: (id: string) => string,
): DiplomacyTickResult {
  const result: DiplomacyTickResult = { declared: [], peaced: [], notes: [] };
  const ids = Object.keys(dip.kingdoms);
  const PEACE_COOLDOWN = 18;

  /** 是否处于停战冷却期。 */
  const justPeaced = (a: string, b: string): boolean => {
    const da = dip.kingdoms[a]?.lastPeaceDay?.[b];
    const db = dip.kingdoms[b]?.lastPeaceDay?.[a];
    const last = Math.max(da ?? -999, db ?? -999);
    return day - last < PEACE_COOLDOWN;
  };

  // 1. 战争推进：交战双方厌战度随天数累积
  for (const [a, b] of activeWars(dip)) {
    const ka = dip.kingdoms[a];
    const kb = dip.kingdoms[b];
    ka.warDays[b] = (ka.warDays[b] ?? 0) + 1;
    kb.warDays[a] = (kb.warDays[a] ?? 0) + 1;
    // 战争越久越厌战；好战国抗性更高（骑砍2：一场战争通常持续 2-4 个月）
    ka.warWeariness = clamp(ka.warWeariness + (0.7 - ka.aggression * 0.4), 0, 100);
    kb.warWeariness = clamp(kb.warWeariness + (0.7 - kb.aggression * 0.4), 0, 100);
  }

  // 2. 议和判定：双方都够厌战 → 停战
  const peacedPairs = new Set<string>();
  for (const [a, b] of activeWars(dip)) {
    const pa = peaceDesire(dip, a, b);
    const pb = peaceDesire(dip, b, a);
    // 双方都明显厌战，或一方濒临崩溃且另一方也有意愿
    const bothWilling = pa.score > 70 && pb.score > 70;
    const oneDesperate = (pa.score > 120 && pb.score > 30) || (pb.score > 120 && pa.score > 30);
    if (bothWilling || oneDesperate) {
      // 停战后关系设为带敌意（-15），保留紧张，冷却期结束后易重燃
      setRelation(dip, a, b, -15);
      dip.kingdoms[a].warDays[b] = 0;
      dip.kingdoms[b].warDays[a] = 0;
      // 记录停战日，进入冷却期
      dip.kingdoms[a].lastPeaceDay = dip.kingdoms[a].lastPeaceDay ?? {};
      dip.kingdoms[b].lastPeaceDay = dip.kingdoms[b].lastPeaceDay ?? {};
      dip.kingdoms[a].lastPeaceDay![b] = day;
      dip.kingdoms[b].lastPeaceDay![a] = day;
      // 停战后厌战度部分回落（不会清零，否则立刻又能打满）
      dip.kingdoms[a].warWeariness = clamp(dip.kingdoms[a].warWeariness - 25, 0, 100);
      dip.kingdoms[b].warWeariness = clamp(dip.kingdoms[b].warWeariness - 25, 0, 100);
      const reasons = [...new Set([...pa.reasons, ...pb.reasons])];
      result.peaced.push({ a, b, reasons });
      pushDecision(dip, day, `${nameOf(a)} 与 ${nameOf(b)} 达成停战协议（${reasons.join("；") || "双方力竭"}）。`);
      peacedPairs.add([a, b].sort().join("|"));
      continue;
    }
  }

  // 3. 宣战判定：对每个非交战组合评估
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      if (isAtWar(dip, a, b)) continue;
      // 刚停战的组合短期内不再开战（冷却 30 天）
      if (justPeaced(a, b)) continue;

      const wa = warDesire(dip, a, b);
      const wb = warDesire(dip, b, a);

      // 长期和平会积累「战争压力」：和平越久，好战国越按捺不住
      const peaceA = day - (dip.kingdoms[a].lastPeaceDay?.[b] ?? 0);
      const peaceB = day - (dip.kingdoms[b].lastPeaceDay?.[a] ?? 0);
      const pressureA = Math.min(35, peaceA * 0.25) * dip.kingdoms[a].aggression;
      const pressureB = Math.min(35, peaceB * 0.25) * dip.kingdoms[b].aggression;

      // 用日号做确定性扰动（同一存档可复现），幅度 ±10
      const noiseA = (Math.sin(day * 12.9898 + i * 78.233) * 43758.5453) % 1;
      const noiseB = (Math.sin(day * 39.346 + j * 11.135) * 24634.6345) % 1;
      const scoreA = wa.score + pressureA + Math.abs(noiseA) * 10;
      const scoreB = wb.score + pressureB + Math.abs(noiseB) * 10;

      if (scoreA > 55 && scoreA >= scoreB) {
        setRelation(dip, a, b, -45);
        dip.kingdoms[a].warWeariness = Math.max(0, dip.kingdoms[a].warWeariness - 20);
        result.declared.push({ attacker: a, defender: b, reasons: wa.reasons });
        pushDecision(dip, day, `${nameOf(a)} 向 ${nameOf(b)} 宣战！（${wa.reasons.join("；") || "扩张野心"}）`);
      } else if (scoreB > 55) {
        setRelation(dip, a, b, -45);
        dip.kingdoms[b].warWeariness = Math.max(0, dip.kingdoms[b].warWeariness - 20);
        result.declared.push({ attacker: b, defender: a, reasons: wb.reasons });
        pushDecision(dip, day, `${nameOf(b)} 向 ${nameOf(a)} 宣战！（${wb.reasons.join("；") || "扩张野心"}）`);
      }
    }
  }

  // 4. 和平时期：敌意缓慢缓和；但地缘矛盾会让关系停在 -25 附近（开战阈值 -20 之上）
  //    换句话说：和平是「脆弱的」，实力变化或事件会把它推过阈值。
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      if (isAtWar(dip, a, b)) continue;
      const rel = getRelation(dip, a, b);
      if (rel < 0) {
        const rival = ETERNAL_RIVALRY.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
        // 宿敌底线更深；普通邻居缓和到 -18
        const floor = rival ? -18 : -14;
        if (rel < floor) {
          setRelation(dip, a, b, Math.min(floor, rel + 0.3));
        } else {
          setRelation(dip, a, b, Math.max(floor, rel - 0.08));
        }
      } else if (rel > 0) {
        setRelation(dip, a, b, Math.max(0, rel - 0.05));
      }
    }
  }

  // 5. 厌战度自然衰减（和平时期每月回落）
  for (const id of ids) {
    const k = dip.kingdoms[id];
    if (countActiveWars(dip, id) === 0) {
      k.warWeariness = clamp(k.warWeariness - 0.8, 0, 100);
    }
  }

  return result;
}

function pushDecision(dip: DiplomacyState, day: number, text: string): void {
  dip.lastDecisions.push({ day, text });
  if (dip.lastDecisions.length > 60) dip.lastDecisions.splice(0, dip.lastDecisions.length - 60);
}

/** 玩家主动宣战（覆盖关系值并记录）。 */
export function playerDeclareWar(dip: DiplomacyState, kingdomId: string, day: number): void {
  const others = Object.keys(dip.kingdoms).filter((k) => k !== kingdomId);
  for (const o of others) {
    const rel = getRelation(dip, o, kingdomId);
    if (rel < WAR_THRESHOLD) continue;
    // 与目标国宣战（由调用方处理玩家与目标国的关系）
  }
  pushDecision(dip, day, `玩家向 ${kingdomId} 宣战`);
}

/** 汇总给 UI 的外部状态同步入口。 */
export function syncKingdomStats(
  dip: DiplomacyState,
  stats: Record<string, { fiefCount: number; strength: number }>,
): void {
  for (const [id, s] of Object.entries(stats)) {
    const k = dip.kingdoms[id];
    if (!k) continue;
    k.fiefCount = s.fiefCount;
    k.strength = s.strength;
  }
}

/** 简化：把外交状态压平成 engine 需要的 relations 表。 */
export function exportRelations(dip: DiplomacyState): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [id, k] of Object.entries(dip.kingdoms)) {
    out[id] = { ...k.relations };
  }
  return out;
}
