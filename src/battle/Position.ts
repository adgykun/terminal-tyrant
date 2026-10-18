/**
 * Position —— 空间数据组件（纯数据，无逻辑）。
 */
import { Component } from "../ecs/Component";

export class Position extends Component {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    super();
    this.x = x;
    this.y = y;
    this.z = z;
  }
}