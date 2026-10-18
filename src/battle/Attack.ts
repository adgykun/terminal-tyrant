/**
 * Attack —— 攻击数据组件（纯数据）。
 * timer 由 CombatSystem 递减并用于出手判定。
 */
import { Component } from "../ecs/Component";

export class Attack extends Component {
  /** 单次伤害。 */
  damage: number;
  /** x 轴向接触判定距离。 */
  range: number;
  /** 攻击间隔（秒）。 */
  cooldown: number;
  /** 当前冷却计时（由 System 维护）。 */
  timer: number;

  constructor(damage = 10, range = 1.2, cooldown = 1.0) {
    super();
    this.damage = damage;
    this.range = range;
    this.cooldown = cooldown;
    this.timer = 0;
  }
}