/**
 * PlayerControl —— 玩家控制实体标记组件（纯数据，无逻辑）。
 *
 * 拥有该组件的实体由 PlayerInputSystem 直接操控（移动/攻击），
 * TargetingSystem 会跳过它（玩家不是 AI 单位）。
 */
import { Component } from "../ecs/Component";

export class PlayerControl extends Component {
  /** 输入移动方向（单位向量，x/z 平面）。 */
  moveX = 0;
  moveZ = 0;
  /** 攻击指令（由 PlayerInputSystem 置位，出手后清零）。 */
  attackPressed = false;
  /** 攻击冷却计时（与 Attack.timer 解耦，避免被 AI 逻辑误用）。 */
  attackTimer = 0;

  /** 面向方向（用于渲染朝向 / 攻击判定方向，x/z 平面单位向量）。 */
  dirX = 1;
  dirZ = 0;
  constructor() {
    super();
  }
}
