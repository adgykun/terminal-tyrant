import { BANNERLORD_TROOPS, troopsByCulture } from "./troops_bannerlord";
import { LORDS_BANNERLORD, lordsOfKingdom } from "./lords_bannerlord";
// === 大地图 AI 动态单位（骑砍式活地图） ===

export interface MapUnit {
  id: string;
  x: number;
  y: number;
  faction: string;      // 势力 id（army）或 'caravan'/'bandit'/'npc'
  factionKey?: string;  // army: 八王国主键
  type: "army" | "caravan" | "bandit" | "npc";
  targetX: number;
  targetY: number;
  speed: number;        // 世界单位/秒
  name: string;
  color: string;        // token 主色
  dwell: number;        // 到点停留剩余秒数（>0 时不动）
  troops?: Record<string, number>;  // 骑砍式兵力构成（unit_id → 数量）
  /** 统率这支军团的具名领主（骑砍式：每支野战军都由某位领主带领）。 */
  lordId?: string;
}

// 势力名 → hex（与 FACTION_COLORS 对齐）
// 八王国初始关系（<0 为敌对，用于 AI 军团围城目标选择）
export const KINGDOM_REL: Record<string, Record<string, number>> = {
  empire_n: { empire_w: -50, empire_s: 10, sturgia: -50, vlandia: 20, khuzait: 0, aserai: 10, battania: 20 },
  empire_w: { empire_n: -50, empire_s: -50, sturgia: 20, vlandia: -50, khuzait: 0, aserai: 20, battania: 0 },
  empire_s: { empire_n: 10, empire_w: -50, sturgia: 0, vlandia: 20, khuzait: -50, aserai: -50, battania: 10 },
  sturgia: { empire_n: -50, empire_w: 20, empire_s: 0, vlandia: 0, khuzait: -50, aserai: 0, battania: 20 },
  aserai: { empire_n: 10, empire_w: 20, empire_s: -50, sturgia: 0, vlandia: 0, khuzait: -50, battania: 0 },
  vlandia: { empire_n: 20, empire_w: -50, empire_s: 20, sturgia: 0, aserai: 0, khuzait: 0, battania: -50 },
  battania: { empire_n: 20, empire_w: 0, empire_s: 10, sturgia: 20, aserai: 0, khuzait: 0, vlandia: -50 },
  khuzait: { empire_n: 0, empire_w: 0, empire_s: -50, sturgia: -50, aserai: -50, vlandia: 0, battania: 0 },
};
// 卡拉迪亚 rf 主键 → 八王国主键
export const RF_TO_KINGDOM: Record<string, string> = {
  rf1: "empire_n", rf2: "vlandia", rf3: "aserai", rf4: "battania", rf5: "khuzait", rf6: "sturgia",
};
const FACTION_HEX: Record<string, string> = {
  rf1: "#4a90d9", rf2: "#5cb85c", rf3: "#c0392b", rf4: "#a855f7",
  f1: "#4a90d9", f2: "#5cb85c", f3: "#c0392b", f4: "#a855f7",
  blue: "#4a90d9", green: "#5cb85c", red: "#c0392b", purple: "#a855f7",
};
const CARAVAN_COLOR = "#d9a441";

// === 骑砍2 文化命名 ===
const CULTURE_ARMY_PREFIX: Record<string, string> = {
  empire: "帝国军团", vlandia: "瓦兰迪亚骑士团", aserai: "阿塞莱部族军",
  battania: "巴塔尼亚战团", khuzait: "库赛特汗帐", sturgia: "斯特吉亚勇士团",
};
const CULTURE_BANDIT: Record<string, string> = {
  empire: "帝国逃兵", vlandia: "林中劫匪", aserai: "沙漠强盗",
  battania: "林贼", khuzait: "草原强盗", sturgia: "海寇",
};
// 卡拉迪亚势力 rf1-rf6 → 文化
const FACTION_CULTURE: Record<string, string> = {
  rf1: "empire", rf2: "vlandia", rf3: "aserai",
  rf4: "battania", rf5: "khuzait", rf6: "sturgia",
};
function cultureOf(region: any, factionId?: string): string {
  // 优先用势力 id 映射（卡拉迪亚）
  if (factionId && FACTION_CULTURE[factionId]) return FACTION_CULTURE[factionId];
  return "empire";
}

const BANDIT_COLOR = "#8b4a2f";
const NPC_COLOR = "#6fa8a0";

function mapHex(id: string, name?: string): string {
  return FACTION_HEX[id] || (name ? FACTION_HEX[name] : "") || "#888";
}

function srand(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


// 按文化生成骑砍式兵力构成：新兵多，精锐少（金字塔）
function makeTroopComp(cult: string, rnd: () => number): Record<string, number> {
  const pool: Record<string, string[]> = {
    empire: ["imperial_recruit", "imperial_infantryman", "imperial_archer", "imperial_trained_infantryman"],
    vlandia: ["vlandian_recruit", "vlandian_footman", "vlandian_levy_crossbowman", "vlandian_spearman"],
    aserai: ["aserai_recruit", "aserai_tribesman", "aserai_footman", "aserai_skirmisher"],
    battania: ["battanian_volunteer", "battanian_clanwarrior", "battanian_woodrunner", "battanian_raider"],
    khuzait: ["khuzait_nomad", "khuzait_footman", "khuzait_tribal_warrior", "khuzait_horseman"],
    sturgia: ["sturgian_recruit", "sturgian_warrior", "sturgian_woodsman", "sturgian_soldier"],
  };
  const arr = pool[cult] || pool.empire;
  const comp: Record<string, number> = {};
  const total = 12 + Math.floor(rnd() * 20);
  for (let i = 0; i < arr.length; i++) {
    const w = [0.5, 0.25, 0.15, 0.1][i];
    comp[arr[i]] = Math.max(1, Math.round(total * w));
  }
  return comp;
}

// 生成一批单位：按区域势力数量派生军队，加商队/劫匪/NPC
export function generateMapUnits(
  region: any,
  locations: any[],
  seed: number
): MapUnit[] {
  const rnd = srand(seed + 4242);
  const units: MapUnit[] = [];
  const facts = region?.factions || [];
  const usable = locations.filter((l: any) => typeof l.x === "number");
  if (usable.length === 0) return units;

  const pickLoc = () => usable[Math.floor(rnd() * usable.length)];

  // 军队：每个势力 1-2 支，每支由该王国的一位具名领主统率
  const lordCursor: Record<string, number> = {};
  facts.forEach((f: any, fi: number) => {
    const n = 1 + (rnd() < 0.5 ? 1 : 0);
    const kingdom = RF_TO_KINGDOM[f.id] || f.id;
    const kingdomLords = lordsOfKingdom(kingdom);
    for (let i = 0; i < n; i++) {
      const s = pickLoc();
      const cult = cultureOf(region, f.id);
      const comp = makeTroopComp(cult, rnd);
      const powerSum = Object.entries(comp).reduce((sum, [uid, cnt]) => sum + (BANNERLORD_TROOPS[uid]?.power ?? 1) * cnt, 0);
      const factionKey = kingdom;
      // 轮流分配领主（该王国没有定义领主时退化为通用军团名）
      const idx = lordCursor[kingdom] ?? 0;
      const lord = kingdomLords.length > 0 ? kingdomLords[idx % kingdomLords.length] : null;
      if (lord) lordCursor[kingdom] = idx + 1;
      units.push({
        id: `army_${fi}_${i}_${seed}`,
        x: s.x + (rnd() * 4 - 2), y: s.y + (rnd() * 4 - 2),
        faction: f.id, type: "army",
        factionKey, // 八王国主键（用于敌我判断）
        targetX: 0, targetY: 0, speed: 2.2 + rnd() * 1.2,
        name: lord
          ? `${lord.name}的军团(${powerSum})`
          : `${CULTURE_ARMY_PREFIX[cult] || f.name || "军队"}(${powerSum})`,
        color: mapHex(f.id, f.name), dwell: 0,
        troops: comp,
        lordId: lord?.id,
      });
    }
  });

  // 商队：3 条（走商路）
  for (let i = 0; i < 3; i++) {
    const s = pickLoc();
    units.push({
      id: `caravan_${i}_${seed}`, x: s.x, y: s.y, faction: "caravan", type: "caravan",
      targetX: 0, targetY: 0, speed: 1.6 + rnd(), name: "商队",
      color: CARAVAN_COLOR, dwell: 0,
    });
  }

  // 劫匪：2 伙
  for (let i = 0; i < 2; i++) {
    const s = pickLoc();
    units.push({
      id: `bandit_${i}_${seed}`, x: s.x + (rnd() * 6 - 3), y: s.y + (rnd() * 6 - 3),
      faction: "bandit", type: "bandit", targetX: 0, targetY: 0,
      speed: 3.0 + rnd() * 1.5, name: CULTURE_BANDIT[cultureOf(region)] || "劫匪", color: BANDIT_COLOR, dwell: 0,
    });
  }

  // NPC（游历者）：3 个
  for (let i = 0; i < 3; i++) {
    const s = pickLoc();
    units.push({
      id: `npc_${i}_${seed}`, x: s.x, y: s.y, faction: "npc", type: "npc",
      targetX: 0, targetY: 0, speed: 2.0 + rnd(), name: "旅人", color: NPC_COLOR, dwell: 0,
    });
  }

  // 初始目标
  for (const u of units) assignTarget(u, usable, rnd);
  return units;
}

function enemyLocationsFor(u: MapUnit, usable: any[]): any[] {
  if (u.type !== "army" || !u.factionKey) return [];
  const rel = KINGDOM_REL[u.factionKey] || {};
  return usable.filter((l: any) => {
    const lk = RF_TO_KINGDOM[l.faction_id] || l.faction_id;
    return lk && lk !== u.factionKey && (rel[lk] ?? 0) < 0;
  });
}
function assignTarget(u: MapUnit, usable: any[], rnd: () => number) {
  // 军团：优先敌国地点（围城前线），50% 概率直奔敌城
  if (u.type === "army" && u.factionKey) {
    const enemies = enemyLocationsFor(u, usable);
    if (enemies.length > 0 && rnd() < 0.5) {
      const s = enemies[Math.floor(rnd() * enemies.length)];
      u.targetX = s.x + (rnd() * 6 - 3);
      u.targetY = s.y + (rnd() * 6 - 3);
      return;
    }
  }
  // 80% 去某个地点，20% 去随机野外点
  if (rnd() < 0.8 && usable.length > 0) {
    const s = usable[Math.floor(rnd() * usable.length)];
    u.targetX = s.x; u.targetY = s.y;
  } else {
    const b = usable[0];
    u.targetX = b.x + (rnd() * 30 - 15);
    u.targetY = b.y + (rnd() * 30 - 15);
  }
  u.dwell = 0;
}

// 军团遭遇战已迁移到 lord_ai.ts 的 advanceArmies（真实减员 + 撤退 + 全歼判定）。
// 旧的 resolveArmyClashes 会把败方坐标设为 999 使其凭空消失，已移除。

// 每帧推进（就地修改 units，返回军团战斗消息）
//
// 注意：军团行为已迁移到 lord_ai.ts（意图驱动：驻防/驰援/围城/劫掠/撤退/追击），
// 遭遇战也由 lord_ai 处理（真实减员，不再把坐标设为 999 让单位凭空消失）。
// 本函数现在只负责 商队 / 劫匪 / NPC 等非军团单位的简单游走，
// 军团部分的推进请调用 advanceArmies。
export function advanceUnits(
  units: MapUnit[],
  dt: number,
  usable: any[],
  seed: number
): string[] {
  const msgs: string[] = [];
  const rnd = Math.random;
  for (const u of units) {
    // 军团由 lord_ai.advanceArmies 驱动
    if (u.type === "army") continue;
    // 已被歼灭（兵力归零）的单位跳过
    if (u.troops) {
      const total = Object.values(u.troops).reduce((s, n) => s + n, 0);
      if (total <= 0) continue;
    }
    if (u.dwell > 0) {
      u.dwell -= dt;
      if (u.dwell <= 0) assignTarget(u, usable, rnd);
      continue;
    }
    const dx = u.targetX - u.x, dy = u.targetY - u.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.6) {
      u.dwell = 2 + rnd() * 3;
      continue;
    }
    const step = Math.min(u.speed * dt, d);
    u.x += (dx / d) * step;
    u.y += (dy / d) * step;
  }
  return msgs;
}
