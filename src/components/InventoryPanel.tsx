import type { GameState } from "../core/state";
import { GOODS, FISH_LOOT_TABLE, FISHING_GEAR } from "../core/data";
import { Backpack, Package } from "lucide-react";

interface InventoryPanelProps {
  state: GameState;
  performAction: (action: (...args: any[]) => any, ...args: any[]) => any;
}

export function InventoryPanel({ state }: InventoryPanelProps) {
  const goodsEntries = Object.entries(state.inventory).filter(([, v]: [string, any]) => v > 0);
  const fishEntries = Object.entries(state.fish_inventory ?? {}).filter(([, v]: [string, any]) => v > 0);
  const lootEntries = state.loot ?? [];

  return (
    <div>
      <div className="panel">
        <div className="panel-title"><Package size={22} /> 商品库存</div>
        {goodsEntries.length === 0 ? (
          <div className="text-muted text-sm">背包中没有商品</div>
        ) : (
          goodsEntries.map(([gId, count]: [string, number]) => {
            const good = GOODS[gId];
            return (
              <div key={gId} className="list-item">
                <span className="text-bold">{good?.name ?? gId}</span>
                <span className="text-sm text-muted">基础价: {good?.base_price ?? 0}金</span>
                <span className="text-bold text-gold">x{count}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="panel">
        <div className="panel-title"><Backpack size={22} /> 钓鱼收获</div>
        <div className="text-sm text-muted mb-8">
          饵料: {state.bait_count ?? 0} | 鱼竿: {state.equipment_gear?.rod ? "有" : "无"}
        </div>
        {fishEntries.length === 0 ? (
          <div className="text-muted text-sm">还没有钓到任何鱼</div>
        ) : (
          fishEntries.map(([fId, count]: [string, number]) => {
            const fish = FISH_LOOT_TABLE[fId];
            return (
              <div key={fId} className="list-item">
                <span className="text-bold">{fish?.name ?? fId}</span>
                <span className="text-sm text-muted">价值: {fish?.value ?? 0}金 | 食物: {fish?.food ?? 0}</span>
                <span className="text-bold text-gold">x{count}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="panel">
        <div className="panel-title">战利品</div>
        {lootEntries.length === 0 ? (
          <div className="text-muted text-sm">没有战利品</div>
        ) : (
          lootEntries.map((item: any, idx: number) => (
            <div key={idx} className="list-item">
              <span className="text-bold">{item.name ?? "未知物品"}</span>
              <span className="text-sm text-muted">{item.type ?? ""}</span>
              <span className="text-gold text-sm">{item.price ?? 0}金</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
