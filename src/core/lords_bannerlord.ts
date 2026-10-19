/**
 * lords_bannerlord.ts —— 骑砍2 风格的领主个人实体。
 *
 * 设计目标：让世界里不再只有抽象的"军团"和数字，而是有名字、有性格、
 * 有部队、能被打败被俘的具体人物。
 *
 * 每个领主：
 *  - 归属某个王国（八王国之一）
 *  - 有性格（决定其好战/外交倾向）
 *  - 统率一支私兵（可在大地图上移动、可被玩家击败）
 *  - 有与玩家的关系值（好感度）
 *  - 可能被俘（玩家击败后有一定概率俘虏）
 */

export type LordPersonality = "honorable" | "aggressive" | "calculating" | "generous" | "cruel" | "cautious";

export interface LordDef {
  id: string;
  name: string;
  title: string;
  kingdom: string;
  personality: LordPersonality;
  /** 统率私兵规模（1-10 档，影响初始兵力） */
  armySize: number;
  /** 是否是该国君主 */
  isRuler: boolean;
}

/** 性格对行为的影响系数。 */
export const PERSONALITY_TRAIT: Record<
  LordPersonality,
  { aggression: number; loyalty: number; honor: number; greed: number; label: string }
> = {
  honorable: { aggression: 0.5, loyalty: 0.9, honor: 0.9, greed: 0.3, label: "荣誉" },
  aggressive: { aggression: 0.9, loyalty: 0.6, honor: 0.4, greed: 0.7, label: "好战" },
  calculating: { aggression: 0.6, loyalty: 0.5, honor: 0.5, greed: 0.8, label: "精算" },
  generous: { aggression: 0.3, loyalty: 0.8, honor: 0.8, greed: 0.2, label: "慷慨" },
  cruel: { aggression: 0.8, loyalty: 0.4, honor: 0.2, greed: 0.9, label: "残暴" },
  cautious: { aggression: 0.3, loyalty: 0.7, honor: 0.6, greed: 0.4, label: "谨慎" },
};

/**
 * 八王国各 2-3 名领主（含君主），名字取自骑砍2 风格。
 */
export const LORDS_BANNERLORD: Record<string, LordDef> = {
  // ── 北帝国 ──
  lucon: { id: "lucon", name: "卢肯", title: "北帝国皇帝", kingdom: "empire_n", personality: "calculating", armySize: 9, isRuler: true },
  arganos: { id: "arganos", name: "阿加诺斯", title: "北帝国将军", kingdom: "empire_n", personality: "honorable", armySize: 6, isRuler: false },
  elena: { id: "elena", name: "艾琳娜", title: "北帝国女男爵", kingdom: "empire_n", personality: "cautious", armySize: 5, isRuler: false },

  // ── 西帝国 ──
  garios: { id: "garios", name: "加里奥斯", title: "西帝国皇帝", kingdom: "empire_w", personality: "aggressive", armySize: 9, isRuler: true },
  philon: { id: "philon", name: "菲隆", title: "西帝国元老", kingdom: "empire_w", personality: "calculating", armySize: 5, isRuler: false },

  // ── 南帝国 ──
  rhagaea: { id: "rhagaea", name: "拉盖娅", title: "南帝国女皇", kingdom: "empire_s", personality: "calculating", armySize: 9, isRuler: true },
  petra: { id: "petra", name: "佩特拉", title: "南帝国女男爵", kingdom: "empire_s", personality: "honorable", armySize: 5, isRuler: false },

  // ── 斯特吉亚 ──
  raganvad: { id: "raganvad", name: "拉甘瓦德", title: "斯特吉亚大公", kingdom: "sturgia", personality: "aggressive", armySize: 9, isRuler: true },
  ovid: { id: "ovid", name: "奥维德", title: "斯特吉亚贵族", kingdom: "sturgia", personality: "honorable", armySize: 6, isRuler: false },

  // ── 阿塞莱 ──
  unqid: { id: "unqid", name: "温基德", title: "阿塞莱苏丹", kingdom: "aserai", personality: "calculating", armySize: 9, isRuler: true },
  tais: { id: "tais", name: "泰伊斯", title: "阿塞莱埃米尔", kingdom: "aserai", personality: "generous", armySize: 6, isRuler: false },

  // ── 瓦兰迪亚 ──
  derthert: { id: "derthert", name: "德瑟特", title: "瓦兰迪亚国王", kingdom: "vlandia", personality: "calculating", armySize: 10, isRuler: true },
  ingalther: { id: "ingalther", name: "因加尔瑟", title: "瓦兰迪亚男爵", kingdom: "vlandia", personality: "aggressive", armySize: 6, isRuler: false },

  // ── 巴塔尼亚 ──
  caladog: { id: "caladog", name: "卡拉多加", title: "巴塔尼亚至高王", kingdom: "battania", personality: "aggressive", armySize: 9, isRuler: true },
  siora: { id: "siora", name: "西奥拉", title: "巴塔尼亚女族长", kingdom: "battania", personality: "cautious", armySize: 5, isRuler: false },

  // ── 库赛特 ──
  monchug: { id: "monchug", name: "蒙楚格", title: "库赛特可汗", kingdom: "khuzait", personality: "aggressive", armySize: 10, isRuler: true },
  berceg: { id: "berceg", name: "贝尔切格", title: "库赛特那颜", kingdom: "khuzait", personality: "cruel", armySize: 6, isRuler: false },
};

/** 某王国的全部领主。 */
export function lordsOfKingdom(kingdom: string): LordDef[] {
  return Object.values(LORDS_BANNERLORD).filter((l) => l.kingdom === kingdom);
}

/** 某王国的君主。 */
export function rulerOfKingdom(kingdom: string): LordDef | null {
  return Object.values(LORDS_BANNERLORD).find((l) => l.kingdom === kingdom && l.isRuler) ?? null;
}

/** 运行时领主状态（与静态定义分离，可存进存档）。 */
export interface LordState {
  /** 与玩家的好感 -100..100 */
  relationWithPlayer: number;
  /** 是否被玩家俘虏 */
  captive: boolean;
  /** 当前兵力（按兵种） */
  troops: Record<string, number>;
  /** 是否阵亡（被处决或战死） */
  dead: boolean;
  /** 被击败次数 */
  timesDefeated: number;
}

export type LordRuntime = Record<string, LordState>;
