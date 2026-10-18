/**
 * Velocity —— 速度数据组件（纯数据，无逻辑）。
 */
import { Component } from "../ecs/Component";

export class Velocity extends Component {
  vx: number;
  vy: number;
  vz: number;

  constructor(vx = 0, vy = 0, vz = 0) {
    super();
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
  }
}