// === 大地图 AI 动态单位（骑砍式活地图） ===

export interface MapUnit {
  id: string;
  x: number;
  y: number;
  faction: string;
  type: "army" | "caravan" | "bandit" | "npc";
  targetX: number;
  targetY: number;
  speed: number;
  name: string;
  color: string;
  dwell: number;
}

const FACTION_HEX: Record<string, string> = {
  rf1: "#4a90d9", rf2: "#5cb85c", rf3: "#c0392b", rf4: "#a855f7",
  f1: "#4a90d9", f2: "#5cb85c", f3: "#c0392b", f4: "#a855f7",
  blue: "#4a90d9", green: "#5cb85c", red: "#c0392b", purple: "#a855f7",
};
const CARAVAN_COLOR = "#d9a441";
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

  facts.forEach((f: any, fi: number) => {
    const n = 1 + (rnd() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const s = pickLoc();
      units.push({
        id: `army_${fi}_${i}_${seed}`,
        x: s.x + (rnd() * 4 - 2), y: s.y + (rnd() * 4 - 2),
        faction: f.id, type: "army",
        targetX: 0, targetY: 0, speed: 2.2 + rnd() * 1.2,
        name: f.name || "军队", color: mapHex(f.id, f.name), dwell: 0,
      });
    }
  });

  for (let i = 0; i < 3; i++) {
    const s = pickLoc();
    units.push({
      id: `caravan_${i}_${seed}`, x: s.x, y: s.y, faction: "caravan", type: "caravan",
      targetX: 0, targetY: 0, speed: 1.6 + rnd(), name: "商队",
      color: CARAVAN_COLOR, dwell: 0,
    });
  }

  for (let i = 0; i < 2; i++) {
    const s = pickLoc();
    units.push({
      id: `bandit_${i}_${seed}`, x: s.x + (rnd() * 6 - 3), y: s.y + (rnd() * 6 - 3),
      faction: "bandit", type: "bandit", targetX: 0, targetY: 0,
      speed: 3.0 + rnd() * 1.5, name: "劫匪", color: BANDIT_COLOR, dwell: 0,
    });
  }

  for (let i = 0; i < 3; i++) {
    const s = pickLoc();
    units.push({
      id: `npc_${i}_${seed}`, x: s.x, y: s.y, faction: "npc", type: "npc",
      targetX: 0, targetY: 0, speed: 2.0 + rnd(), name: "旅人", color: NPC_COLOR, dwell: 0,
    });
  }

  for (const u of units) assignTarget(u, usable, rnd);
  return units;
}

function assignTarget(u: MapUnit, usable: any[], rnd: () => number) {
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

export function advanceUnits(
  units: MapUnit[],
  dt: number,
  usable: any[]
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
      u.dwell = 2 + rnd() * 3;
      continue;
    }
    const step = Math.min(u.speed * dt, d);
    u.x += (dx / d) * step;
    u.y += (dy / d) * step;
  }
}
