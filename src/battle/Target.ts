/**
 * Target —— 当前锁定目标组件（纯数据）。
 * 由 TargetingSystem 维护，CombatSystem 只对锁定目标交战。
 */
import { Component } from "../ecs/Component";

export class Target extends Component {
  /** 目标实体 id；null = 尚无目标。 */
  targetId: number | null;

  constructor(targetId: number | null = null) {
    super();
    this.targetId = targetId;
  }
}