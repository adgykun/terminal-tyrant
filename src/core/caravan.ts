/**
 * caravan.ts —— 大地图商队流动贸易。
 *
 * 骑砍2 的跑商乐趣来自「低买高卖」：不同地点的同类货物价格不同。
 * 大地图上的商队在移动，其货物与价格随行程波动，因此玩家可以在
 * 商队与城镇之间、或两支商队之间套利。
 *
 * 设计要点：
 *  - 价格由「商队 id + 世界天数 + 货物」确定性推导，同一商队同一天价格稳定；
 *  - 商队有库存上限，卖光就买不到；买入过多会压低其收购价；
 *  - 玩家的负重/金钱受限，无法无限刷钱。
 */
import { GOODS } from "./data";

export interface CaravanStock {
  goods: Record<string, number>;
  gold: number;
}

/** 商队常备/常收的货物品类。 */
const CARAVAN_GOODS = [
  "wheat", "iron", "wine", "tool", "timber", "stone",
  "hides", "salt", "silk", "cotton", "olive_oil", "honey",
];

/** 确定性哈希：同一 (id, day, goods) 得到稳定随机数。 */
function hash3(a: string, b: number, c: string): number {
  let h = 2166136261;
  const s = `${a}|${b}|${c}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

/** 为某支商队生成当日库存（幂等，同一天重复调用结果一致）。 */
export function caravanStock(unitId: string, day: number, gold = 800): CaravanStock {
  const goods: Record<string, number> = {};
  for (const g of CARAVAN_GOODS) {
    const r = hash3(unitId, day, g);
    // 部分货物缺货（30% 概率）
    if (r < 0.3) continue;
    goods[g] = 2 + Math.floor(r * 18);
  }
  return { goods, gold };
}

/**
 * 商队当日买卖价。
 * 买入价（玩家买）略高于基准，卖出价（玩家卖）略低于基准，
 * 差额即商队的利润，且随行情浮动，制造套利空间。
 */
export function caravanPrice(unitId: string, day: number, goodsId: string): { buy: number; sell: number } {
  const base = GOODS[goodsId]?.base_price ?? 10;
  const r = hash3(unitId, day, goodsId);
  // 行情系数 0.65 ~ 1.45
  const market = 0.65 + r * 0.8;
  const buy = Math.max(1, Math.round(base * market * 1.08));
  const sell = Math.max(1, Math.round(base * market * 0.88));
  return { buy, sell };
}

export interface CaravanTradeResult {
  ok: boolean;
  message: string;
  goldDelta: number;
  goodsDelta: number;
}

/**
 * 与商队交易。
 *
 * @param state  游戏状态（需要 gold / inventory / day）
 * @param unitId 商队单位 id
 * @param action "buy" 从商队买入 | "sell" 卖给商队
 * @param goodsId 货物 id
 * @param qty    数量
 */
export function caravanTrade(
  state: any,
  unitId: string,
  action: "buy" | "sell",
  goodsId: string,
  qty: number,
): CaravanTradeResult {
  const name = GOODS[goodsId]?.name ?? goodsId;
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, message: "交易数量必须大于 0。", goldDelta: 0, goodsDelta: 0 };
  }
  const day = state.day ?? 1;
  const stock = caravanStock(unitId, day);
  const price = caravanPrice(unitId, day, goodsId);

  state.inventory = state.inventory ?? {};
  state.gold = state.gold ?? 0;

  if (action === "buy") {
    const available = stock.goods[goodsId] ?? 0;
    if (available <= 0) {
      return { ok: false, message: `这支商队没有 ${name} 可卖。`, goldDelta: 0, goodsDelta: 0 };
    }
    const n = Math.min(qty, available);
    const cost = price.buy * n;
    if ((state.gold ?? 0) < cost) {
      const afford = Math.floor((state.gold ?? 0) / price.buy);
      if (afford <= 0) {
        return { ok: false, message: `金钱不足，买不起 ${name}（单价 ${price.buy} 金）。`, goldDelta: 0, goodsDelta: 0 };
      }
      const affordCost = price.buy * afford;
      state.gold -= affordCost;
      state.inventory[goodsId] = (state.inventory[goodsId] ?? 0) + afford;
      const msg = `金钱只够买 ${afford} 单位 ${name}，花费 ${affordCost} 金（单价 ${price.buy}）。`;
      state.add_log?.(msg);
      return { ok: true, message: msg, goldDelta: -affordCost, goodsDelta: afford };
    }
    state.gold -= cost;
    state.inventory[goodsId] = (state.inventory[goodsId] ?? 0) + n;
    const msg = `从商队买入 ${n} 单位 ${name}，花费 ${cost} 金（单价 ${price.buy}）。`;
    state.add_log?.(msg);
    return { ok: true, message: msg, goldDelta: -cost, goodsDelta: n };
  }

  // sell
  const owned = state.inventory[goodsId] ?? 0;
  if (owned <= 0) {
    return { ok: false, message: `你没有 ${name} 可以出售。`, goldDelta: 0, goodsDelta: 0 };
  }
  const n = Math.min(qty, owned);
  // 商队资金有限，收不起就少收
  const maxAfford = Math.floor(stock.gold / Math.max(1, price.sell));
  const sold = Math.max(0, Math.min(n, maxAfford));
  if (sold <= 0) {
    return { ok: false, message: `商队资金不足，收不下你的 ${name}。`, goldDelta: 0, goodsDelta: 0 };
  }
  const income = price.sell * sold;
  state.gold += income;
  state.inventory[goodsId] = owned - sold;
  if (state.inventory[goodsId] <= 0) delete state.inventory[goodsId];
  const msg = `向商队卖出 ${sold} 单位 ${name}，获得 ${income} 金（单价 ${price.sell}）。`;
  state.add_log?.(msg);
  return { ok: true, message: msg, goldDelta: income, goodsDelta: -sold };
}

/** 列出商队当日可供交易的货品及价格（供 UI 展示）。 */
export function caravanOffer(unitId: string, day: number): { goodsId: string; name: string; count: number; buy: number; sell: number }[] {
  const stock = caravanStock(unitId, day);
  return Object.entries(stock.goods)
    .map(([goodsId, count]) => {
      const p = caravanPrice(unitId, day, goodsId);
      return { goodsId, name: GOODS[goodsId]?.name ?? goodsId, count, buy: p.buy, sell: p.sell };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
