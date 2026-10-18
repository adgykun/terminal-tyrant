/**
 * BattleView —— 3D 军团战视图（React 壳 + 原生 Three.js + ECS）。
 *
 * 只做挂载/卸载；World、System、实体都在此初始化与释放。
 * TargetingSystem 寻敌走位 → MovementSystem 位移 → CombatSystem 交战 → RenderSystem 渲染。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { World } from "../ecs/World";
import { UNITS } from "../core/data";
import { Position } from "./Position";
import { Velocity } from "./Velocity";
import { Team } from "./Team";
import { Health } from "./Health";
import { Attack } from "./Attack";
import { Target } from "./Target";
import { Visual } from "./Visual";
import { MoveSpeed } from "./MoveSpeed";
import { getTroopSpec, type TroopSpec } from "./TroopClass";
import { MovementSystem } from "./MovementSystem";
import { TargetingSystem } from "./TargetingSystem";
import { CombatSystem } from "./CombatSystem";
import { RenderSystem } from "./RenderSystem";

interface BattleViewProps {
  /** 玩家方真实部队（troopId -> 数量）；缺省时用演示兵力。 */
  playerTroops?: Record<string, number>;
  /** 敌方部队；缺省时按玩家总战力自动生成混合军。 */
  enemyTroops?: Record<string, number>;
  /** 每军最大实体数（防卡顿）。 */
  maxUnits?: number;
}

export function BattleView({
  playerTroops,
  enemyTroops,
  maxUnits = 60,
}: BattleViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);

  // 解析两侧部队（默认演示 24v24 农民 vs 步兵）
  const pList = useMemo(() => expandTroops(playerTroops ?? { peasant: 12, infantry: 12 }, maxUnits), [playerTroops, maxUnits]);
  const eList = useMemo(
    () => expandTroops(enemyTroops ?? makeDemoEnemy(pList.length), maxUnits),
    [enemyTroops, pList.length, maxUnits]
  );

  const [total] = useState({ p: pList.length, e: eList.length });
  const [stats, setStats] = useState<{ p: number; e: number }>({ p: pList.length, e: eList.length });

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

    // 2. 生成战场：真实部队（每个实体按兵种规格差异化）
    const spawnArmy = (side: number, color: number, x0: number, troops: TroopSpec[]) => {
      let i = 0;
      for (const spec of troops) {
        const col = i % 6;
        const row = Math.floor(i / 6);
        const e = world.createEntity();
        e.addComponent(new Position(x0 + col * 1.6 - 4, spec.height / 2, row * 1.6 - 4))
          .addComponent(new Velocity(0, 0, 0))
          .addComponent(new Team(side, color))
          .addComponent(new Health(spec.hp))
          .addComponent(new Attack(spec.damage, spec.range, spec.cooldown))
          .addComponent(new Target(null))
          .addComponent(new Visual(spec.radius, spec.height))
          .addComponent(new MoveSpeed(spec.speed));
        i++;
      }
    };
    spawnArmy(0, 0x4a90ff, 8, pList);
    spawnArmy(1, 0xff5050, -8, eList);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pList, eList]);

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
          ⚔ ECS 战场 · 蓝 {stats.p}/{total.p} · 红 {stats.e}/{total.e}
        </span>
        {over && <span className="battle-over">{over}</span>}
      </div>
    </div>
  );
}

// ===== 辅助函数 =====

/** 把 troopId->count 展开为 TroopSpec 数组（按 UNITS.power 推导属性），并截断到上限。 */
function expandTroops(troops: Record<string, number>, max: number): TroopSpec[] {
  const out: TroopSpec[] = [];
  for (const [uid, count] of Object.entries(troops)) {
    const info = UNITS[uid];
    const power = typeof info?.power === "number" ? info.power : 1;
    const spec = getTroopSpec(uid, power);
    for (let i = 0; i < count; i++) {
      if (out.length >= max) return out;
      out.push(spec);
    }
  }
  return out;
}

/** 默认敌方：约等于玩家数量（±15%），40% 农民 / 30% 步兵 / 30% 弓箭手。 */
function makeDemoEnemy(playerCount: number): Record<string, number> {
  const n = Math.max(1, Math.round(playerCount * (0.85 + Math.random() * 0.3)));
  const peasant = Math.round(n * 0.4);
  const infantry = Math.round(n * 0.3);
  const archer = n - peasant - infantry;
  return { peasant, infantry, archer };
}