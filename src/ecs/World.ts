/**
 * World —— 实体 + 系统容器，驱动主循环。
 *
 * 职责：
 *  - 分配实体 id、维护实体生命周期；
 *  - 注册 / 卸载 System，并注入 world 引用；
 *  - 用 requestAnimationFrame 主循环按注册顺序依次调用各 System.update(dt)。
 */
import { Entity } from "./Entity";
import type { ComponentCtor } from "./Component";
import type { System } from "./System";

export class World {
  private readonly entities = new Map<number, Entity>();
  private readonly systems: System[] = [];
  private idCounter = 0;

  private running = false;
  private rafId: number | null = null;
  private lastTime = 0;

  /** 创建实体并登记。 */
  createEntity(): Entity {
    const entity = new Entity(++this.idCounter);
    this.entities.set(entity.id, entity);
    return entity;
  }

  /** 销毁实体（组件随之丢弃）。 */
  destroyEntity(entity: Entity): void {
    this.entities.delete(entity.id);
  }

  /** 遍历所有实体；回调返回 false 可中断。 */
  forEach(fn: (e: Entity) => void | false): void {
    for (const e of this.entities.values()) {
      if (fn(e) === false) break;
    }
  }

  /** 查询拥有全部指定组件的实体列表。 */
  query(...need: ComponentCtor[]): Entity[] {
    const result: Entity[] = [];
    for (const e of this.entities.values()) {
      if (need.every((c) => e.hasComponent(c))) result.push(e);
    }
    return result;
  }

  /** 注册 System（注入 world 引用后按序执行；同一实例不可重复注册）。 */
  addSystem(system: System): this {
    if (this.systems.includes(system)) return this;
    (system as unknown as { world: World }).world = this;
    this.systems.push(system);
    system.onAttach?.();
    return this;
  }

  /** 移除 System。 */
  removeSystem(system: System): void {
    const i = this.systems.indexOf(system);
    if (i >= 0) {
      this.systems.splice(i, 1);
      system.onDetach?.();
    }
  }

  /** 启动主循环。 */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      // dt 以秒计；钳制上限防止切后台后跳帧导致逻辑爆炸
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      for (const s of this.systems) s.update(dt);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /** 停止主循环。 */
  stop(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
}