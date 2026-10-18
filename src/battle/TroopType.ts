/**
 * TroopType —— 记录实体对应的兵种 id（纯数据，用于结算统计）。
 */
import { Component } from "../ecs/Component";

export class TroopType extends Component {
  /** 兵种 id（对应 UNITS 的 key，如 "peasant" / "infantry"）。 */
  id: string;

  constructor(id: string) {
    super();
    this.id = id;
  }
}