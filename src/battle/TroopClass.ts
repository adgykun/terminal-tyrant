/**
 * TroopClass —— 兵种战斗/外观参数推导（纯函数，零 core 依赖）。
 *
 * 由 BattleView 从 UNITS[uid].power 取值传入，这里只做推导：
 *  - 骑兵：更快、更大、攻击距离更长；
 *  - 弓手：更瘦长、略快、攻速略慢；
 *  - 精英：血厚攻高；
 *  - 低阶（power<=1）：更小更慢更弱。
 */
export interface TroopSpec {
  name: string;
  radius: number;
  height: number;
  speed: number;
  damage: number;
  hp: number;
  range: number;
  cooldown: number;
}

export function getTroopSpec(unitId: string, power: number): TroopSpec {
  const id = unitId.toLowerCase();
  const isCavalry = /cavalry|horseman|raider|khuzait|lancer|mounted|vanguard/.test(id);
  const isArcher = /archer|crossbow|bow|ranged|fian/.test(id);
  const isElite = /elite|veteran|guard|knight|legion|heavy|noble|hero/.test(id);

  let speed = 2.8 + power * 0.55;
  let damage = 6 + power * 4;
  let hp = 60 + power * 40;
  let radius = 0.45;
  let height = 1.1;
  let range = 1.2;
  let cooldown = 0.9;

  if (isCavalry) {
    speed += 1.2;
    range = 1.7;
    radius = 0.55;
    height = 1.45;
    hp += 40;
    damage += 4;
  }
  if (isArcher) {
    speed += 0.5;
    radius = 0.36;
    height = 1.05;
    range = 1.35;
    damage -= 2;
    cooldown = 1.0;
  }
  if (isElite) {
    speed += 0.3;
    damage += 6;
    hp += 60;
    radius += 0.02;
  }
  if (power <= 1) {
    radius = 0.38;
    height = 0.9;
    speed -= 0.5;
  }

  return { name: unitId, radius, height, speed, damage, hp, range, cooldown };
}