/**
 * army_composition.ts —— 军队构成分析内核。
 *
 * 骑砍2 的部队面板核心不是「列表」，而是「构成分析」：
 *   - 步兵/弓手/骑兵的比例（决定战术选择）；
 *   - 文化构成（混编不同文化有士气惩罚）；
 *   - 平均等级与精锐比例；
 *   - 粮食消耗 vs 士气趋势。
 *
 * 本模块从 state.troops 推导这些指标，并在部队构成不合理时给出警告
 * （例如「全是新兵，接战即溃」「无远程，将被放风筝」）。
 */
import { UNITS } from "./data";
import { BANNERLORD_TROOPS } from "./troops_bannerlord";

/** 兵种角色分类。 */
export type TroopRole = "infantry" | "ranged" | "cavalry" | "unknown";

/** 按兵种 id 判定角色（骑砍2 兵种命名可判）。 */
export function troopRole(unitId: string): TroopRole {
  const id = unitId.toLowerCase();
  const info = (BANNERLORD_TROOPS as any)[unitId];
  // 优先用兵种表的 group 字段（Infantry / Ranged / Cavalry / HorseArcher）
  const g = String(info?.group ?? "").toLowerCase();
  if (g) {
    if (/cavalry|horse/.test(g)) return "cavalry";
    if (/ranged|archer|bow|crossbow/.test(g)) return "ranged";
    if (/infantry|foot|melee/.test(g)) return "infantry";
  }
  // 回退到命名规则
  if (/cavalry|horseman|raider|lancer|mounted|knight|vanguard|palatine|cataphract|bucellarii/.test(id)) return "cavalry";
  if (/archer|crossbow|bowman|skirmisher|woodsman|woodrunner|fian/.test(id)) return "ranged";
  if (/infantry|footman|spearman|man_at_arms|legionary|veteran|recruit|warrior|tribesman/.test(id)) return "infantry";
  return "unknown";
}

/** 兵种所属文化（从 BANNERLORD_TROOPS 的 culture 字段推断）。 */
export function troopCulture(unitId: string): string {
  const info = (BANNERLORD_TROOPS as any)[unitId];
  return String(info?.culture ?? "unknown");
}

/** 军队构成快照。 */
export interface ArmyComposition {
  total: number;
  /** 各角色人数。 */
  byRole: Record<TroopRole, number>;
  /** 各角色占比（0-1）。 */
  roleRatio: Record<TroopRole, number>;
  /** 各文化人数。 */
  byCulture: Record<string, number>;
  /** 文化数（>1 即混编）。 */
  cultureCount: number;
  /** 平均战力。 */
  avgPower: number;
  /** 最低单兵战力（衡量新兵比例）。 */
  minPower: number;
  /** 最高单兵战力。 */
  maxPower: number;
  /** 每日粮耗。 */
  foodPerDay: number;
  /** 士气修正（混编/无远程/全是新兵 等负面因素）。 */
  moraleModifier: number;
  /** 部队质量警告（空数组 = 无问题）。 */
  warnings: string[];
}

/** 空构成。 */
function emptyComposition(): ArmyComposition {
  return {
    total: 0,
    byRole: { infantry: 0, ranged: 0, cavalry: 0, unknown: 0 },
    roleRatio: { infantry: 0, ranged: 0, cavalry: 0, unknown: 0 },
    byCulture: {},
    cultureCount: 0,
    avgPower: 0,
    minPower: 0,
    maxPower: 0,
    foodPerDay: 0,
    moraleModifier: 0,
    warnings: [],
  };
}

/** 分析一支部队的构成。 */
export function analyzeArmy(troops: Record<string, number>): ArmyComposition {
  const c = emptyComposition();
  let powerSum = 0;
  let minP = Infinity;
  let maxP = 0;

  for (const [uid, cntRaw] of Object.entries(troops ?? {})) {
    const cnt = Number(cntRaw) || 0;
    if (cnt <= 0) continue;
    c.total += cnt;

    const role = troopRole(uid);
    c.byRole[role] += cnt;

    const culture = troopCulture(uid);
    c.byCulture[culture] = (c.byCulture[culture] ?? 0) + cnt;

    const power = unitPower(uid);
    powerSum += power * cnt;
    minP = Math.min(minP, power);
    maxP = Math.max(maxP, power);

    const food = unitFood(uid);
    c.foodPerDay += food * cnt;
  }

  if (c.total === 0) return c;

  for (const r of ["infantry", "ranged", "cavalry", "unknown"] as TroopRole[]) {
    c.roleRatio[r] = c.byRole[r] / c.total;
  }
  c.cultureCount = Object.keys(c.byCulture).length;
  c.avgPower = powerSum / c.total;
  c.minPower = minP === Infinity ? 0 : minP;
  c.maxPower = maxP;

  // ── 士气修正与警告 ──
  const warnings: string[] = [];
  let morale = 0;

  // 1. 精锐度：结合「绝对战力水平」与「内部落差」
  //    骑砍2 战力跨度 4~40。平均战力低 → 新兵部队；内部落差大 → 精锐与新兵混杂。
  if (c.avgPower < 8) {
    morale -= 10;
    warnings.push("部队几乎全是新兵，一旦接战极易溃逃。");
  } else if (c.minPower < c.avgPower * 0.4) {
    warnings.push("精锐与新兵混杂，前排需以老兵掩护。");
  }

  // 2. 无远程 → 会被放风筝
  if (c.byRole.ranged === 0) {
    morale -= 5;
    warnings.push("部队没有任何远程兵，将被动挨打。");
  }
  // 3. 无近战 → 一旦被近身即崩
  if (c.byRole.infantry === 0 && c.byRole.cavalry === 0) {
    morale -= 8;
    warnings.push("没有近战部队，弓手被近身即遭屠戮。");
  }
  // 4. 纯远程（无掩护）
  if (c.byRole.ranged > 0 && c.byRole.infantry === 0 && c.byRole.cavalry === 0) {
    warnings.push("纯远程部队缺乏掩护，建议配属步兵。");
  }
  // 5. 混编多文化 → 士气惩罚
  if (c.cultureCount > 2) {
    morale -= (c.cultureCount - 2) * 3;
    warnings.push(`混编 ${c.cultureCount} 种文化的士兵，彼此语言不通，士气受损。`);
  }
  // 6. 骑兵占比过高 → 粮耗与维护压力
  if (c.roleRatio.cavalry > 0.6 && c.total > 10) {
    warnings.push("骑兵占比过高，粮耗与军费吃紧。");
  }

  c.moraleModifier = morale;
  c.warnings = warnings;
  return c;
}

/** 取单兵战力（优先骑砍2 表）。 */
function unitPower(uid: string): number {
  const a = (BANNERLORD_TROOPS as any)[uid]?.power;
  if (typeof a === "number") return a;
  const b = (UNITS as any)[uid]?.power;
  return typeof b === "number" ? b : 1;
}

/** 取单兵粮耗。 */
function unitFood(uid: string): number {
  const a = (BANNERLORD_TROOPS as any)[uid]?.food_consumption;
  if (typeof a === "number") return a;
  const b = (UNITS as any)[uid]?.food_consumption;
  return typeof b === "number" ? b : 0.5;
}

/** 部队是否能「养活」（粮耗 <= 携带粮食可支撑天数）。 */
export function foodSustainability(comp: ArmyComposition, food: number): { days: number; sustainable: boolean } {
  if (comp.foodPerDay <= 0) return { days: Infinity, sustainable: true };
  const days = food / comp.foodPerDay;
  return { days, sustainable: days >= 3 };
}

/** 角色中文名。 */
export const ROLE_NAMES: Record<TroopRole, string> = {
  infantry: "步兵",
  ranged: "弓手",
  cavalry: "骑兵",
  unknown: "其他",
};

/** 文化中文名。 */
export const CULTURE_NAMES: Record<string, string> = {
  empire: "帝国",
  vlandia: "瓦兰迪亚",
  aserai: "阿塞莱",
  battania: "巴塔尼亚",
  khuzait: "库赛特",
  sturgia: "斯特吉亚",
  unknown: "未知",
};

/** 战力 → 等级描述（按骑砍2 战力尺度 4~40）。 */
export function powerTier(power: number): { name: string; color: string } {
  if (power >= 30) return { name: "史诗", color: "#d9a441" };
  if (power >= 22) return { name: "精锐", color: "#a855f7" };
  if (power >= 15) return { name: "老兵", color: "#5b9bd5" };
  if (power >= 8) return { name: "正规", color: "#5cb85c" };
  return { name: "新兵", color: "#999" };
}
