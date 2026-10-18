/**
 * Health —— 生命值数据组件（纯数据）。
 */
import { Component } from "../ecs/Component";

export class Health extends Component {
  hp: number;
  maxHp: number;

  constructor(hp = 100, maxHp = hp) {
    super();
    this.hp = hp;
    this.maxHp = maxHp;
  }

  get alive(): boolean {
    return this.hp > 0;
  }
}