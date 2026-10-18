/**
 * CommandSystem —— 全军指挥（键盘指令 + 锚点/朝向维护）。
 * 每帧先于 FormationSystem / TargetingSystem 执行。
 */
import { System } from "../ecs/System";
import type { Entity } from "../ecs/Entity";
import { Formation, type FormationType, type CommandMode } from "./Formation";
import { Team } from "./Team";
import { Position } from "./Position";
import { PlayerControl } from "./PlayerControl";

export interface CommandState {
  type: FormationType;
  mode: CommandMode;
}

export class CommandSystem extends System {
  private playerId: number | null = null;
  private formationType: FormationType = "line";
  onChange: ((state: CommandState) => void) | null = null;

  constructor() {
    super("CommandSystem");
  }

  setPlayer(entity: Entity): void {
    this.playerId = entity.id;
    this.bind();
  }

  onDetach(): void {
    this.unbind();
    this.playerId = null;
  }

  update(_dt: number): void {
    const player = this.playerId != null ? this.world.getEntity(this.playerId) : undefined;
    const playerPos = player?.getComponent(Position);
    if (!playerPos) return;
    // 敌方质心（阵型朝向）
    let ex = 0;
    let ez = 0;
    let ec = 0;
    for (const o of this.world.query(Team, Position)) {
      if (o.getComponent(Team)!.side !== 1) continue;
      const p = o.getComponent(Position)!;
      ex += p.x;
      ez += p.z;
      ec++;
    }
    let angle = 0;
    if (ec > 0) {
      ex /= ec;
      ez /= ec;
      angle = Math.atan2(ez - playerPos.z, ex - playerPos.x);
    }
    for (const e of this.world.query(Formation, Team)) {
      if (e.getComponent(Team)!.side !== 0) continue;
      const f = e.getComponent(Formation)!;
      f.anchorX = playerPos.x;
      f.anchorZ = playerPos.z;
      f.angle = angle;
    }
  }

  private setType(type: FormationType): void {
    this.formationType = type;
    this.apply((f) => {
      f.type = type;
      if (f.mode === "charge" || f.mode === "retreat") f.mode = "formation";
    });
  }

  private setMode(mode: CommandMode): void {
    this.apply((f) => {
      f.mode = mode;
    });
  }

  private apply(fn: (f: Formation) => void): void {
    for (const e of this.world.query(Formation, Team)) {
      if (e.getComponent(Team)!.side !== 0) continue;
      fn(e.getComponent(Formation)!);
    }
    this.onChange?.({ type: this.formationType, mode: this.currentMode() });
  }

  private currentMode(): CommandMode {
    let m: CommandMode = "formation";
    for (const e of this.world.query(Formation)) {
      const f = e.getComponent(Formation)!;
      if (f.mode !== "formation") {
        m = f.mode;
        break;
      }
    }
    return m;
  }

  // ===== 键盘 =====
  private onKeyDown = (e: KeyboardEvent): void => {
    const map: Record<string, FormationType> = {
      Digit1: "line",
      Digit2: "wedge",
      Digit3: "circle",
      Digit4: "column",
      Digit5: "loose",
    };
    const f = map[e.code];
    if (f) {
      e.preventDefault();
      this.setType(f);
      return;
    }
    if (e.code === "KeyF") {
      e.preventDefault();
      this.setMode("charge");
    } else if (e.code === "KeyH") {
      e.preventDefault();
      this.setMode("hold");
    } else if (e.code === "KeyR") {
      e.preventDefault();
      this.setMode("retreat");
    }
  };

  private bind(): void {
    window.addEventListener("keydown", this.onKeyDown);
  }

  private unbind(): void {
    window.removeEventListener("keydown", this.onKeyDown);
  }
}
