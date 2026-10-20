/**
 * player_combat.ts —— 玩家战斗属性内核。
 *
 * 让「角色成长」真正可感知：3D 战场里玩家英雄的血量/攻击/射程/移速
 * 不再硬编码，而是由 属性 + 装备 + 技能 推导。
 *
 * 骑砍2 的成长思路：
 *   - 力量 → 血量与近战伤害；
 *   - 智力 → 指挥相关（此处简化为远程命中加成）；
 *   - 魅力 → 士气光环（影响友军溃逃阈值）；
 *   - 武器 → 伤害与攻击距离；
 *   - 护甲 → 减伤比例；
 *   - 战马 → 移速与冲锋伤害。
 */
import { EQUIPMENT } from "./data";

/** 玩家战斗属性快照。 */
export interface PlayerCombatStats {
  /** 血量。 */
  hp: number;
  /** 单次伤害。 */
  damage: number;
  /** 攻击距离（近战武器长度）。 */
  range: number;
  /** 攻击间隔（秒）。 */
  cooldown: number;
  /** 移速（世界单位/秒）。 */
  speed: number;
  /** 被命中时的减伤比例（0-0.6）。 */
  damageReduction: number;
  /** 是否远程攻击（装备弓时）。 */
  ranged: boolean;
  /** 士气光环：友军崩溃阈值的变化量。 */
  moraleAura: number;
  /** 战力（用于 AI 评估与结算）。 */
  power: number;
  /** 战斗日志（供 UI 展示推导结果）。 */
  breakdown: string[];
}

/** 空快照。 */
function emptyStats(): PlayerCombatStats {
  return {
    hp: 200, damage: 12, range: 1.5, cooldown: 0.9, speed: 4.0,
    damageReduction: 0, ranged: false, moraleAura: 0, power: 10,
    breakdown: [],
  };
}

/** 装备槽 → 效果键。 */
const WEAPON_RANGE: Record<string, number> = {
  w1: 1.8,  // 铁剑
  w2: 2.4,  // 方天画戟（长兵器）
};

/**
 * 从角色状态推导战斗属性。
 *
 * @param attrs   属性（力量/智力/魅力，默认 5）
 * @param equip   装备槽位 → 装备 id
 * @param opts    额外修正（技能加成等）
 */
export function derivePlayerCombat(
  attrs: { strength?: number; intellect?: number; charm?: number } = {},
  equip: Record<string, string> = {},
  opts: { meleeSkill?: number; rangedSkill?: number; athletics?: number } = {},
): PlayerCombatStats {
  const s = emptyStats();
  const breakdown: string[] = [];

  const str = attrs.strength ?? 5;
  const int = attrs.intellect ?? 5;
  const cha = attrs.charm ?? 5;

  // ── 1. 属性基础值 ──
  s.hp = 120 + str * 18;                       // 力量 → 血量
  s.damage = 8 + str * 1.6;                    // 力量 → 近战伤害
  s.speed = 3.6 + str * 0.06;                  // 力量微幅影响移速
  breakdown.push(`力量 ${str}：血量 ${s.hp}，伤害 ${s.damage.toFixed(1)}`);

  // 智力 → 远程加成
  if (opts.rangedSkill) {
    s.damage += int * 0.4;
    breakdown.push(`智力 ${int} + 远程技能 ${opts.rangedSkill}：伤害 +${(int * 0.4).toFixed(1)}`);
  }
  // 田径 → 移速
  if (opts.athletics) {
    s.speed += opts.athletics * 0.05;
    breakdown.push(`田径 ${opts.athletics}：移速 +${(opts.athletics * 0.05).toFixed(2)}`);
  }
  // 魅力 → 士气光环
  s.moraleAura = Math.round((cha - 5) * 1.5);
  if (s.moraleAura !== 0) {
    breakdown.push(`魅力 ${cha}：士气光环 ${s.moraleAura > 0 ? "+" : ""}${s.moraleAura}`);
  }

  // ── 2. 武器 ──
  const weaponId = equip.weapon;
  if (weaponId && EQUIPMENT[weaponId]) {
    const w = EQUIPMENT[weaponId] as any;
    const pb = w.power_bonus ?? 0;
    s.damage += pb * 0.8;
    const wRange = WEAPON_RANGE[weaponId] ?? 1.6;
    s.range = wRange;
    breakdown.push(`武器 ${w.name}：伤害 +${(pb * 0.8).toFixed(1)}，攻击距离 ${wRange}`);
  }

  // ── 3. 护甲（减伤）──
  const armorId = equip.armor;
  if (armorId && EQUIPMENT[armorId]) {
    const a = EQUIPMENT[armorId] as any;
    const pb = a.power_bonus ?? 0;
    // 每点战力加成 = 2% 减伤，上限 50%
    s.damageReduction = Math.min(0.5, pb * 0.02);
    breakdown.push(`护甲 ${a.name}：减伤 ${Math.round(s.damageReduction * 100)}%`);
  }

  // ── 4. 战马（移速 + 冲锋伤害）──
  const horseId = equip.horse;
  if (horseId && EQUIPMENT[horseId]) {
    const h = EQUIPMENT[horseId] as any;
    const pb = h.power_bonus ?? 0;
    s.speed += 1.4 + pb * 0.04;
    s.damage += pb * 0.3;   // 冲锋加成
    s.range = Math.max(s.range, 2.0);
    breakdown.push(`战马 ${h.name}：移速 +${(1.4 + pb * 0.04).toFixed(2)}，冲锋伤害 +${(pb * 0.3).toFixed(1)}`);
  }

  // ── 5. 服饰 ──
  const clothId = equip.clothing;
  if (clothId && EQUIPMENT[clothId]) {
    const c = EQUIPMENT[clothId] as any;
    s.moraleAura += Math.round((c.appearance_bonus ?? 0) * 0.2);
    breakdown.push(`服饰 ${c.name}：士气光环 +${Math.round((c.appearance_bonus ?? 0) * 0.2)}`);
  }

  // ── 6. 战力汇总（AI 评估与文本战斗共用）──
  s.power = Math.round(s.hp * 0.12 + s.damage * 2.2 + s.speed * 1.5 + (s.damageReduction * 60));
  s.breakdown = breakdown;
  return s;
}

/** 应用减伤到一次伤害。 */
export function applyReduction(damage: number, reduction: number): number {
  return Math.max(1, Math.round(damage * (1 - Math.max(0, Math.min(0.6, reduction)))));
}

/** 玩家是否骑乘（影响 AI 对其的判定）。 */
export function isMounted(equip: Record<string, string>): boolean {
  return !!(equip.horse && EQUIPMENT[equip.horse]);
}
