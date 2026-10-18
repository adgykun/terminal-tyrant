/**
 * CombatSystem —— 接触交战（纯逻辑，无渲染）。
 *
 * 规则：
 *  - 仅对 Target 锁定的敌人交战（锁由 TargetingSystem 维护）；
 *  - 冷却完毕出手一次，扣目标 Health；
 *  - 血量归零的实体从 World 移除（RenderSystem 会自动销毁其 Mesh）。
 */
import { System } from "../ecs/System";
import type { Entity } from "../ecs/Entity";
import { Team } from "./Team";
import { Health } from "./Health";
import { Attack } from "./Attack";
import { Target } from "./Target";
import { Position } from "./Position";

export class CombatSystem extends System {
  /** z 轴向的接触判定宽度。 */
  private static readonly Z_TOLERANCE = 1.2;

  constructor() {
    super("CombatSystem");
  }

  update(dt: number): void {
    const units = this.world.query(Position, Team, Health, Attack, Target);
    const dead = new Set<number>();

    // 1. 推进全体冷却
    for (const e of units) {
      const atk = e.getComponent(Attack)!;
      atk.timer = Math.max(0, atk.timer - dt);
    }

    // 2. 对锁定目标交战
    for (const a of units) {
      if (dead.has(a.id)) continue;
      const t = a.getComponent(Target)!;
      if (t.targetId == null) continue;
      const b = this.world.getEntity(t.targetId);
      if (!b) continue;
      if (dead.has(b.id)) continue;
      if (a.getComponent(Team)!.side === b.getComponent(Team)!.side) continue;
      if (!this.inContact(a, b)) continue;

      // 双方各判定一次出手
      if (this.tryAttack(a, b)) dead.add(b.id);
      if (this.tryAttack(b, a) && !dead.has(a.id)) dead.add(a.id);
    }

    // 3. 移除阵亡实体
    for (const e of units) {
      if (dead.has(e.id)) this.world.destroyEntity(e);
    }
  }

  /** 距离判定：x 在攻击范围内、z 在容忍宽度内 → 视为接触。 */
  private inContact(a: Entity, b: Entity): boolean {
    const pa = a.getComponent(Position)!;
    const pb = b.getComponent(Position)!;
    const dx = Math.abs(pa.x - pb.x);
    const dz = Math.abs(pa.z - pb.z);
    const range = a.getComponent(Attack)!.range;
    return dx <= range && dz <= CombatSystem.Z_TOLERANCE;
  }

  /** 出手：冷却完毕则扣血；返回目标是否因此阵亡。 */
  private tryAttack(attacker: Entity, target: Entity): boolean {
    const atk = attacker.getComponent(Attack)!;
    if (atk.timer > 0) return false;
    const hp = target.getComponent(Health)!;
    hp.hp -= atk.damage;
    atk.timer = atk.cooldown;
    return !hp.alive;
  }
}