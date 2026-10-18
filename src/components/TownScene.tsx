import type { GameState } from "../core/state";
import { GOODS, UNITS, EQUIPMENT, FACILITY_NAMES } from "../core/data";
import {
  get_current_location,
  init_region,
  exit_region,
  rest,
  trade,
  recruit,
  visit_tavern,
  tournament_battle,
  hire_mercenary,
  defend_siege,
  visit_smithy,
  visit_arena,
  gamble_dice,
  fish,
  sell_fish,
  buy_gear,
} from "../core/engine";
import { get_region } from "../core/world_regions";
import SlotMachine from "./SlotMachine";
import { Castle, Coins, Sword, Beer, Dices, Wrench, Fish, Bed, ArrowLeft, Users } from "lucide-react";

interface TownSceneProps {
  state: GameState;
  performAction: (action: (...args: any[]) => any, ...args: any[]) => any;
  setView: (view: any) => void;
}

const locTypeLabel: Record<string, string> = {
  village: "村庄",
  town: "城镇",
  port: "港口",
  wild: "野外",
  pass: "关隘",
};

/**
 * 双形态设施判断：兼容经典地点的布尔/数组字段（arena / tavern / slave_market）
 * 与生成地点的 facilities(string[]) 数组。
 * 规则：先查 location 上有没有同名布尔或数组字段，再查 facilities 数组。
 */
function town_has(loc: any, name: string): boolean {
  const flag = loc?.[name];
  if (typeof flag === "boolean") return flag;
  if (Array.isArray(flag)) return flag.length > 0;
  if (Array.isArray(loc?.facilities)) return loc.facilities.includes(name);
  return false;
}

export function TownScene({ state, performAction, setView }: TownSceneProps) {
  const loc: any = get_current_location(state);
  if (!loc) {
    // 地点悬空（常见于老存档缺 region_locations）：给自救选项，而不是静默踢回大地图
    return (
      <div className="panel">
        <div className="panel-title"><Castle size={22} /> 城镇</div>
        <div className="text-muted text-sm">
          当前地点数据缺失（{state.location ?? "未知"}）。
        </div>
        <div className="flex-col gap-8 mt-12">
          {state.selected_region && (
            <button
              className="secondary"
              onClick={() => performAction(init_region, state.selected_region, true)}
            >
              重新生成当前区域
            </button>
          )}
          <button className="primary" onClick={() => performAction(exit_region, "oak_village")}>
            返回大地图
          </button>
        </div>
      </div>
    );
  }

  const region = state.selected_region ? get_region(state.selected_region) : null;
  const goodsIds = Object.keys(loc.market ?? {});
  const barracksUnits = loc.barracks ?? [];
  const hasTavern = town_has(loc, "tavern");
  const hasArena = town_has(loc, "arena");
  const hasSlaveMarket = town_has(loc, "slave_market");
  const facilities: string[] = loc.facilities ?? [];
  const hasSmithy = town_has(loc, "forge");
  const isPort = loc.type === "port";
  const siegeThreat = (state.ai_sieges ?? []).find((t: any) => t.location_id === loc.id);
  return (
    <div>
      <div className="panel">
        <div className="panel-title">
          <Castle size={22} /> {region ? `${region.name} · ` : ""}{loc.name}
        </div>
        <div className="text-sm text-secondary mb-12">
          {locTypeLabel[loc.type] ?? loc.type}
          {loc.faction_id && ` · 隶属 ${loc.faction_id}`}
        </div>
        <button className="primary" onClick={() => setView("map")}>
          <ArrowLeft size={16} style={{ display: "inline", marginRight: "4px" }} />返回大地图
        </button>
        {siegeThreat && (
          <div className="mt-12" style={{ background: "rgba(200,40,40,0.15)", border: "1px solid #b33", borderRadius: 8, padding: "10px 12px" }}>
            <div className="text-bold" style={{ color: "#f66" }}>⚔ 城池被围攻！</div>
            <div className="text-sm text-secondary mt-4">
              敌国大军围攻中（剩 {siegeThreat.days_remaining} 天），你可以 <b>守城迎战</b> 拯救此城；
              逾期未守将城池易主。
            </div>
            <div className="flex-row gap-8 mt-8">
              <button className="primary" onClick={() => performAction(defend_siege, loc.id)}>⚔ 守城迎战</button>
            </div>
          </div>
        )}
      </div>

      {goodsIds.length > 0 && (
        <div className="panel">
          <div className="panel-title"><Coins size={22} /> 市场</div>
          <div className="card-grid">
            {goodsIds.map((gid) => {
              const info = loc.market[gid];
              const owned = state.inventory[gid] ?? 0;
              return (
                <div key={gid} className="card">
                  <div className="card-title">
                    {GOODS[gid]?.name ?? gid}
                    <span className="text-muted text-sm"> ×{owned}</span>
                  </div>
                  <div className="card-desc text-sm mb-8">
                    买 {info.buy_price} / 卖 {info.sell_price} 金
                  </div>
                  <div className="flex-row gap-8">
                    <button className="primary" onClick={() => performAction(trade, state.location, "buy", gid, 1)}>买 1</button>
                    <button className="secondary" onClick={() => performAction(trade, state.location, "sell", gid, 1)} disabled={owned < 1}>卖 1</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {barracksUnits.length > 0 && (
        <div className="panel">
          <div className="panel-title"><Sword size={22} /> 兵营</div>
          <div className="card-grid">
            {barracksUnits.map((uid: string) => {
              const u = UNITS[uid];
              if (!u) return null;
              const count = state.troops[uid] ?? 0;
              return (
                <div key={uid} className="card">
                  <div className="card-title">{u.name}<span className="text-muted text-sm"> ×{count}</span></div>
                  <div className="card-desc text-sm mb-8">招募 {u.recruit_cost} 金 · 战力 {u.power}</div>
                  <button className="primary" onClick={() => performAction(recruit, state.location, uid, 1)}>招募 1</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(hasTavern || hasArena || hasSmithy || hasSlaveMarket || isPort) && (
        <div className="panel">
          <div className="panel-title"><Users size={22} /> 设施与人物</div>
          <div className="flex-col gap-12">
            {hasTavern && (
              <div>
                <div className="text-bold mb-8"><Beer size={16} style={{ display: "inline", marginRight: "6px" }} />酒馆</div>
                <div className="flex-row gap-8">
                  <button className="primary" onClick={() => performAction(visit_tavern, "drink", 20)}>喝酒（-20 金）</button>
                  <button className="secondary" onClick={() => performAction(visit_tavern, "rumor")}>打听传闻</button>
                  <button className="secondary" onClick={() => performAction(hire_mercenary, "eastern_mercenary", 1)}>雇东方雇佣兵（{UNITS.eastern_mercenary?.recruit_cost ?? 150} 金）</button>
                  <button className="secondary" onClick={() => performAction(hire_mercenary, "western_mercenary", 1)}>雇西方雇佣兵（{UNITS.western_mercenary?.recruit_cost ?? 150} 金）</button>
                </div>
                <div className="mt-12">
                  <SlotMachine cash={state.cash} performAction={performAction} />
                </div>
              </div>
            )}
            {hasArena && (
              <div>
                <div className="text-bold mb-8"><Sword size={16} style={{ display: "inline", marginRight: "6px" }} />竞技场</div>
                <div className="flex-row gap-8">
                  <button className="primary" onClick={() => performAction(visit_arena, "fight")}>挑战比武</button>
                  <button className="secondary" onClick={() => performAction(visit_arena, "bet", 50)}>下注（-50 金）</button>
                  <button className="primary" onClick={() => performAction(tournament_battle, state.location)}>竞技大会（多轮淘汰）</button>
                </div>
              </div>
            )}
            {hasSmithy && (
              <div>
                <div className="text-bold mb-8"><Wrench size={16} style={{ display: "inline", marginRight: "6px" }} />{FACILITY_NAMES["forge"] ?? "铁匠"} </div>
                <button className="primary" onClick={() => performAction(visit_smithy, "upgrade")}>装备升级</button>
              </div>
            )}
            {hasSlaveMarket && (
              <div>
                <div className="text-bold mb-8"><Users size={16} style={{ display: "inline", marginRight: "6px" }} />奴隶市场</div>
                <div className="text-sm text-secondary">可买卖 / 处理战俘。</div>
              </div>
            )}
            {isPort && (
              <div>
                <div className="text-bold mb-8"><Fish size={16} style={{ display: "inline", marginRight: "6px" }} />渔场</div>
                <div className="flex-row gap-8">
                  <button className="primary" onClick={() => performAction(fish, state.location)}>捕鱼</button>
                  {state.fish_inventory && Object.keys(state.fish_inventory).length > 0 && (
                    <button className="secondary" onClick={() => performAction(sell_fish, Object.keys(state.fish_inventory)[0], 1)}>卖出渔获</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">行动</div>
        <div className="flex-row gap-8" style={{ flexWrap: "wrap" }}>
          <button className="primary" onClick={() => performAction(rest)}>
            <Bed size={16} style={{ display: "inline", marginRight: "4px" }} />休息（+士气）
          </button>
          <button className="secondary" onClick={() => performAction(gamble_dice, 20)}>
            <Dices size={16} style={{ display: "inline", marginRight: "4px" }} />赌一把（-20 金）
          </button>
          <button className="ghost" onClick={() => performAction(buy_gear, "w1", 1)}>
            买装备
          </button>
        </div>
      </div>
    </div>
  );
}
