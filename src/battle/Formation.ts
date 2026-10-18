/**
 * Formation —— 阵型数据组件（纯数据，无逻辑）。
 * 挂在玩家方普通单位上（玩家英雄 PlayerControl 不挂，自由移动）。
 */
import { Component } from "../ecs/Component";

export type FormationType = "line" | "wedge" | "circle" | "column" | "loose";
export type CommandMode = "formation" | "charge" | "hold" | "retreat";

export class Formation extends Component {
  type: FormationType;
  angle: number;
  mode: CommandMode;
  anchorX: number;
  anchorZ: number;
  constructor(type: FormationType = "loose", angle = 0, anchorX = 0, anchorZ = 0) {
    super();
    this.type = type;
    this.angle = angle;
    this.mode = "formation";
    this.anchorX = anchorX;
    this.anchorZ = anchorZ;
  }
}