/**
 * MoveSpeed —— 单位移动速度（纯数据，兵种差异化用）。
 */
import { Component } from "../ecs/Component";

export class MoveSpeed extends Component {
  value: number;

  constructor(value = 3.2) {
    super();
    this.value = value;
  }
}