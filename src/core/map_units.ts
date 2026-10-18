import { BANNERLORD_TROOPS, troopsByCulture } from "./troops_bannerlord";
// === 大地图 AI 动态单位（骑砍式活地图） ===

export interface MapUnit {
  id: string;
  x: number;
  y: number;
  faction: string;      // 势力 id（army）或 'caravan'/'bandit'/'npc'
  type: "army" | "caravan" | "bandit" | "npc";
  targetX: number;
  targetY: number;
  speed: number;        // 世界单位/秒
  name: string;
  color: string;        // token 主色
  dwell: number;        // 到点停留剩余秒数（>0 时不动）
  troops?: Record<string, number>;  // 骑砍式兵力构成（unit_id → 数量）
}

// 势力名 → hex（与 FACTION_COLORS 对齐）
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

  // 军队：每个势力 1-2 支
  facts.forEach((f: any, fi: number) => {
    const n = 1 + (rnd() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const s = pickLoc();
      const cult = cultureOf(region, f.id);
      const comp = makeTroopComp(cult, rnd);
      const powerSum = Object.entries(comp).reduce((sum, [uid, cnt]) => sum + (BANNERLORD_TROOPS[uid]?.power ?? 1) * cnt, 0);
      units.push({
        id: `army_${fi}_${i}_${seed}`,
        x: s.x + (rnd() * 4 - 2), y: s.y + (rnd() * 4 - 2),
        faction: f.id, type: "army",
        targetX: 0, targetY: 0, speed: 2.2 + rnd() * 1.2,
        name: `${CULTURE_ARMY_PREFIX[cult] || f.name || "军队"}(${powerSum})`, color: mapHex(f.id, f.name), dwell: 0,
        troops: comp,
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

function assignTarget(u: MapUnit, usable: any[], rnd: () => number) {
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

// 每帧推进（就地修改 units，返回是否需要停止渲染优化用不到）
export function advanceUnits(
  units: MapUnit[],
  dt: number,
  usable: any[],
  seed: number
) {
  const rnd = Math.random;
  for (const u of units) {
    if (u.dwell > 0) {
      u.dwell -= dt;
      if (u.dwell <= 0) assignTarget(u, usable, rnd);
      continue;
    }
    const dx = u.targetX - u.x, dy = u.targetY - u.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.6) {
      // 到达：停留 2-5 秒再换目标
      u.dwell = 2 + rnd() * 3;
      continue;
    }
    const step = Math.min(u.speed * dt, d);
    u.x += (dx / d) * step;
    u.y += (dy / d) * step;
  }
}
