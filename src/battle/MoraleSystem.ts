/**
 * MoraleSystem —— 士气演化与溃逃（纯逻辑，无渲染）。
 *
 * 规则（骑砍式士气机制）：
 *  1. 双方人数优势/劣势影响士气：己方减员越多士气掉得越快，
 *     敌方濒临崩溃时己方士气回升；
 *  2. 士气跌破 breakPoint 的非英雄单位进入溃逃（isRouting），
 *     并计算远离最近敌军的溃逃方向；
 *  3. 溃逃单位远离敌人 15 单位以外时缓慢重整，士气回升到 40 解除溃逃。
 *
 * 执行顺序：targeting → movement → combat → morale → render
 * （放在 combat 之后，才能统计到本帧阵亡造成的人数变化）
 */
import { System } from "../ecs/System";
import type { Entity } from "../ecs/Entity";
import { Morale } from "./Morale";
import { Team } from "./Team";
import { Position } from "./Position";
import { Health } from "./Health";

export class MoraleSystem extends System {
  /** 溃逃后重整所需的安全距离（无敌人靠近的半径）。 */
  private static readonly RALLY_RADIUS = 15;
  /** 溃逃中士气回升到该值即解除溃逃。 */
  private static readonly RALLY_THRESHOLD = 40;
  /** 重整时每秒恢复的士气。 */
  private static readonly RALLY_RECOVER = 5;

  /** 双方初始人数（首次 update 记录，之后不再变化）。 */
  private initialCount: [number, number] | null = null;

  constructor() {
    super("MoraleSystem");
  }

  update(dt: number): void {
    // 查询同时拥有 Morale / Team / Position 的单位；Health 可选（有则参与存活统计）
    const units = this.world.query(Morale, Team, Position);
    if (units.length === 0) return;

    // 统计双方存活人数
    let playerAlive = 0;
    let enemyAlive = 0;
    for (const u of units) {
      const hp = u.getComponent(Health);
      if (hp && !hp.alive) continue;
      const side = u.getComponent(Team)!.side;
      if (side === 0) playerAlive++;
      else enemyAlive++;
    }

    // 记录初始人数（只记一次）
    if (!this.initialCount) {
      this.initialCount = [Math.max(1, playerAlive), Math.max(1, enemyAlive)];
    }
    const [initPlayer, initEnemy] = this.initialCount;

    const playerRatio = playerAlive / initPlayer;
    const enemyRatio = enemyAlive / initEnemy;

    for (const u of units) {
      const morale = u.getComponent(Morale)!;
      const hp = u.getComponent(Health);
      if (hp && !hp.alive) continue;

      const side = u.getComponent(Team)!.side;
      const myRatio = side === 0 ? playerRatio : enemyRatio;
      const foeRatio = side === 0 ? enemyRatio : playerRatio;

      if (!morale.isHero) {
        // 己方减员惩罚
        if (myRatio < 0.1) {
          morale.value -= 15 * dt;
        } else if (myRatio < 0.3) {
          morale.value -= 5 * dt;
        }
        // 敌方濒临崩溃 → 己方士气回升
        if (foeRatio < 0.3) {
          morale.value += 3 * dt;
        }
      }

      // 溃逃中：远离敌人则重整
      if (morale.isRouting) {
        const nearestDist = this.nearestEnemyDist(u, units);
        if (nearestDist > MoraleSystem.RALLY_RADIUS) {
          morale.value += MoraleSystem.RALLY_RECOVER * dt;
          if (morale.value >= MoraleSystem.RALLY_THRESHOLD) {
            morale.isRouting = false;
            morale.routeDirX = 0;
            morale.routeDirZ = 0;
          }
        }
        // 溃逃中士气仍可能因持续减员而继续下降，这里只保证不跌破 0
        morale.value = clamp(morale.value, 0, 100);
        continue;
      }

      // 钳制
      morale.value = clamp(morale.value, 0, 100);

      // 触发溃逃：士气跌破崩溃阈值且非英雄
      if (morale.value <= morale.breakPoint && !morale.isHero) {
        morale.isRouting = true;
        const dir = this.computeRouteDir(u, units);
        morale.routeDirX = dir.x;
        morale.routeDirZ = dir.z;
      }
    }
  }

  /** 计算溃逃方向：远离最近敌军；无敌人时远离地图中心。 */
  private computeRouteDir(u: Entity, units: Entity[]): { x: number; z: number } {
    const side = u.getComponent(Team)!.side;
    const p = u.getComponent(Position)!;
    let nearest: Entity | null = null;
    let bestD2 = Infinity;
    for (const o of units) {
      if (o.id === u.id) continue;
      if (o.getComponent(Team)!.side === side) continue;
      const hp = o.getComponent(Health);
      if (hp && !hp.alive) continue;
      const op = o.getComponent(Position)!;
      const dx = p.x - op.x;
      const dz = p.z - op.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        nearest = o;
      }
    }
    if (nearest) {
      const op = nearest.getComponent(Position)!;
      const dx = p.x - op.x;
      const dz = p.z - op.z;
      const len = Math.hypot(dx, dz) || 1;
      return { x: dx / len, z: dz / len };
    }
    // 无敌人：远离地图中心
    const len = Math.hypot(p.x, p.z) || 1;
    return { x: p.x / len, z: p.z / len };
  }

  /** 到最近敌人的距离；无敌人返回 Infinity。 */
  private nearestEnemyDist(u: Entity, units: Entity[]): number {
    const side = u.getComponent(Team)!.side;
    const p = u.getComponent(Position)!;
    let best = Infinity;
    for (const o of units) {
      if (o.getComponent(Team)!.side === side) continue;
      const hp = o.getComponent(Health);
      if (hp && !hp.alive) continue;
      const op = o.getComponent(Position)!;
      const d = Math.hypot(op.x - p.x, op.z - p.z);
      if (d < best) best = d;
    }
    return best;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
