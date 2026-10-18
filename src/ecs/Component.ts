/**
 * Component 基类 —— 纯数据容器。
 *
 * 约定：
 *  - 子类只声明数据字段，不写业务逻辑（逻辑全部放在 System 中）；
 *  - 用「类构造器本身」作为组件类型标识，Entity 以它为 key 存取；
 *  - 同一实体上每种组件只有一份。
 */
export class Component {
  /** 调试用：组件类型名（默认取类名，子类可覆盖）。 */
  get typeName(): string {
    return this.constructor.name;
  }
}

/** 组件构造器类型：用于类型安全查询。 */
export type ComponentCtor<T extends Component = Component> = new (
  ...args: any[]
) => T;