/**
 * System 基类 —— 纯逻辑。
 *
 * 约定：
 *  - 子类实现 update(dt)，以 dt（秒）驱动世界状态；
 *  - 通过 this.world 查询实体 / 组件，不要在 System 里持有跨帧的组件引用。
 */
import type { World } from "./World";

export abstract class System {
  /** 由 World 在 addSystem 时注入的运行环境（只读使用）。 */
  protected world!: World;

  /** System 名称（默认类名），用于调试与日志。 */
  readonly name: string;

  protected constructor(name?: string) {
    this.name = name ?? this.constructor.name;
  }

  /** 每帧调用一次。dt：距上一帧的秒数（已被 World 钳制，最大 0.1s）。 */
  abstract update(dt: number): void;

  /** 可选生命周期：注册进世界时执行一次（预加载资源等）。 */
  onAttach?(): void;

  /** 可选生命周期：从世界移除时执行一次（释放资源等）。 */
  onDetach?(): void;
}