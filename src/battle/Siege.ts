/**
 * Siege.ts —— 攻城战内核。
 *
 * 骑砍2 攻城战的骨架：
 *   1. 城墙把两军隔开，进攻方无法直接接触守军；
 *   2. 守军居高临下射击，进攻方顶着伤亡砸门；
 *   3. 城门破开（breach）后，部队只能从门洞涌入，守军士气受挫；
 *   4. 门洞成为绞肉机 —— 少数人挡住多数人的通道。
 *
 * 本系统只做「空间规则 + 城门耐久 + 破门后果」，
 * 视觉上的墙体/城门由 RenderSystem.enableSiege 绘制。
 */
import { System } from "../ecs/System";
import { Position } from "./Position";
import { Team } from "./Team";
import { Health } from "./Health";
import { Morale } from "./Morale";

export interface SiegeConfig {
  /** 城门中心 x */
  gateX: number;
  /** 城墙所在 z */
  gateZ: number;
  /** 门洞半宽（世界单位） */
  gateHalfWidth: number;
  /** 城门总耐久 */
  gateHp: number;
  /** 进攻方阵营（通常 0 = 玩家） */
  attackerSide: number;
  /** 守方阵营 */
  defenderSide: number;
  /** 每个进攻单位每秒对城门造成的伤害 */
  damagePerUnitPerSec: number;
}

/** 城墙阻挡半径：进攻方最多推进到 z = gateZ + wallGap，守方退到 z = gateZ - wallGap。 */
const WALL_GAP = 2.6;
/** 破门后门洞两侧的余墙厚度（仍需从门洞通过）。 */
const BREACH_GAP = 0.6;
/** 进攻方能够攻击城门的纵深范围。 */
const GATE_REACH = 5.0;

export class SiegeSystem extends System {
  hp: number;
  readonly maxHp: number;
  breached = false;
  private cfg: SiegeConfig;
  /** 城门耐久变化回调（0..1，1 为完好）。 */
  onGateDamage?: (frac: number) => void;
  /** 破门回调（只触发一次）。 */
  onBreach?: () => void;

  constructor(cfg: SiegeConfig) {
    super("SiegeSystem");
    this.cfg = cfg;
    this.hp = cfg.gateHp;
    this.maxHp = cfg.gateHp;
  }

  /** 城门耐久比例 0..1。 */
  get gateFraction(): number {
    return this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
  }

  update(dt: number): void {
    const { gateX, gateZ, gateHalfWidth, attackerSide, defenderSide } = this.cfg;

    // ── 1. 空间规则：城墙阻挡 ──
    // 未破门：两军都无法穿越墙线。
    // 已破门：只有门洞（|x-gateX| < 门洞半宽）允许通行，其余位置仍被余墙挡住。
    for (const e of this.world.query(Position, Team)) {
      const p = e.getComponent(Position)!;
      const t = e.getComponent(Team)!;
      const isAttacker = t.side === attackerSide;
      const isDefender = t.side === defenderSide;
      if (!isAttacker && !isDefender) continue;

      const inOpening = Math.abs(p.x - gateX) < gateHalfWidth - 0.25;
      const canPass = this.breached && inOpening;
      if (canPass) continue;

      const gap = this.breached ? BREACH_GAP : WALL_GAP;
      if (isAttacker) {
        // 进攻方不得越过墙线
        const limit = gateZ + gap;
        if (p.z < limit) p.z = limit;
      } else {
        const limit = gateZ - gap;
        if (p.z > limit) p.z = limit;
      }
    }

    if (this.breached) return;

    // ── 2. 砸门：贴近城门的进攻单位累积伤害 ──
    let attackers = 0;
    for (const e of this.world.query(Position, Team, Health)) {
      const t = e.getComponent(Team)!;
      if (t.side !== attackerSide) continue;
      const h = e.getComponent(Health)!;
      if (!h.alive) continue;
      const p = e.getComponent(Position)!;
      const nearX = Math.abs(p.x - gateX) < gateHalfWidth + 1.5;
      const nearZ = p.z > gateZ && p.z < gateZ + GATE_REACH;
      if (nearX && nearZ) attackers++;
    }

    if (attackers > 0) {
      this.hp -= attackers * this.cfg.damagePerUnitPerSec * dt;
      this.onGateDamage?.(this.gateFraction);
      if (this.hp <= 0) {
        this.hp = 0;
        if (!this.breached) {
          this.breached = true;
          // ── 3. 破门后果：守军士气受挫 ──
          for (const e of this.world.query(Team, Morale)) {
            const t = e.getComponent(Team)!;
            if (t.side !== defenderSide) continue;
            const m = e.getComponent(Morale)!;
            m.value = Math.max(0, m.value - 22);
          }
          this.onBreach?.();
        }
      }
    }
  }
}

/** 攻城战默认参数（供 BattleView 与引擎共用，保证一致）。 */
export const SIEGE_LAYOUT = {
  gateX: 0,
  gateZ: -12,
  gateHalfWidth: 3.2,
  wallHalfWidth: 20,
} as const;
