import type { GameState } from "../core/state";
import { UNITS, COMPANIONS, GOODS } from "../core/data";
import { BANNERLORD_TROOPS } from "../core/troops_bannerlord";
import { calculate_army_power, upgrade_unit, upgrade_bannerlord_unit, dismiss_troops, sell_prisoners } from "../core/engine";
import {
  analyzeArmy,
  foodSustainability,
  troopRole,
  troopCulture,
  ROLE_NAMES,
  CULTURE_NAMES,
  powerTier,
} from "../core/army_composition";
import { Users, Star, AlertTriangle, Wheat, Swords, Ban } from "lucide-react";

interface PartyPanelProps {
  state: GameState;
  performAction: (action: (...args: any[]) => any, ...args: any[]) => any;
}

export function PartyPanel({ state, performAction }: PartyPanelProps) {
  const comp = analyzeArmy(state.troops);
  const totalTroops = comp.total;
  const food = foodSustainability(comp, state.food ?? 0);
  const prisoners: Record<string, number> = state.prisoners ?? {};
  const prisonerCount = Object.values(prisoners).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* 部队构成分析（骑砍式面板核心） */}
      <div className="panel">
        <div className="panel-title"><Swords size={22} /> 部队构成</div>
        <div className="flex-row gap-16 mb-12">
          <div className="flex-col gap-4" style={{ flex: 1 }}>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-secondary">总兵力</span>
              <span className="text-bold text-gold">{totalTroops} / {state.max_army_size}</span>
            </div>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-secondary">总战力</span>
              <span className="text-bold text-blue">{Math.round(comp.avgPower * totalTroops)}</span>
            </div>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-secondary">平均战力</span>
              <span className="text-bold">{comp.avgPower.toFixed(1)}（{powerTier(comp.avgPower).name}）</span>
            </div>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-secondary">每日粮耗</span>
              <span className="text-bold text-green">{comp.foodPerDay.toFixed(1)}</span>
            </div>
            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <span className="text-sm text-secondary">粮食可撑</span>
              <span className={food.sustainable ? "text-bold text-green" : "text-bold text-red"}>
                {food.days === Infinity ? "∞" : `${food.days.toFixed(1)} 天`}
              </span>
            </div>
          </div>
        </div>

        {/* 兵种角色比例条 */}
        <div className="text-sm text-secondary mb-8">兵种构成</div>
        <div style={{ display: "flex", height: 18, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
          {(["infantry", "ranged", "cavalry"] as const).map((r) =>
            comp.byRole[r] > 0 ? (
              <div
                key={r}
                title={`${ROLE_NAMES[r]} ${comp.byRole[r]}`}
                style={{
                  width: `${comp.roleRatio[r] * 100}%`,
                  background: r === "infantry" ? "#5b9bd5" : r === "ranged" ? "#5cb85c" : "#d9a441",
                }}
              />
            ) : null
          )}
        </div>
        <div className="flex-row gap-16 text-sm" style={{ flexWrap: "wrap" }}>
          {(["infantry", "ranged", "cavalry"] as const).map((r) => (
            <span key={r} className="text-muted">
              {ROLE_NAMES[r]} {comp.byRole[r]}（{Math.round(comp.roleRatio[r] * 100)}%）
            </span>
          ))}
        </div>

        {/* 文化构成 */}
        {comp.cultureCount > 0 && (
          <div className="text-sm text-secondary mt-12 mb-8">
            文化构成（{comp.cultureCount} 种）
          </div>
        )}
        {comp.cultureCount > 1 && (
          <div className="flex-row gap-8 text-sm" style={{ flexWrap: "wrap" }}>
            {Object.entries(comp.byCulture).map(([c, n]) => (
              <span key={c} className="text-muted">
                {CULTURE_NAMES[c] ?? c} {n}
              </span>
            ))}
          </div>
        )}

        {/* 警告 */}
        {comp.warnings.length > 0 && (
          <div style={{
            marginTop: 12, padding: "10px 12px", borderRadius: 8,
            background: "rgba(200,150,40,0.12)", border: "1px solid rgba(210,160,60,0.35)",
          }}>
            <div className="flex-row gap-4 mb-8" style={{ color: "#e0a84a", fontSize: 13 }}>
              <AlertTriangle size={15} /> 部队问题
            </div>
            {comp.warnings.map((w, i) => (
              <div key={i} className="text-sm" style={{ color: "#d8c9a8", lineHeight: 1.7 }}>· {w}</div>
            ))}
            {comp.moraleModifier !== 0 && (
              <div className="text-sm mt-8" style={{ color: "#e0a84a" }}>
                士气修正 {comp.moraleModifier > 0 ? `+${comp.moraleModifier}` : comp.moraleModifier}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 兵种明细 */}
      <div className="panel">
        <div className="panel-title">兵种列表</div>
        {Object.entries(state.troops).map(([uId, count]: [string, number]) => {
          const unit = UNITS[uId];
          const bl = (BANNERLORD_TROOPS as any)[uId];
          const name = bl?.name ?? unit?.name ?? uId;
          const power = bl?.power ?? unit?.power ?? 1;
          if (count === 0) return null;
          const role = troopRole(uId);
          const tier = powerTier(power);
          return (
            <div key={uId} className="list-item">
              <div className="flex-col gap-4">
                <span className="text-bold">
                  {name}
                  <span style={{ color: tier.color, fontSize: 12, marginLeft: 6 }}>{tier.name}</span>
                  <span className="text-muted" style={{ fontSize: 12, marginLeft: 6 }}>{ROLE_NAMES[role]}</span>
                </span>
                <span className="text-sm text-muted">
                  战力: {power} | 粮耗: {bl?.food_consumption ?? unit?.food_consumption ?? 0}/天
                  {bl?.culture_zh ? ` | ${bl.culture_zh}` : ""}
                </span>
              </div>
              <div className="flex-col gap-4" style={{ alignItems: "flex-end" }}>
                <span className="text-bold text-gold">x{count}</span>
                <div className="flex-row gap-4">
                  {/* 骑砍2 兵种晋升（优先） */}
                  {bl?.upgrade_targets && bl.upgrade_targets.length > 0 ? (
                    bl.upgrade_targets.map((tid: string) => (
                      <button key={tid} style={{ fontSize: "12px", padding: "4px 8px" }} onClick={() => performAction(upgrade_bannerlord_unit, uId, 1, tid)}>
                        晋升 → {(BANNERLORD_TROOPS as any)[tid]?.name ?? tid}（{bl.upgrade_cost ?? 0}金）
                      </button>
                    ))
                  ) : unit?.upgrade_targets && unit.upgrade_targets.length > 0 ? (
                    unit.upgrade_targets.map((tid: string) => (
                      <button key={tid} style={{ fontSize: "12px", padding: "4px 8px" }} onClick={() => performAction(upgrade_unit, uId, 1, tid)}>
                        晋升 → {UNITS[tid]?.name ?? tid}
                      </button>
                    ))
                  ) : unit?.upgrade_to ? (
                    <button style={{ fontSize: "12px", padding: "4px 8px" }} onClick={() => performAction(upgrade_unit, uId, 1)}>
                      晋升 → {UNITS[unit.upgrade_to]?.name}
                    </button>
                  ) : null}
                  <button
                    className="secondary"
                    style={{ fontSize: "12px", padding: "4px 8px" }}
                    onClick={() => performAction(dismiss_troops, uId, 1)}
                  >
                    遣散 1
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {totalTroops === 0 && <div className="text-muted text-sm">你的队伍中没有任何士兵</div>}
      </div>

      {/* 俘虏管理 */}
      <div className="panel">
        <div className="panel-title"><Ban size={22} /> 俘虏（{prisonerCount}）</div>
        {prisonerCount === 0 ? (
          <div className="text-muted text-sm">
            尚无俘虏。击败敌军后可捕获，也可在奴隶市场买卖。
          </div>
        ) : (
          <>
            {Object.entries(prisoners).map(([uId, count]: [string, number]) => {
              const bl = (BANNERLORD_TROOPS as any)[uId];
              const unit = UNITS[uId];
              const name = bl?.name ?? unit?.name ?? uId;
              const value = bl?.prisoner_value ?? unit?.prisoner_value ?? 5;
              return (
                <div key={uId} className="list-item">
                  <div className="flex-col gap-4">
                    <span className="text-bold">{name}</span>
                    <span className="text-sm text-muted">单价 {value} 金</span>
                  </div>
                  <button
                    style={{ fontSize: "12px", padding: "4px 8px" }}
                    onClick={() => performAction(sell_prisoners, state.location, uId, count)}
                  >
                    全部卖出（{value * count} 金）
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* 同伴 */}
      <div className="panel">
        <div className="panel-title">同伴</div>
        {state.companions.length === 0 ? (
          <div className="text-muted text-sm">尚无同伴加入，前往酒馆可以雇佣同伴</div>
        ) : (
          state.companions.map((cId: string) => {
            const comp2 = COMPANIONS[cId];
            if (!comp2) return null;
            return (
              <div key={cId} className="list-item">
                <div className="flex-col gap-4">
                  <span className="text-bold">{comp2.name}</span>
                  <span className="text-sm text-muted">{comp2.greeting}</span>
                </div>
                <div className="text-sm text-gold">
                  {comp2.bonus_type} +{comp2.bonus_value}
                  {comp2.likes_fishing && <span className="text-muted"> | 喜欢钓鱼</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
