/**
 * Visual —— 渲染用外观数据组件（纯数据）。
 */
import { Component } from "../ecs/Component";

export class Visual extends Component {
  radius: number;
  height: number;

  constructor(radius = 0.45, height = 1.1) {
    super();
    this.radius = radius;
    this.height = height;
  }
}