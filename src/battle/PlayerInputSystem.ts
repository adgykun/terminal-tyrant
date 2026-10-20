/**
 * PlayerInputSystem —— 玩家操控（键盘 + 鼠标/空格攻击）。
 *
 * 职责（每帧，必须在 TargetingSystem 之前执行，保证玩家位移不被 AI 覆盖）：
 *  1. 从键盘 WASD / 方向键读取移动方向，写 Velocity（玩家没有 Target，AI 不走它）；
 *  2. 空格 / 鼠标左键 → 攻击指令：锁定最近敌人，出手（范围 1.5 倍、伤害 2 倍）；
 *  3. 有移动输入时把实体朝向转向移动方向（渲染朝向）。
 */
import { System } from "../ecs/System";
import type { Entity } from "../ecs/Entity";
import { Position } from "./Position";
import { Velocity } from "./Velocity";
import { Team } from "./Team";
import { Health } from "./Health";
import { Attack } from "./Attack";
import { PlayerControl } from "./PlayerControl";
import { MoveSpeed } from "./MoveSpeed";

export class PlayerInputSystem extends System {
  /** 攻击指令触发后的最短间隔（秒），避免按住鼠标连发过于变态。 */
  private static readonly INPUT_COOLDOWN = 0.45;
  /** 玩家攻击范围倍率（英雄感；武器长度已计入 Attack.range）。 */
  private static readonly RANGE_MULT = 1.15;
  /** 玩家伤害倍率（英雄感；装备/属性伤害已计入 Attack.damage）。 */
  private static readonly DAMAGE_MULT = 1.25;
  /** 玩家实体 id（由 BattleView 在生成实体时设置）。 */
  private playerId: number | null = null;
  private readonly keys = new Set<string>();
  private mouseDown = false;
  constructor() {
    super("PlayerInputSystem");
  }
  /** 注册玩家实体（BattleView 在生成玩家实体后调用）。 */
  setPlayer(entity: Entity): void {
    this.playerId = entity.id;
    this.bind();
  }
  /**
   * AI 代打开关（无头模拟 / 测试用）。
   * 开启后每帧自动对最近敌人出手，无需真实键盘输入。
   */
  autoAttack = false;
  onDetach(): void {
    this.unbind();
    this.playerId = null;
  }
  update(dt: number): void {
    if (this.playerId == null) return;
    const player = this.world.getEntity(this.playerId);
    if (!player) return;
    const pc = player.getComponent(PlayerControl);
    const vel = player.getComponent(Velocity);
    if (!pc || !vel) return;
    // 1. 读键盘 → 移动方向
    let mx = 0;
    let mz = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) mz -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) mz += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
      pc.moveX = mx;
      pc.moveZ = mz;
      pc.dirX = mx;
      pc.dirZ = mz;
      const speed = player.getComponent(MoveSpeed)?.value ?? 3.2;
      vel.vx = mx * speed;
      vel.vz = mz * speed;
    } else {
      pc.moveX = 0;
      pc.moveZ = 0;
      vel.vx = 0;
      vel.vz = 0;
    }
    // 2. 攻击指令（空格 / 鼠标左键；autoAttack 下每帧自动出手）
    pc.attackTimer = Math.max(0, pc.attackTimer - dt);
    const wantAttack = this.mouseDown || this.keys.has("Space") || this.autoAttack;
    if (wantAttack && !pc.attackPressed && pc.attackTimer <= 0) {
      pc.attackPressed = true;
      this.tryAttack(player);
    } else if (!wantAttack) {
      pc.attackPressed = false;
    }
  }
  // ===== 攻击实现 =====
  /** 锁定最近敌人并出手一次（玩家伤害/范围放大）。 */
  private tryAttack(player: Entity): void {
    const p = player.getComponent(Position)!;
    const atk = player.getComponent(Attack)!;
    const pc = player.getComponent(PlayerControl)!;
    const side = player.getComponent(Team)!.side;
    const range = atk.range * PlayerInputSystem.RANGE_MULT;
    const damage = atk.damage * PlayerInputSystem.DAMAGE_MULT;
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const o of this.world.query(Team, Health, Position)) {
      if (o.id === player.id) continue;
      if (o.getComponent(Team)!.side === side) continue;
      if (!o.getComponent(Health)!.alive) continue;
      const op = o.getComponent(Position)!;
      const d = Math.hypot(op.x - p.x, op.z - p.z);
      if (d < bestD) {
        best = o;
        bestD = d;
      }
    }
    if (!best) return;
    // 最近敌人：指向它，并判定范围
    const op = best.getComponent(Position)!;
    const dx = op.x - p.x;
    const dz = op.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    pc.dirX = dx / d;
    pc.dirZ = dz / d;
    pc.attackTimer = PlayerInputSystem.INPUT_COOLDOWN;
    pc.attackPressed = false;
    // 范围内才出手（超出范围只转向 + 开始冷却，不扣血）
    if (bestD <= range) {
      const hp = best.getComponent(Health)!;
      hp.hp -= damage;
      if (!hp.alive) this.world.destroyEntity(best);
    }
  }
  // ===== 输入绑定 =====
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Space") e.preventDefault();
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };
  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = true;
  };
  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = false;
  };
  private onBlur = (): void => {
    this.keys.clear();
    this.mouseDown = false;
  };
  private bind(): void {
    // 无 DOM 环境（无头模拟 / 测试）下跳过绑定
    if (typeof window === "undefined") return;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("blur", this.onBlur);
  }
  private unbind(): void {
    if (typeof window === "undefined") return;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("blur", this.onBlur);
  }
}