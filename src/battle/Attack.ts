/**
 * Attack —— 攻击数据组件（纯数据）。
 * timer 由 CombatSystem 递减并用于出手判定。
 */
import { Component } from "../ecs/Component";

export class Attack extends Component {
  /** 单次伤害。 */
  damage: number;
  /** 接触判定距离（近战为 x 轴向；远程为欧氏距离）。 */
  range: number;
  /** 攻击间隔（秒）。 */
  cooldown: number;
  /** 当前冷却计时（由 System 维护）。 */
  timer: number;
  /** 是否为远程攻击（弓弩）：按欧氏距离判定，并在射程内保持距离。 */
  ranged: boolean;

  constructor(damage = 10, range = 1.2, cooldown = 1.0, ranged = false) {
    super();
    this.damage = damage;
    this.range = range;
    this.cooldown = cooldown;
    this.timer = 0;
    this.ranged = ranged;
  }
}