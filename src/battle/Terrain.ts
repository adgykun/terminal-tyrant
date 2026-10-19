/**
 * Terrain.ts —— 战场地形内核（纯逻辑，无渲染依赖）。
 *
 * 骑砍2 的战术深度很大一部分来自地形：
 *  - 高度：居高临下射程更远、命中更高（守城方站城墙即典型场景）；
 *  - 林地：部队减速、远程无法穿过树林射击；
 *  - 河流：阻挡骑兵（步兵可涉水但极慢）。
 *
 * 本模块用「高度场 + 通行开销场」两个采样函数描述地形，
 * 战斗系统通过 heightAt(x,z) 与 speedMulAt(x,z) 查询，无需知道地形怎么画。
 */

export interface TerrainField {
  /** 该点高度（世界单位，0 为平地）。 */
  heightAt(x: number, z: number): number;
  /** 该点通行速度倍率（1 正常，0.5 林地，0.2 涉水）。 */
  speedMulAt(x: number, z: number): number;
  /** 该点是否阻挡远程视线（树林/墙体）。 */
  blocksLineOfSight(x: number, z: number): boolean;
  /** 是否为水域（骑兵无法通过）。 */
  isWater(x: number, z: number): boolean;
  /** 地形势围（用于 AI 决策，如"占据高地"）。 */
  extent: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** 平地地形：无任何修正（默认场景）。 */
export function flatTerrain(): TerrainField {
  return {
    heightAt: () => 0,
    speedMulAt: () => 1,
    blocksLineOfSight: () => false,
    isWater: () => false,
    extent: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 },
  };
}

export interface TerrainFeature {
  type: "hill" | "wood" | "river";
  x: number;
  z: number;
  /** 圆形区域的半径。 */
  radius: number;
  /** hill: 中心高度；river: 河宽半长。 */
  magnitude?: number;
}

/** 高度对射程的加成系数：每单位高度 +4% 射程，上限 +50%。 */
export const HEIGHT_RANGE_BONUS_PER_UNIT = 0.04;
export const HEIGHT_RANGE_BONUS_CAP = 0.5;
/** 高度对命中的加成：每单位高度 +3% 伤害，上限 +30%。 */
export const HEIGHT_DAMAGE_BONUS_PER_UNIT = 0.03;
export const HEIGHT_DAMAGE_BONUS_CAP = 0.3;

/** 林地减速倍率。 */
const WOOD_SPEED_MUL = 0.45;
/** 河流减速倍率（步兵涉水）。 */
const WATER_SPEED_MUL = 0.2;

/**
 * 由一组地形特征构造地形场。
 * 多个特征重叠时取最强效果（高度相加会过度，取最大）。
 */
export function terrainFromFeatures(features: TerrainFeature[]): TerrainField {
  const hills = features.filter((f) => f.type === "hill");
  const woods = features.filter((f) => f.type === "wood");
  const rivers = features.filter((f) => f.type === "river");

  const inside = (f: TerrainFeature, x: number, z: number): number => {
    const dx = x - f.x;
    const dz = z - f.z;
    const r = Math.hypot(dx, dz);
    if (r > f.radius) return 0;
    // 中心 1，边缘 0（平滑衰减）
    return 1 - r / f.radius;
  };

  return {
    extent: {
      minX: -30, maxX: 30, minZ: -30, maxZ: 30,
    },
    heightAt(x, z) {
      let h = 0;
      for (const f of hills) {
        const t = inside(f, x, z);
        if (t > 0) h = Math.max(h, (f.magnitude ?? 4) * t);
      }
      return h;
    },
    speedMulAt(x, z) {
      let mul = 1;
      for (const f of woods) if (inside(f, x, z) > 0.4) mul = Math.min(mul, WOOD_SPEED_MUL);
      for (const f of rivers) if (inside(f, x, z) > 0.4) mul = Math.min(mul, WATER_SPEED_MUL);
      return mul;
    },
    blocksLineOfSight(x, z) {
      for (const f of woods) if (inside(f, x, z) > 0.5) return true;
      return false;
    },
    isWater(x, z) {
      for (const f of rivers) if (inside(f, x, z) > 0.4) return true;
      return false;
    },
  };
}

/** 高度差带来的射程加成倍率（>1 表示射得更远）。 */
export function heightRangeBonus(attackerH: number, targetH: number): number {
  const diff = Math.max(0, attackerH - targetH);
  const bonus = Math.min(HEIGHT_RANGE_BONUS_CAP, diff * HEIGHT_RANGE_BONUS_PER_UNIT);
  return 1 + bonus;
}

/** 高度差带来的伤害加成倍率。 */
export function heightDamageBonus(attackerH: number, targetH: number): number {
  const diff = Math.max(0, attackerH - targetH);
  return 1 + Math.min(HEIGHT_DAMAGE_BONUS_CAP, diff * HEIGHT_DAMAGE_BONUS_PER_UNIT);
}

/**
 * 视线是否被地形阻挡（树林）。
 * 简化实现：只在两点之间的若干采样点判断，不建真正 BVH。
 */
export function hasLineOfSight(field: TerrainField, x0: number, z0: number, x1: number, z1: number): boolean {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.001) return true;
  const steps = Math.max(2, Math.ceil(dist / 1.5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (field.blocksLineOfSight(x0 + dx * t, z0 + dz * t)) return false;
  }
  return true;
}
