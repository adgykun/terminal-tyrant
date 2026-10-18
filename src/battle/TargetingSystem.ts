/**
 * TargetingSystem —— 集群寻敌 + 走位（纯逻辑，无渲染）。
 *
 * 职责（每帧，且先于 MovementSystem / CombatSystem 执行）：
 *  1. 清理失效目标（阵亡 / 消失 / 变友军）；
 *  2. 无目标者锁定「最近且未满员」的敌人（侧翼补位，避免一窝蜂）；
 *  3. 朝目标移动（攻击距离内停下），由 MovementSystem 执行位移；
 *  4. 友军相互排斥，防止单位完全重叠（软性 2D 圆排斥）。
 */
import { System } from "../ecs/System";
import type { Entity } from "../ecs/Entity";
import { Position } from "./Position";
import { Velocity } from "./Velocity";
import { Team } from "./Team";
import { Health } from "./Health";
import { Attack } from "./Attack";
import { Target } from "./Target";
import { MoveSpeed } from "./MoveSpeed";
import { PlayerControl } from "./PlayerControl";

export class TargetingSystem extends System {
  /** 与友军的最小间距（排斥半径）。 */
  private static readonly SEPARATION = 0.9;
  /** 每个敌人最多同时被几个我方锁定（侧翼上限）。 */
  private static readonly MAX_LOCK = 3;
  /** z 轴向交战对齐容差（与 CombatSystem 一致）。 */
  private static readonly LOCK_TOL = 1.2;
  constructor() {
    super("TargetingSystem");
  }
  update(_dt: number): void {
    const units = this.world.query(Position, Velocity, Team, Health, Attack, Target, MoveSpeed);
    // 0. 排除玩家控制实体（玩家由 PlayerInputSystem 直接操控，AI 不寻敌/不走位/不被排斥）
    const aiUnits = units.filter((u) => !u.hasComponent(PlayerControl));
    // 1. 清理失效目标
    for (const u of aiUnits) {
      const t = u.getComponent(Target)!;
      if (t.targetId == null) continue;
      const target = this.world.getEntity(t.targetId);
      if (!target || !target.hasComponent(Health) || !target.getComponent(Health)!.alive) {
        t.targetId = null;
        continue;
      }
      if (target.getComponent(Team)!.side === u.getComponent(Team)!.side) {
        t.targetId = null;
      }
    }

    // 2. 统计当前各敌人被锁数
    const lockCount = new Map<number, number>();
    for (const u of aiUnits) {
      const t = u.getComponent(Target)!;
      if (t.targetId != null) {
        lockCount.set(t.targetId, (lockCount.get(t.targetId) ?? 0) + 1);
      }
    }
    // 3. 无目标者寻敌：最近且未满员；全满则退化为最近敌人
    for (const u of aiUnits) {
      const t = u.getComponent(Target)!;
      if (t.targetId != null) continue;
      const side = u.getComponent(Team)!.side;
      let best: Entity | null = null;
      let bestDist = Infinity;
      for (const o of units) {
        if (o.id === u.id) continue;
        if (o.getComponent(Team)!.side === side) continue;
        if (!o.getComponent(Health)!.alive) continue;
        const d = this.distSq(u, o);
        const locked = lockCount.get(o.id) ?? 0;
        if (locked < TargetingSystem.MAX_LOCK && d < bestDist) {
          best = o;
          bestDist = d;
        }
      }
      // 满员兜底：找最近敌人
      if (!best) {
        let fallbackDist = Infinity;
        for (const o of units) {
          if (o.id === u.id) continue;
          if (o.getComponent(Team)!.side === side) continue;
          if (!o.getComponent(Health)!.alive) continue;
          const d = this.distSq(u, o);
          if (d < fallbackDist) {
            best = o;
            fallbackDist = d;
          }
        }
      }
      if (best) {
        t.targetId = best.id;
        lockCount.set(best.id, (lockCount.get(best.id) ?? 0) + 1);
      }
    }

    // 4. 走位：朝目标移动，攻击距离内停下
    for (const u of aiUnits) {
      const v = u.getComponent(Velocity)!;
      const t = u.getComponent(Target)!;
      if (t.targetId == null) continue;
      const target = this.world.getEntity(t.targetId);
      if (!target) continue;
      const p = u.getComponent(Position)!;
      const tp = target.getComponent(Position)!;
      const dx = tp.x - p.x;
      const dz = tp.z - p.z;
      const atk = u.getComponent(Attack)!;
      const ms = u.getComponent(MoveSpeed)!.value;
      const inRange = Math.abs(dx) <= atk.range && Math.abs(dz) <= TargetingSystem.LOCK_TOL;
      if (inRange) {
        v.vx = 0;
        v.vz = 0;
      } else {
        const len = Math.hypot(dx, dz) || 1;
        v.vx = (dx / len) * ms;
        v.vz = (dz / len) * ms;
      }
    }

    // 5. 友军排斥（直接微移 Position，防止重叠；玩家除外，避免被 AI 挤走）
    for (let i = 0; i < aiUnits.length; i++) {
      const a = aiUnits[i];
      for (let j = i + 1; j < aiUnits.length; j++) {
        const b = aiUnits[j];
        if (a.getComponent(Team)!.side !== b.getComponent(Team)!.side) continue;
        const pa = a.getComponent(Position)!;
        const pb = b.getComponent(Position)!;
        const dx = pb.x - pa.x;
        const dz = pb.z - pa.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= TargetingSystem.SEPARATION * TargetingSystem.SEPARATION || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (TargetingSystem.SEPARATION - d) / 2;
        const ux = (dx / d) * push;
        const uz = (dz / d) * push;
        pa.x -= ux;
        pa.z -= uz;
        pb.x += ux;
        pb.z += uz;
      }
    }
  }

  private distSq(a: Entity, b: Entity): number {
    const pa = a.getComponent(Position)!;
    const pb = b.getComponent(Position)!;
    const dx = pa.x - pb.x;
    const dz = pa.z - pb.z;
    return dx * dx + dz * dz;
  }
}