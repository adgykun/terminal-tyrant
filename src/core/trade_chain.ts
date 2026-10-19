/**
 * trade_chain.ts —— 产地-加工-消费价格形成内核。
 *
 * 与 economy.ts（库存供需定价）互补：economy.ts 回答「这家店现在货多货少」，
 * 本模块回答「这个地方为什么天生就该便宜/贵」。
 *
 * 骑砍2 的跑商乐趣来自结构性地利差：
 *   - 山村盛产麦子 → 麦子便宜，但美酒贵（村里没酒坊）；
 *   - 城镇有酒坊   → 美酒便宜，但麦子要运进来所以不便宜；
 *   - 围城/战争    → 商路断绝，物价飙升（危险但暴利）。
 *
 * 价格模型：price = base × 产地系数 × 战争扰动 × 通胀 × 日波动
 */
import { GOODS, LOCATIONS } from "./data";

/** 地形 → 该地盛产的原料。 */
export const TERRAIN_PRODUCTS: Record<string, string[]> = {
  plain: ["wheat", "hides"],
  forest: ["timber", "hides", "honey"],
  mountain: ["iron", "stone"],
  river: ["fish_goods", "salt"],
  coast: ["salt", "fish_goods", "hides"],
  desert: ["salt", "horses"],
  steppe: ["horses", "hides"],
};

/** 原料 → 加工品（工坊配方，与 data.ts RECIPES 对齐）。 */
export const PROCESSING_CHAIN: Record<
  string,
  { output: string; ratio: number; facility: string; facilityName: string }
> = {
  wheat: { output: "wine", ratio: 0.33, facility: "winery", facilityName: "酿酒坊" },
  iron: { output: "tool", ratio: 0.5, facility: "forge", facilityName: "铁匠工坊" },
  cotton: { output: "silk", ratio: 0.33, facility: "loom", facilityName: "织造坊" },
  timber: { output: "tool", ratio: 0.4, facility: "sawmill", facilityName: "锯木场" },
  stone: { output: "tool", ratio: 0.3, facility: "quarry", facilityName: "采石场" },
};

/** 加工品 → 可用原料列表（多个原料可产出同一加工品）。 */
const OUTPUT_TO_RAWS: Record<string, string[]> = {};
for (const [raw, v] of Object.entries(PROCESSING_CHAIN)) {
  (OUTPUT_TO_RAWS[v.output] ??= []).push(raw);
}

/** 贸易环境（战争对价格的扰动）。 */
export interface TradeContext {
  /** 正在被围攻的地点 id 集合。 */
  besiegedLocations?: Set<string>;
  /** 该地点所属势力是否卷入战争。 */
  atWar?: boolean;
  /** 当前世界处于战争的天数（驱动全局通胀）。 */
  warDays?: number;
}

/** 商品在某地的当日价格。 */
export interface GoodsPrice {
  goodsId: string;
  name: string;
  /** 玩家买入价。 */
  buy: number;
  /** 玩家卖出价。 */
  sell: number;
  /** 价格形成原因（供 UI 展示）。 */
  reason: string;
}

/** 确定性伪随机（同一地点同一天价格稳定）。 */
function hashPrice(locId: string, day: number, goodsId: string): number {
  let h = 2166136261;
  const s = `${locId}|${day}|${goodsId}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * 计算某地某商品的当日买卖价。
 */
export function localPrice(locId: string, goodsId: string, day: number, ctx: TradeContext = {}): GoodsPrice {
  const base = GOODS[goodsId]?.base_price ?? 10;
  const name = GOODS[goodsId]?.name ?? goodsId;
  const loc = (LOCATIONS as any)[locId];
  const reasons: string[] = [];
  let multiplier = 1;

  // ── 1. 结构性地利 ──
  if (loc) {
    const products: string[] = TERRAIN_PRODUCTS[loc.terrain_type] ?? [];
    const facilities: string[] = loc.facilities ?? [];

    if (products.includes(goodsId)) {
      // 本地盛产 → 便宜
      multiplier *= 0.55;
      reasons.push("本地盛产");
    }

    const rawsForThis = OUTPUT_TO_RAWS[goodsId];
    if (rawsForThis) {
      // 这是加工品：本地有任一对应工坊即算本地生产
      const facs = rawsForThis.map((r) => PROCESSING_CHAIN[r].facility);
      if (facs.some((f) => facilities.includes(f))) {
        multiplier *= 0.75;
        reasons.push("本地工坊");
      } else if (loc.type === "village") {
        // 村庄没有工坊 → 加工品需外地运入，贵
        multiplier *= 1.5;
        reasons.push("村中无坊");
      }
    }
  }

  // ── 2. 战争扰动 ──
  if (ctx.besiegedLocations?.has(locId)) {
    multiplier *= 2.2;
    reasons.push("围城断商路");
  }
  if (ctx.atWar) {
    multiplier *= 1.3;
    reasons.push("战时运费");
  }

  // ── 3. 全局通胀 ──
  const warDays = ctx.warDays ?? 0;
  if (warDays > 0) {
    const inflation = Math.min(0.5, warDays * 0.004);
    multiplier *= 1 + inflation;
    if (inflation > 0.1) reasons.push("连年战乱");
  }

  // ── 4. 日间波动（±8%，低价商品至少波动 1 金，避免被取整抹平） ──
  const mid = Math.max(1, Math.round(base * multiplier));
  const jitter = 0.92 + hashPrice(locId, day, goodsId) * 0.16;
  const jittered = mid * jitter;
  // 低价商品（mid < 20）在取整后无变化时，用另一个哈希强制 ±1 金波动
  let midFinal = Math.max(1, Math.round(jittered));
  if (mid < 20 && midFinal === mid) {
    midFinal = mid + (hashPrice(locId, day, goodsId + "s") > 0.5 ? 1 : -1);
    if (midFinal < 1) midFinal = mid + 1;
  }
  return {
    goodsId,
    name,
    buy: Math.max(1, Math.round(midFinal * 1.12)),
    sell: Math.max(1, Math.round(midFinal * 0.88)),
    reason: reasons.join("·") || "行市平稳",
  };
}

/** 某地当日低于基准价的商品（跑商进货提示）。 */
export function bestDeals(locId: string, day: number, ctx: TradeContext = {}): GoodsPrice[] {
  return Object.keys(GOODS)
    .map((g) => localPrice(locId, g, day, ctx))
    .filter((p) => p.buy < (GOODS[p.goodsId]?.base_price ?? 10) * 0.85)
    .sort((a, b) => a.buy - b.buy)
    .slice(0, 5);
}

/** 产业链清单（供 UI 展示「原料 → 加工品」）。 */
export function describeChain(): { raw: string; rawName: string; output: string; outputName: string; facilityName: string }[] {
  return Object.entries(PROCESSING_CHAIN).map(([raw, v]) => ({
    raw,
    rawName: GOODS[raw]?.name ?? raw,
    output: v.output,
    outputName: GOODS[v.output]?.name ?? v.output,
    facilityName: v.facilityName,
  }));
}

/**
 * 两地之间的套利空间（买入地 vs 卖出地）。
 * 返回正的表示有利可图。
 */
export function arbitrageSpread(
  buyLocId: string,
  sellLocId: string,
  goodsId: string,
  day: number,
  ctx: TradeContext = {},
): { buy: number; sell: number; profitPerUnit: number; marginPct: number } {
  const a = localPrice(buyLocId, goodsId, day, ctx);
  const b = localPrice(sellLocId, goodsId, day, ctx);
  const profit = b.buy - a.buy;
  return {
    buy: a.buy,
    sell: b.buy,
    profitPerUnit: profit,
    marginPct: a.buy > 0 ? Math.round((profit / a.buy) * 100) : 0,
  };
}
