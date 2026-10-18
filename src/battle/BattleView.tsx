/**
 * BattleView —— 3D 军团战视图（React 壳 + 原生 Three.js + ECS）。
 *
 * 只做挂载/卸载；World、System、实体都在此初始化与释放。
 * TargetingSystem 寻敌走位 → MovementSystem 位移 → CombatSystem 交战 → RenderSystem 渲染。
 */
import { useEffect, useRef, useState } from "react";
import { World } from "../ecs/World";
import { Position } from "./Position";
import { Velocity } from "./Velocity";
import { Team } from "./Team";
import { Health } from "./Health";
import { Attack } from "./Attack";
import { Target } from "./Target";
import { MovementSystem } from "./MovementSystem";
import { TargetingSystem } from "./TargetingSystem";
import { CombatSystem } from "./CombatSystem";
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
  const [stats, setStats] = useState({ p: playerCount, e: enemyCount });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // 1. 创建 World + Systems（顺序：targeting → movement → combat → render）
    const world = new World();
    worldRef.current = world;
    const targetingSys = new TargetingSystem();
    const moveSys = new MovementSystem();
    const combatSys = new CombatSystem();
    const renderSys = new RenderSystem(mount);
    world.addSystem(targetingSys);
    world.addSystem(moveSys);
    world.addSystem(combatSys);
    world.addSystem(renderSys);

    // 2. 生成演示战场：两军对垒（初始速度 0，由寻敌驱动）
    const spawnRow = (side: number, color: number, x0: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const col = i % 6;
        const row = Math.floor(i / 6);
        const e = world.createEntity();
        e.addComponent(new Position(x0 + col * 1.6 - 4, 0.55, row * 1.6 - 4))
          .addComponent(new Velocity(0, 0, 0))
          .addComponent(new Team(side, color))
          .addComponent(new Health(100))
          .addComponent(new Attack(10, 1.2, 0.8))
          .addComponent(new Target(null));
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
      world.removeSystem(combatSys);
      world.removeSystem(moveSys);
      world.removeSystem(targetingSys);
      worldRef.current = null;
    };
  }, [playerCount, enemyCount]);

  // 存活统计轮询（250ms 一次，避免每帧触发 React 渲染）
  useEffect(() => {
    const iv = setInterval(() => {
      const w = worldRef.current;
      if (!w) return;
      let p = 0;
      let e = 0;
      w.forEach((ent) => {
        const t = ent.getComponent(Team);
        if (t && t.side === 0) p++;
        else if (t) e++;
      });
      setStats({ p, e });
    }, 250);
    return () => clearInterval(iv);
  }, []);

  const over = stats.p <= 0 ? "红方获胜" : stats.e <= 0 ? "蓝方获胜" : null;

  return (
    <div className="battle-view">
      <div ref={mountRef} className="battle-mount" />
      <div className="battle-hud">
        <span>
          ⚔ ECS 战场 · 蓝 {stats.p}/{playerCount} · 红 {stats.e}/{enemyCount}
        </span>
        {over && <span className="battle-over">{over}</span>}
      </div>
    </div>
  );
}