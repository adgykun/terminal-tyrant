import type { GameState } from "../core/state";
import { UNITS, COMPANIONS } from "../core/data";
import { calculate_army_power, upgrade_unit } from "../core/engine";
import { Users, Star } from "lucide-react";

interface PartyPanelProps {
  state: GameState;
  performAction: (action: (...args: any[]) => any, ...args: any[]) => any;
}

export function PartyPanel({ state, performAction }: PartyPanelProps) {
  const armyPower = calculate_army_power(state.troops);
  const totalTroops = Object.values(state.troops).reduce((a: number, b: number) => a + b, 0);
  const totalFoodConsumption = Object.entries(state.troops).reduce((sum: number, [uId, count]: [string, number]) => {
    return sum + (UNITS[uId]?.food_consumption ?? 0) * count;
  }, 0);

  return (
    <div>
      <div className="panel">
        <div className="panel-title"><Users size={22} /> 队伍概览</div>
        <div className="flex-row gap-16 mb-12">
          <div className="flex-col gap-4" style={{ flex: 1 }}>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-secondary">总兵力</span>
              <span className="text-bold text-gold">{totalTroops} / {state.max_army_size}</span>
            </div>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-secondary">总战力</span>
              <span className="text-bold text-blue">{armyPower}</span>
            </div>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-secondary">每日粮耗</span>
              <span className="text-bold text-green">{totalFoodConsumption.toFixed(1)}</span>
            </div>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-secondary">士气</span>
              <span className="text-bold text-red">{state.morale}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">兵种列表</div>
        {Object.entries(state.troops).map(([uId, count]: [string, number]) => {
          const unit = UNITS[uId];
          if (!unit || count === 0) return null;
          return (
            <div key={uId} className="list-item">
              <div className="flex-col gap-4">
                <span className="text-bold">{unit.name}</span>
                <span className="text-sm text-muted">
                  战力: {unit.power} | 粮耗: {unit.food_consumption}/天 | 俘虏价值: {unit.prisoner_value}金
                </span>
              </div>
              <div className="flex-col gap-4" style={{ alignItems: "flex-end" }}>
                <span className="text-bold text-gold">x{count}</span>
                <div className="flex-col gap-4" style={{ alignItems: "flex-end" }}>
                  {unit.upgrade_targets && unit.upgrade_targets.length > 0 ? (
                    unit.upgrade_targets.map((tid: string) => (
                      <button key={tid} style={{ fontSize: "12px", padding: "4px 8px" }} onClick={() => performAction(upgrade_unit, uId, 1, tid)}>
                        升级 → {UNITS[tid]?.name ?? tid} ({UNITS[uId]?.upgrade_cost ?? 0}金)
                      </button>
                    ))
                  ) : unit.upgrade_to ? (
                    <button style={{ fontSize: "12px", padding: "4px 8px" }} onClick={() => performAction(upgrade_unit, uId, 1)}>
                      升级 → {UNITS[unit.upgrade_to]?.name}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        {totalTroops === 0 && <div className="text-muted text-sm">你的队伍中没有任何士兵</div>}
      </div>

      <div className="panel">
        <div className="panel-title">同伴</div>
        {state.companions.length === 0 ? (
          <div className="text-muted text-sm">尚无同伴加入，前往酒馆可以雇佣同伴</div>
        ) : (
          state.companions.map((cId: string) => {
            const comp = COMPANIONS[cId];
            if (!comp) return null;
            return (
              <div key={cId} className="list-item">
                <div className="flex-col gap-4">
                  <span className="text-bold">{comp.name}</span>
                  <span className="text-sm text-muted">{comp.greeting}</span>
                </div>
                <div className="text-sm text-gold">
                  {comp.bonus_type} +{comp.bonus_value}
                  {comp.likes_fishing && <span className="text-muted"> | 喜欢钓鱼</span>}
                </div>
                <div></div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
