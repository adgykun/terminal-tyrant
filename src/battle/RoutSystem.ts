/**
 * RoutSystem —— 溃逃位移（纯逻辑，无渲染）。
 *
 * 职责：把正在溃逃（Morale.isRouting）的单位沿 Morale.routeDir 推出战场。
 * 与 TargetingSystem 的走位互斥：溃逃单位由本系统接管 Velocity，
 * 不再由 TargetingSystem 驱动，因此执行顺序必须在 morale 之后、movement 之前。
 */
import { System } from "../ecs/System";
import { Morale } from "./Morale";
import { Velocity } from "./Velocity";
import { MoveSpeed } from "./MoveSpeed";

export class RoutSystem extends System {
  /** 溃逃速度 = 基础移速 × 该倍率（惊慌中跑得比平时快）。 */
  private static readonly ROUT_SPEED_MULT = 1.35;

  constructor() {
    super("RoutSystem");
  }

  update(_dt: number): void {
    for (const e of this.world.query(Morale, Velocity)) {
      const morale = e.getComponent(Morale)!;
      const v = e.getComponent(Velocity)!;
      if (!morale.isRouting) continue;
      const ms = e.getComponent(MoveSpeed)?.value ?? 2.5;
      const speed = ms * RoutSystem.ROUT_SPEED_MULT;
      const len = Math.hypot(morale.routeDirX, morale.routeDirZ);
      if (len < 1e-6) {
        // 无有效方向时原地不动，交由 MoraleSystem 重整
        v.vx = 0;
        v.vz = 0;
        continue;
      }
      v.vx = (morale.routeDirX / len) * speed;
      v.vz = (morale.routeDirZ / len) * speed;
    }
  }
}
