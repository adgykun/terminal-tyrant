/**
 * MovementSystem —— 按 Velocity 推进 Position（纯逻辑，无渲染）。
 */
import { System } from "../ecs/System";
import { Position } from "./Position";
import { Velocity } from "./Velocity";

export class MovementSystem extends System {
  constructor() {
    super("MovementSystem");
  }

  update(dt: number): void {
    for (const e of this.world.query(Position, Velocity)) {
      const p = e.getComponent(Position)!;
      const v = e.getComponent(Velocity)!;
      p.x += v.vx * dt;
      p.y += v.vy * dt;
      p.z += v.vz * dt;
    }
  }
}