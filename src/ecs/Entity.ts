/**
 * Entity —— 唯一 id + 组件集合。
 *
 * 只做存取管理，不含任何玩法逻辑；
 * 玩法逻辑一律由 System 通过组件数据驱动。
 */
import type { Component, ComponentCtor } from "./Component";

export class Entity {
  /** 全局唯一 id（由 World 分配）。 */
  public readonly id: number;

  /** 组件表：以组件构造器为 key。 */
  private readonly components = new Map<ComponentCtor, Component>();

  constructor(id: number) {
    this.id = id;
  }

  /** 添加组件（同类型已存在则整体替换）。 */
  addComponent<T extends Component>(component: T): this {
    const ctor = component.constructor as ComponentCtor<T>;
    this.components.set(ctor, component);
    return this;
  }

  /** 获取组件实例；不存在返回 undefined。 */
  getComponent<T extends Component>(ctor: ComponentCtor<T>): T | undefined {
    return this.components.get(ctor) as T | undefined;
  }

  /** 是否拥有该组件（用于查询与过滤）。 */
  hasComponent(ctor: ComponentCtor): boolean {
    return this.components.has(ctor);
  }

  /** 移除组件。 */
  removeComponent(ctor: ComponentCtor): void {
    this.components.delete(ctor);
  }

  /** 当前组件数量。 */
  get componentCount(): number {
    return this.components.size;
  }
}