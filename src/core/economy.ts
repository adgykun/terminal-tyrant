/**
 * 动态经济与金融系统模块。
 * 包含：供需定价、生态每日演变、多国货币与汇率、行会契约（期货）、势库券（债券）。
 */

import { GOODS } from "./data";
import { RegionConfig, RegionCurrency } from "./world_regions";
import type { GeneratedLocation } from "./map_generator";

// ===== 供需定价 =====

/** 根据库存量动态计算商品买价 */
export function compute_buy_price(goodId: string, stock: number): number {
  const base = GOODS[goodId]?.base_price ?? 10;
  const scarcity = Math.max(0.3, 2 - stock / 30);
  return Math.ceil(base * scarcity);
}

/** 根据库存量动态计算商品卖价 */
export function compute_sell_price(goodId: string, stock: number): number {
  return Math.floor(compute_buy_price(goodId, stock) * 0.7);
}

/** 玩家买入后更新库存和价格 */
export function apply_buy(
  loc: GeneratedLocation,
  goodId: string,
  quantity: number,
): { newStock: number; totalPrice: number; newBuyPrice: number; newSellPrice: number } {
  const currentStock = loc.stock[goodId] ?? 0;
  let totalCost = 0;
  let stock = currentStock;
  for (let i = 0; i < quantity; i++) {
    stock -= 1;
    totalCost += compute_buy_price(goodId, stock);
  }
  loc.stock[goodId] = stock;
  const newBuyPrice = compute_buy_price(goodId, stock);
  const newSellPrice = compute_sell_price(goodId, stock);
  loc.market[goodId] = { buy_price: newBuyPrice, sell_price: newSellPrice };
  return { newStock: stock, totalPrice: totalCost, newBuyPrice, newSellPrice };
}

/** 玩家卖出后更新库存和价格 */
export function apply_sell(
  loc: GeneratedLocation,
  goodId: string,
  quantity: number,
): { newStock: number; totalRevenue: number; newBuyPrice: number; newSellPrice: number } {
  const currentStock = loc.stock[goodId] ?? 0;
  let totalRevenue = 0;
  let stock = currentStock;
  for (let i = 0; i < quantity; i++) {
    totalRevenue += compute_sell_price(goodId, stock);
    stock += 1;
  }
  loc.stock[goodId] = stock;
  const newBuyPrice = compute_buy_price(goodId, stock);
  const newSellPrice = compute_sell_price(goodId, stock);
  loc.market[goodId] = { buy_price: newBuyPrice, sell_price: newSellPrice };
  return { newStock: stock, totalRevenue, newBuyPrice, newSellPrice };
}

// ===== 生态每日演变 =====

export interface EcologyState {
  forest_coverage: number;
  soil_fertility: number;
  water_quality: number;
}

/** 每日生态自然恢复 */
export function daily_ecology_update(loc: GeneratedLocation): void {
  if (!loc.ecology) return;
  const eco = loc.ecology;
  const terrain = loc.terrain_type;

  const recoveryRate = 0.5;
  const maxForest = terrain === "forest" ? 80 : terrain === "jungle" ? 85 : terrain === "mountain" ? 30 : 20;
  eco.forest_coverage = Math.min(maxForest, eco.forest_coverage + recoveryRate);
  eco.soil_fertility = Math.min(100, eco.soil_fertility + recoveryRate * 0.3);
  eco.water_quality = Math.min(100, eco.water_quality + recoveryRate * 0.2);

  if (eco.forest_coverage < 15 && terrain === "forest") {
    loc.terrain_type = "plain";
  }
}

/** 砍伐森林获取木材 */
export function harvest_timber(loc: GeneratedLocation, amount: number): { timber: number; ecological_damage: number } {
  if (!loc.ecology) return { timber: 0, ecological_damage: 0 };
  const available = Math.floor(loc.ecology.forest_coverage / 5);
  const actual = Math.min(amount, available);
  loc.ecology.forest_coverage = Math.max(0, loc.ecology.forest_coverage - actual * 5);
  loc.ecology.soil_fertility = Math.max(0, loc.ecology.soil_fertility - actual * 0.5);
  loc.ecology.water_quality = Math.max(0, loc.ecology.water_quality - actual * 0.3);
  loc.stock.timber = (loc.stock.timber ?? 0) + actual;
  return { timber: actual, ecological_damage: actual * 5 };
}

// ===== 每日市场模拟 =====

/** 模拟各地物资流动与价格调整 */
export function daily_market_simulation(locations: Record<string, GeneratedLocation>): void {
  for (const loc of Object.values(locations)) {
    if (!loc.stock) continue;

    for (const [goodId, prodRate] of Object.entries(loc.production)) {
      loc.stock[goodId] = (loc.stock[goodId] ?? 0) + prodRate;
    }

    for (const [goodId, consRate] of Object.entries(loc.consumption)) {
      loc.stock[goodId] = Math.max(0, (loc.stock[goodId] ?? 0) - consRate);
    }

    const allGoods = new Set([...Object.keys(loc.production), ...Object.keys(loc.consumption)]);
    for (const goodId of allGoods) {
      const stock = loc.stock[goodId] ?? 0;
      loc.market[goodId] = {
        buy_price: compute_buy_price(goodId, stock),
        sell_price: compute_sell_price(goodId, stock),
      };
    }

    daily_ecology_update(loc);
  }

  simulate_trade_flows(locations);
}

/** 模拟相邻地点之间的贸易流动 */
function simulate_trade_flows(locations: Record<string, GeneratedLocation>): void {
  const flowChance = 0.3;
  for (const loc of Object.values(locations)) {
    if (Math.random() > flowChance) continue;
    const neighbors = loc.neighbors.map(id => locations[id]).filter(Boolean);
    if (neighbors.length === 0) continue;

    for (const [goodId] of Object.entries(loc.stock)) {
      const myStock = loc.stock[goodId] ?? 0;
      if (myStock < 5) continue;

      const target = neighbors[Math.floor(Math.random() * neighbors.length)];
      const targetStock = target.stock[goodId] ?? 0;
      if (myStock > targetStock + 5) {
        const flowAmount = Math.min(3, Math.floor((myStock - targetStock) / 4));
        if (flowAmount > 0) {
          loc.stock[goodId] = myStock - flowAmount;
          target.stock[goodId] = targetStock + flowAmount;
        }
      }
    }
  }
}

// ===== 多国货币与汇率 =====

export interface CurrencyState {
  /** 货币ID → 持有量 */
  holdings: Record<string, number>;
  /** 货币ID → 当前对基础金币的汇率 */
  rates: Record<string, number>;
}

/** 初始化货币状态 */
export function init_currency_state(region: RegionConfig): CurrencyState {
  const holdings: Record<string, number> = {};
  const rates: Record<string, number> = {};
  for (const c of region.currencies) {
    holdings[c.id] = 0;
    rates[c.id] = c.base_rate;
  }
  const primary = region.currencies[0];
  if (primary) {
    holdings[primary.id] = 100;
  }
  return { holdings, rates };
}

/** 获取当前汇率 */
export function get_exchange_rate(currencyState: CurrencyState, fromId: string, toId: string): number {
  const fromRate = currencyState.rates[fromId] ?? 1;
  const toRate = currencyState.rates[toId] ?? 1;
  return fromRate / toRate;
}

/** 货币兑换 */
export function exchange_currency(
  currencyState: CurrencyState,
  fromId: string,
  toId: string,
  amount: number,
): { success: boolean; received: number; message: string } {
  const held = currencyState.holdings[fromId] ?? 0;
  if (held < amount) {
    return { success: false, received: 0, message: `持有${fromId}不足，无法兑换` };
  }
  const rate = get_exchange_rate(currencyState, fromId, toId);
  const fee = 0.05;
  const received = Math.floor(amount * rate * (1 - fee));
  currencyState.holdings[fromId] = held - amount;
  currencyState.holdings[toId] = (currencyState.holdings[toId] ?? 0) + received;
  return {
    success: true,
    received,
    message: `兑换 ${amount} ${fromId} → ${received} ${toId}（汇率 ${rate.toFixed(2)}, 手续费 5%）`,
  };
}

/** 每日汇率波动 */
export function daily_currency_update(currencyState: CurrencyState, region: RegionConfig): void {
  for (const c of region.currencies) {
    const current = currencyState.rates[c.id] ?? c.base_rate;
    const volatility = 0.02;
    const change = (Math.random() - 0.5) * volatility * 2;
    currencyState.rates[c.id] = Math.max(0.3, current * (1 + change));
  }
}

/** 将一种货币的金额换算为基础金币 */
export function to_base_gold(currencyState: CurrencyState, currencyId: string, amount: number): number {
  const rate = currencyState.rates[currencyId] ?? 1;
  return Math.floor(amount * rate);
}

// ===== 金融系统：行会契约（期货） =====

export interface FuturesContract {
  id: string;
  good_id: string;
  good_name: string;
  delivery_day: number;
  quantity: number;
  buy_price: number;
  location_id: string;
  faction_id: string;
  settled: boolean;
  profit?: number;
}

let _futures_id = 1;

/** 生成可用的行会契约列表 */
export function generate_futures_contracts(
  currentDay: number,
  locations: Record<string, GeneratedLocation>,
  region: RegionConfig,
): FuturesContract[] {
  const contracts: FuturesContract[] = [];
  const tradeGoods = Object.keys(GOODS);
  const count = randomInt(3, 6);

  for (let i = 0; i < count; i++) {
    const goodId = tradeGoods[Math.floor(Math.random() * tradeGoods.length)];
    const locIds = Object.keys(locations);
    const locId = locIds[Math.floor(Math.random() * locIds.length)];
    const loc = locations[locId];
    if (!loc) continue;

    const base = GOODS[goodId]?.base_price ?? 10;
    const currentStock = loc.stock[goodId] ?? 20;
    const currentPrice = compute_buy_price(goodId, currentStock);
    const deliveryDays = randomInt(3, 10);
    const priceFluctuation = 0.7 + Math.random() * 0.6;
    const contractPrice = Math.ceil(currentPrice * priceFluctuation);
    const qty = randomInt(5, 20);

    contracts.push({
      id: `futures_${_futures_id++}`,
      good_id: goodId,
      good_name: GOODS[goodId]?.name ?? goodId,
      delivery_day: currentDay + deliveryDays,
      quantity: qty,
      buy_price: contractPrice,
      location_id: locId,
      faction_id: loc.faction_id,
      settled: false,
    });
  }

  return contracts;
}

/** 结算到期的行会契约 */
export function settle_futures(
  contracts: FuturesContract[],
  currentDay: number,
  locations: Record<string, GeneratedLocation>,
): { totalProfit: number; settled: FuturesContract[] } {
  let totalProfit = 0;
  const settled: FuturesContract[] = [];

  for (const c of contracts) {
    if (c.settled || c.delivery_day > currentDay) continue;
    const loc = locations[c.location_id];
    if (!loc) continue;
    const stock = loc.stock[c.good_id] ?? 0;
    const marketPrice = compute_sell_price(c.good_id, stock);
    const revenue = marketPrice * c.quantity;
    const cost = c.buy_price * c.quantity;
    const profit = revenue - cost;
    c.settled = true;
    c.profit = profit;
    totalProfit += profit;
    settled.push(c);
  }

  return { totalProfit, settled };
}

// ===== 金融系统：势库券（债券） =====

export interface GovernmentBond {
  id: string;
  faction_id: string;
  faction_name: string;
  issue_day: number;
  maturity_day: number;
  principal: number;
  interest_rate: number;
  total_interest_earned: number;
  defaulted: boolean;
  settled: boolean;
}

let _bond_id = 1;

/** 生成可购买的势库券 */
export function generate_bonds(
  currentDay: number,
  region: RegionConfig,
): GovernmentBond[] {
  const bonds: GovernmentBond[] = [];
  for (const faction of region.factions) {
    const principal = randomInt(200, 800);
    const interestRate = 0.02 + Math.random() * 0.06;
    const maturityDays = randomInt(10, 30);
    bonds.push({
      id: `bond_${_bond_id++}`,
      faction_id: faction.id,
      faction_name: faction.name,
      issue_day: currentDay,
      maturity_day: currentDay + maturityDays,
      principal,
      interest_rate: interestRate,
      total_interest_earned: 0,
      defaulted: false,
      settled: false,
    });
  }
  return bonds;
}

/** 每日结算债券利息 */
export function daily_bond_interest(bonds: GovernmentBond[], currentDay: number): { totalInterest: number; matured: GovernmentBond[] } {
  let totalInterest = 0;
  const matured: GovernmentBond[] = [];

  for (const b of bonds) {
    if (b.settled || b.defaulted) continue;
    if (b.maturity_day <= currentDay) {
      const dailyInterest = Math.floor(b.principal * b.interest_rate);
      b.total_interest_earned += dailyInterest;
      totalInterest += dailyInterest;
      b.settled = true;
      matured.push(b);
    } else {
      const dailyInterest = Math.floor(b.principal * b.interest_rate);
      b.total_interest_earned += dailyInterest;
      totalInterest += dailyInterest;
    }
  }

  return { totalInterest, matured };
}

/** 检查势力是否违约（势力战败时触发） */
export function check_bond_default(bonds: GovernmentBond[], defeatedFactionId: string): GovernmentBond[] {
  const defaulted: GovernmentBond[] = [];
  for (const b of bonds) {
    if (b.settled || b.defaulted) continue;
    if (b.faction_id === defeatedFactionId) {
      b.defaulted = true;
      defaulted.push(b);
    }
  }
  return defaulted;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
