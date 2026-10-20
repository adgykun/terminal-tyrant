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
import { Formation } from "./Formation";
import { FormationSystem } from "./FormationSystem";
import { CommandSystem, type CommandState } from "./CommandSystem";
import { Morale } from "./Morale";
import { MoraleSystem } from "./MoraleSystem";
import { RoutSystem } from "./RoutSystem";
import { SiegeSystem, SIEGE_LAYOUT } from "./Siege";
import { type TerrainField, type TerrainFeature, terrainFromFeatures, flatTerrain } from "./Terrain";
import { preloadModels } from "./ModelCache";

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
  /** 攻城战：给出则进入攻城模式（城墙隔开两军，先破门再肉搏）。 */
  siege?: { name: string; gateHp?: number };
  /** 玩家英雄的战斗属性（由角色属性+装备+技能推导；缺省用默认值）。 */
  playerStats?: {
    hp: number; damage: number; range: number; cooldown: number;
    speed: number; ranged: boolean; damageReduction?: number;
  };
}

export function BattleView({
  playerTroops,
  enemyTroops,
  maxUnits = 60,
  onBattleEnd,
  siege,
  playerStats,
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
  // 指挥状态（阵型 + 指令模式），默认线列阵型
  const [command, setCommand] = useState<CommandState>({ type: "line", mode: "formation" });
  // 模型加载进度（null = 未开始 / 已完成）
  const [modelProgress, setModelProgress] = useState<{ loaded: number; total: number } | null>(null);
  // 攻城战：城门耐久比例与是否破门
  const [gateFrac, setGateFrac] = useState(1);
  const [breached, setBreached] = useState(false);

  // 战斗结束只触发一次
  const endedRef = useRef(false);

  // 预加载 3D 模型（避免战斗开始时卡顿）；失败自动回退锥体，不影响战斗
  useEffect(() => {
    let cancelled = false;
    setModelProgress({ loaded: 0, total: 1 });
    preloadModels((loaded, total) => {
      if (!cancelled) setModelProgress({ loaded, total });
    }).then(() => {
      if (!cancelled) setModelProgress(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const world = new World();
    worldRef.current = world;
    const playerInputSys = new PlayerInputSystem();
    const commandSys = new CommandSystem();
    const formationSys = new FormationSystem();
    const targetingSys = new TargetingSystem();
    const moveSys = new MovementSystem();
    const combatSys = new CombatSystem();
    const moraleSys = new MoraleSystem();
    const routSys = new RoutSystem();
    const renderSys = new RenderSystem(mount);
    const isSiege = !!siege;
    // ── 地形：野战随机生成山丘/林地/河流；攻城战固定"城前缓坡"（守方高地优势） ──
    const terrainFeatures: TerrainFeature[] = isSiege
      ? [
          // 城门内侧略高：守军站高处射程与伤害都有加成
          { type: "hill", x: SIEGE_LAYOUT.gateX, z: SIEGE_LAYOUT.gateZ - 12, radius: 16, magnitude: 3.2 },
          // 进攻方必经的一片疏林（减速，但不足以阻断全部远程）
          { type: "wood", x: -14, z: 8, radius: 7, magnitude: 0 },
          { type: "wood", x: 16, z: 4, radius: 6, magnitude: 0 },
        ]
      : (() => {
          // 野战：确定性伪随机地形（同一天同一场战斗地形一致）
          let seed = (pList.length * 7919 + eList.length * 104729) % 100000;
          const rnd = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
          };
          const out: TerrainFeature[] = [];
          const nHills = 1 + Math.floor(rnd() * 2);
          for (let i = 0; i < nHills; i++) {
            out.push({ type: "hill", x: -18 + rnd() * 36, z: -16 + rnd() * 32, radius: 6 + rnd() * 5, magnitude: 2.5 + rnd() * 3 });
          }
          if (rnd() < 0.6) {
            out.push({ type: "wood", x: -16 + rnd() * 32, z: -12 + rnd() * 24, radius: 5 + rnd() * 4, magnitude: 0 });
          }
          if (rnd() < 0.35) {
            out.push({ type: "river", x: 0, z: -6 + rnd() * 12, radius: 22, magnitude: 3.2 });
          }
          return out;
        })();
    const terrain: TerrainField = terrainFromFeatures(terrainFeatures);
    targetingSys.terrain = terrain;
    combatSys.terrain = terrain;
    // 玩家护甲减伤（装备推导）
    combatSys.playerDamageReduction = playerStats?.damageReduction ?? 0;
    // 执行顺序：玩家输入 → 指挥指令 → 阵型排布 → AI 寻敌走位 → 位移 → [攻城：城墙阻挡/砸门] → 交战
    //          → 士气演化 → 溃逃位移 → 渲染
    const siegeSys = isSiege
      ? new SiegeSystem({
          gateX: SIEGE_LAYOUT.gateX,
          gateZ: SIEGE_LAYOUT.gateZ,
          gateHalfWidth: SIEGE_LAYOUT.gateHalfWidth,
          gateHp: siege?.gateHp ?? 320,
          attackerSide: 0,
          defenderSide: 1,
          damagePerUnitPerSec: 2.2,
        })
      : null;
    world.addSystem(playerInputSys);
    world.addSystem(commandSys);
    world.addSystem(formationSys);
    world.addSystem(targetingSys);
    world.addSystem(moveSys);
    if (siegeSys) world.addSystem(siegeSys);
    world.addSystem(combatSys);
    world.addSystem(moraleSys);
    world.addSystem(routSys);
    world.addSystem(renderSys);
    // 指挥状态变化 → 更新 HUD（切阵型/指令时触发）
    commandSys.onChange = (state) => setCommand(state);
    // 玩家攻击命中 → 镜头震动（跨系统回调：CombatSystem 出手 → RenderSystem shake）
    combatSys.onPlayerAttack = () => renderSys.addShake();
    if (siegeSys) {
      siegeSys.onGateDamage = (frac) => {
        renderSys.setGateDamage(frac);
        setGateFrac(frac);
      };
      siegeSys.onBreach = () => {
        renderSys.openGate();
        renderSys.addShake();
        setBreached(true);
      };
      renderSys.enableSiege(SIEGE_LAYOUT);
    }
    // 地形视觉（山丘/林地/河流）
    renderSys.enableTerrain(terrainFeatures, terrain.heightAt);
    // 生成战场：真实部队（每个实体按兵种规格差异化，并记录兵种 id）
    const spawnArmy = (
      side: number,
      color: number,
      x0: number,
      troops: TroopSpec[],
      withFormation = false
    ) => {
      let i = 0;
      for (const spec of troops) {
        const col = i % 8;
        const row = Math.floor(i / 8);
        let px: number;
        let pz: number;
        if (isSiege) {
          // 攻城布局：进攻方（side 0）在墙外集结，守方在墙后
          const spacing = 1.7;
          const lateral = (col - 3.5) * spacing + SIEGE_LAYOUT.gateX;
          if (side === 0) {
            px = lateral;
            pz = SIEGE_LAYOUT.gateZ + 7 + row * spacing;
          } else {
            px = lateral;
            pz = SIEGE_LAYOUT.gateZ - 4 - row * spacing;
          }
        } else {
          px = x0 + col * 1.6 - 4;
          pz = row * 1.6 - 4;
        }
        const e = world.createEntity();
        e.addComponent(new Position(px, spec.height / 2, pz))
          .addComponent(new Velocity(0, 0, 0))
          .addComponent(new Team(side, color))
          .addComponent(new Health(spec.hp))
          .addComponent(new Attack(spec.damage, spec.range, spec.cooldown, spec.ranged))
          .addComponent(new Target(null))
          .addComponent(new Visual(spec.radius, spec.height))
          .addComponent(new MoveSpeed(spec.speed))
          .addComponent(new TroopType(spec.name))
          .addComponent(new Morale(80, false));
        // 玩家方军队挂阵型组件（默认 line，锚点=初始生成点，角度指向敌方）
        if (withFormation) {
          e.addComponent(new Formation("line", 0, x0, 0));
        }
        i++;
      }
    };
    spawnArmy(0, 0x4a90ff, 8, pList, true);
    spawnArmy(1, 0xff5050, -8, eList);
    // 玩家英雄实体：属性由「角色属性 + 装备 + 技能」推导，而非硬编码
    // 未传 playerStats 时用默认值（保持向后兼容）
    const pStats = playerStats ?? { hp: 300, damage: 20, range: 1.6, cooldown: 0.8, speed: 4.2, ranged: false, damageReduction: 0 };
    const player = world.createEntity();
    player
      .addComponent(new Position(isSiege ? SIEGE_LAYOUT.gateX : 8, 0.9, isSiege ? SIEGE_LAYOUT.gateZ + 12 : 0))
      .addComponent(new Velocity(0, 0, 0))
      .addComponent(new Team(0, 0x44ccff))
      .addComponent(new Health(pStats.hp))
      .addComponent(new Attack(pStats.damage, pStats.range, pStats.cooldown, pStats.ranged))
      .addComponent(new Target(null))
      .addComponent(new Visual(0.75, 1.65))
      .addComponent(new MoveSpeed(pStats.speed))
      .addComponent(new PlayerControl())
      .addComponent(new TroopType("player"))
      .addComponent(new Morale(100, true));
    playerInputSys.setPlayer(player);
    commandSys.setPlayer(player);
    world.start();
    return () => {
      world.stop();
      world.removeSystem(renderSys);
      world.removeSystem(routSys);
      world.removeSystem(moraleSys);
      world.removeSystem(combatSys);
      if (siegeSys) world.removeSystem(siegeSys);
      world.removeSystem(moveSys);
      world.removeSystem(targetingSys);
      world.removeSystem(formationSys);
      world.removeSystem(commandSys);
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
          {siege ? `🏰 攻城战 · ${siege.name}` : "⚔ ECS 战场"} · 蓝 {stats.p}/{total.p} · 红 {stats.e}/{total.e}
        </span>
        {siege && (
          <span style={{ color: breached ? "#7ec87e" : "#e0a84a" }}>
            {breached
              ? "城门已破！冲入门洞"
              : `城门耐久 ${Math.round(gateFrac * 100)}% —— 顶着箭雨砸门`}
          </span>
        )}
        <span className="battle-command">
          阵型：{FORMATION_NAMES[command.type]}（{COMMAND_NAMES[command.mode]}）｜
          [1]线列 [2]楔形 [3]圆形 [4]纵队 [5]散兵 [F]冲锋 [H]驻守 [R]撤退
        </span>
        {modelProgress && (
          <span className="battle-loading">
            ⏳ 加载模型 {modelProgress.loaded}/{modelProgress.total}
          </span>
        )}
        {over && <span className="battle-over">{over}</span>}
      </div>
    </div>
  );
}

// ===== 辅助函数 =====
/** 阵型类型 → 中文名（HUD 显示）。 */
const FORMATION_NAMES: Record<string, string> = {
  line: "线列",
  wedge: "楔形",
  circle: "圆形",
  column: "纵队",
  loose: "散兵",
};
/** 指令模式 → 中文名（HUD 显示）。 */
const COMMAND_NAMES: Record<string, string> = {
  formation: "列阵",
  charge: "冲锋",
  hold: "驻守",
  retreat: "撤退",
};
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