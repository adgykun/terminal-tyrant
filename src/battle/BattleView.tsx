/**
 * BattleView —— 3D 军团战视图（React 壳 + 原生 Three.js + ECS）。
 *
 * 只做挂载/卸载；World、System、实体都在此初始化与释放。
 * TargetingSystem 寻敌走位 → MovementSystem 位移 → CombatSystem 交战 → RenderSystem 渲染。
 *
 * 战斗结束（任一方全灭）时通过 onBattleEnd 回传结算：
 *   { won, casualties, survivors }
 *   - won:        玩家方（side 0）是否获胜
 *   - casualties: 阵亡按兵种统计（troopId -> 数量）
 *   - survivors:  幸存按兵种统计（troopId -> 数量）
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
import { TroopType } from "./TroopType";
import { MovementSystem } from "./MovementSystem";
import { TargetingSystem } from "./TargetingSystem";
import { CombatSystem } from "./CombatSystem";
import { RenderSystem } from "./RenderSystem";
import { PlayerControl } from "./PlayerControl";
import { PlayerInputSystem } from "./PlayerInputSystem";

/** 战斗结算数据。 */
export interface BattleEndResult {
  /** 玩家方（side 0）是否获胜。 */
  won: boolean;
  /** 玩家方阵亡按兵种统计（troopId -> 数量）。 */
  casualties: Record<string, number>;
  /** 玩家方幸存按兵种统计（troopId -> 数量）。 */
  survivors: Record<string, number>;
}

interface BattleViewProps {
  /** 玩家方真实部队（troopId -> 数量）；缺省时用演示兵力。 */
  playerTroops?: Record<string, number>;
  /** 敌方部队；缺省时按玩家总战力自动生成混合军。 */
  enemyTroops?: Record<string, number>;
  /** 每军最大实体数（防卡顿）。 */
  maxUnits?: number;
  /** 战斗结束回调（任一方全灭时触发一次）。 */
  onBattleEnd?: (result: BattleEndResult) => void;
}

export function BattleView({
  playerTroops,
  enemyTroops,
  maxUnits = 60,
  onBattleEnd,
}: BattleViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const onBattleEndRef = useRef(onBattleEnd);
  onBattleEndRef.current = onBattleEnd;

  // 解析两侧部队（默认演示 24v24 农民 vs 步兵）
  const pList = useMemo(() => expandTroops(playerTroops ?? { peasant: 12, infantry: 12 }, maxUnits), [playerTroops, maxUnits]);
  const eList = useMemo(
    () => expandTroops(enemyTroops ?? makeDemoEnemy(pList.length), maxUnits),
    [enemyTroops, pList.length, maxUnits]
  );

  const [total] = useState({ p: pList.length, e: eList.length });
  const [stats, setStats] = useState<{ p: number; e: number }>({ p: pList.length, e: eList.length });

  // 战斗结束只触发一次
  const endedRef = useRef(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const world = new World();
    worldRef.current = world;
    const playerInputSys = new PlayerInputSystem();
    const targetingSys = new TargetingSystem();
    const moveSys = new MovementSystem();
    const combatSys = new CombatSystem();
    const renderSys = new RenderSystem(mount);
    // 执行顺序：玩家输入 → AI 寻敌走位 → 位移 → 交战 → 渲染
    world.addSystem(playerInputSys);
    world.addSystem(targetingSys);
    world.addSystem(moveSys);
    world.addSystem(combatSys);
    world.addSystem(renderSys);
    // 玩家攻击命中 → 镜头震动（跨系统回调：CombatSystem 出手 → RenderSystem shake）
    combatSys.onPlayerAttack = () => renderSys.addShake();
    // 生成战场：真实部队（每个实体按兵种规格差异化，并记录兵种 id）
    const spawnArmy = (
      side: number,
      color: number,
      x0: number,
      troops: TroopSpec[]
    ) => {
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
          .addComponent(new MoveSpeed(spec.speed))
          .addComponent(new TroopType(spec.name));
        i++;
      }
    };
    spawnArmy(0, 0x4a90ff, 8, pList);
    spawnArmy(1, 0xff5050, -8, eList);
    // 玩家英雄实体：蓝色、体积 1.5 倍、高血量高攻击，带 PlayerControl
    const player = world.createEntity();
    player
      .addComponent(new Position(8, 0.9, 0))
      .addComponent(new Velocity(0, 0, 0))
      .addComponent(new Team(0, 0x44ccff))
      .addComponent(new Health(300))
      .addComponent(new Attack(20, 1.6, 0.8))
      .addComponent(new Target(null))
      .addComponent(new Visual(0.75, 1.65))
      .addComponent(new MoveSpeed(4.2))
      .addComponent(new PlayerControl())
      .addComponent(new TroopType("player"));
    playerInputSys.setPlayer(player);
    world.start();
    return () => {
      world.stop();
      world.removeSystem(renderSys);
      world.removeSystem(combatSys);
      world.removeSystem(moveSys);
      world.removeSystem(targetingSys);
      world.removeSystem(playerInputSys);
      worldRef.current = null;
      endedRef.current = false;
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
      let playerAlive = false;
      const pSurvivors: Record<string, number> = {};
      const pCasualties: Record<string, number> = {};
      const initialP = new Map<string, number>();
      pList.forEach((s) => {
        initialP.set(s.name, (initialP.get(s.name) ?? 0) + 1);
      });

      w.forEach((ent) => {
        const t = ent.getComponent(Team);
        const tt = ent.getComponent(TroopType);
        const id = tt?.id ?? "unknown";
        if (!t) return;
        // 玩家英雄实体存活判定
        if (ent.hasComponent(PlayerControl) && ent.getComponent(Health)?.alive) {
          playerAlive = true;
        }
        if (t.side === 0) {
          p++;
          pSurvivors[id] = (pSurvivors[id] ?? 0) + 1;
        } else {
          e++;
        }
      });

      // 玩家方阵亡 = 初始数 - 幸存数
      for (const [id, cnt] of initialP) {
        const alive = pSurvivors[id] ?? 0;
        const lost = cnt - alive;
        if (lost > 0) pCasualties[id] = lost;
      }

      setStats({ p, e });

      // 战斗结束判定：
      //  - 敌方全灭且玩家存活 → 胜利；
      //  - 玩家英雄阵亡（即使己方还有兵）→ 失败；
      //  - 己方部队全灭（玩家未计入 troops）→ 失败。
      const enemyDead = e <= 0;
      const alliesDead = p <= 0 && !playerAlive;
      if ((enemyDead || !playerAlive || alliesDead) && !endedRef.current) {
        endedRef.current = true;
        const won = enemyDead && playerAlive;
        onBattleEndRef.current?.({
          won,
          casualties: pCasualties,
          survivors: pSurvivors,
        });
      }
    }, 250);
    return () => clearInterval(iv);
  }, [pList]);

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