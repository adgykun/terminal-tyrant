/**
 * Team —— 阵营数据组件（纯数据）。
 */
import { Component } from "../ecs/Component";

export class Team extends Component {
  /** 0 = 玩家方，1 = 敌方。 */
  side: number;
  /** 用于渲染的颜色标识。 */
  color: number;

  constructor(side = 0, color = 0x4488ff) {
    super();
    this.side = side;
    this.color = color;
  }
}