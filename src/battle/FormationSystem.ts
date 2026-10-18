/**
 * FormationSystem —— 阵型排布（纯逻辑，无渲染）。
 * 每帧先于 TargetingSystem / MovementSystem 执行。
 */
import { System } from "../ecs/System";
import { Formation, type FormationType } from "./Formation";
import { Position } from "./Position";
import { Velocity } from "./Velocity";
import { MoveSpeed } from "./MoveSpeed";

export class FormationSystem extends System {
  private static readonly SPACING = 1.5;
  private static readonly ARRIVE = 0.15;

  constructor() {
    super("FormationSystem");
  }

  update(_dt: number): void {
    const units = this.world.query(Formation, Position, Velocity, MoveSpeed);
    if (units.length === 0) return;
    const sorted = [...units].sort((a, b) => a.id - b.id);
    const type = sorted[0].getComponent(Formation)!.type;
    const slots = this.computeSlots(type, sorted.length);
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      const f = e.getComponent(Formation)!;
      const p = e.getComponent(Position)!;
      const v = e.getComponent(Velocity)!;
      const speed = e.getComponent(MoveSpeed)!.value;
      switch (f.mode) {
        case "charge":
          break;
        case "hold":
          v.vx = 0;
          v.vz = 0;
          break;
        case "retreat": {
          const cos = Math.cos(f.angle);
          const sin = Math.sin(f.angle);
          v.vx = -cos * speed;
          v.vz = -sin * speed;
          break;
        }
        default: {
          const [sx, sz] = slots[i];
          const cos = Math.cos(f.angle);
          const sin = Math.sin(f.angle);
          const tx = f.anchorX + sx * cos - sz * sin;
          const tz = f.anchorZ + sx * sin + sz * cos;
          const dx = tx - p.x;
          const dz = tz - p.z;
          const d = Math.hypot(dx, dz);
          if (d < FormationSystem.ARRIVE) {
            v.vx = 0;
            v.vz = 0;
            p.x = tx;
            p.z = tz;
          } else {
            v.vx = (dx / d) * speed;
            v.vz = (dz / d) * speed;
          }
          break;
        }
      }
    }
  }

  private computeSlots(type: FormationType, n: number): Array<[number, number]> {
    const sp = FormationSystem.SPACING;
    const out: Array<[number, number]> = [];
    if (n <= 0) return out;
    switch (type) {
      case "line":
        for (let i = 0; i < n; i++) out.push([(i - (n - 1) / 2) * sp, 0]);
        break;
      case "wedge":
        for (let i = 0; i < n; i++) {
          let row = 0;
          while (((row + 1) * (row + 2)) / 2 <= i) row++;
          const inRow = i - (row * (row + 1)) / 2;
          out.push([row * sp * 0.9, (inRow - row / 2) * sp]);
        }
        break;
      case "circle": {
        const r = Math.max(1.5, (n * sp) / (2 * Math.PI));
        for (let i = 0; i < n; i++) {
          const a = (2 * Math.PI * i) / n;
          out.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        break;
      }
      case "column":
        for (let i = 0; i < n; i++) out.push([0, (i - (n - 1) / 2) * sp]);
        break;
      default:
        for (let i = 0; i < n; i++) {
          const col = i % 5;
          const row = Math.floor(i / 5);
          const jx = this.hash(i * 2 + 1) * 0.6;
          const jz = this.hash(i * 2 + 2) * 0.6;
          out.push([(col - 2) * sp * 0.8 + jx, (row - 1) * sp * 0.8 + jz]);
        }
        break;
    }
    return out;
  }

  private hash(seed: number): number {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
}