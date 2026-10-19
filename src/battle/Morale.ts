/**
 * Morale —— 士气数据组件（纯数据）。
 *
 * 设计：
 *  - value 范围 0-100；breakPoint 为崩溃阈值，跌破即溃逃；
 *  - 英雄单位永不溃逃（isHero）；溃逃中朝 routeDir 方向逃离战场；
 *  - 本组件只存数据，士气增减逻辑在 MoraleSystem 中。
 */
import { Component } from "../ecs/Component";

export class Morale extends Component {
  /** 当前士气值 0-100 */
  value: number;
  /** 崩溃阈值，低于此值开始溃逃 */
  breakPoint: number;
  /** 是否正在溃逃 */
  isRouting: boolean;
  /** 是否为英雄单位（英雄永不溃逃） */
  isHero: boolean;
  /** 溃逃方向（归一化向量） */
  routeDirX: number;
  routeDirZ: number;

  constructor(value = 80, isHero = false) {
    super();
    this.value = value;
    this.breakPoint = 25;
    this.isRouting = false;
    this.isHero = isHero;
    this.routeDirX = 0;
    this.routeDirZ = 0;
  }
}
