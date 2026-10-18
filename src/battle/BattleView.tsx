/**
 * BattleView —— 3D 军团战视图（React 壳 + 原生 Three.js + ECS）。
 *
 * 只做挂载/卸载；World、System、实体都在此初始化与释放。
 * 渲染由 RenderSystem 驱动（每帧 renderer.render），MovementSystem 驱动移动。
 */
import { useEffect, useRef } from "react";
import { World } from "../ecs/World";
import { Position } from "./Position";
import { Velocity } from "./Velocity";
import { Team } from "./Team";
import { MovementSystem } from "./MovementSystem";
import { RenderSystem } from "./RenderSystem";

interface BattleViewProps {
  /** 玩家方士兵数量（演示用，默认 24）。 */
  playerCount?: number;
  /** 敌方士兵数量（演示用，默认 24）。 */
  enemyCount?: number;
}

export function BattleView({ playerCount = 24, enemyCount = 24 }: BattleViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // 1. 创建 World + Systems
    const world = new World();
    worldRef.current = world;
    const moveSys = new MovementSystem();
    const renderSys = new RenderSystem(mount);
    world.addSystem(moveSys);
    world.addSystem(renderSys);

    // 2. 生成演示战场：两军对垒
    const spawnRow = (side: number, color: number, x0: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const col = i % 6;
        const row = Math.floor(i / 6);
        const e = world.createEntity();
        e.addComponent(new Position(x0 + col * 1.6 - 4, 0.55, row * 1.6 - 4))
          .addComponent(new Velocity(side === 0 ? 3.2 : -3.2, 0, 0))
          .addComponent(new Team(side, color));
      }
    };
    spawnRow(0, 0x4a90ff, 8, playerCount);
    spawnRow(1, 0xff5050, -8, enemyCount);

    // 3. 启动主循环
    world.start();

    // 4. cleanup：释放
    return () => {
      world.stop();
      world.removeSystem(renderSys);
      world.removeSystem(moveSys);
      worldRef.current = null;
    };
  }, [playerCount, enemyCount]);

  return (
    <div className="battle-view">
      <div ref={mountRef} className="battle-mount" />
      <div className="battle-hud">
        <span>⚔ ECS 战场演示</span>
        <span>蓝方 {playerCount} · 红方 {enemyCount}</span>
      </div>
    </div>
  );
}