/**
 * quest_chains.ts —— 任务链运行时引擎。
 *
 * 让任务板不再是「每次随机掷三个骰子」，而是有因果的故事线：
 *   - 每位玩家同时最多推进 2 条链；
 *   - 任务板上优先出现「已在进行中的链的下一步」（带专属对白）；
 *   - 完成后才解锁后续步骤，并记录到存档。
 *
 * 与 engine.ts 的 generate_quests 协作：
 *   本模块提供 chain_step_quest()，把链步骤转成标准 quest 对象，
 *   generate_quests 优先采用它，不足再用随机模板补齐。
 */
import { QUEST_CHAINS, type QuestChainDef, type QuestStepDef } from "./dialogue";
import { GOODS, LOCATIONS, UNITS } from "./data";

/** 玩家在单条链上的进度。 */
export interface ChainProgress {
  chainId: string;
  /** 已完成步骤的索引（0 起）。 */
  completed: number[];
  /** 当前已接取但未完成的步骤索引（-1 = 未接取）。 */
  activeStep: number;
  /** 该链是否已彻底完成。 */
  finished: boolean;
}

export type ChainState = Record<string, ChainProgress>;

/** 每局最多同时进行的链数。 */
const MAX_ACTIVE_CHAINS = 2;

/** 初始化全部链的进度（幂等）；对不完整/旧的存档结构也会补齐。 */
export function initChainState(state: any): ChainState {
  const existing = state.quest_chains;
  // 必须每条链都有合法结构才算「已初始化」，否则重建（保留旧存档中已有进度）
  const isComplete =
    !!existing &&
    typeof existing === "object" &&
    QUEST_CHAINS.every(
      (c) => existing[c.id] && typeof existing[c.id] === "object" && Array.isArray(existing[c.id].completed),
    );

  if (!isComplete) {
    const fresh: ChainState = {};
    for (const c of QUEST_CHAINS) {
      const prev = existing?.[c.id];
      fresh[c.id] = {
        chainId: c.id,
        completed: Array.isArray(prev?.completed) ? [...prev.completed] : [],
        activeStep: typeof prev?.activeStep === "number" ? prev.activeStep : -1,
        finished: prev?.finished === true,
      };
    }
    state.quest_chains = fresh;
  }
  return state.quest_chains as ChainState;
}

/** 该步骤的下一个待办（未接取且未完成），无则 null。 */
function pendingStep(chain: QuestChainDef, p: ChainProgress): { step: QuestStepDef; index: number } | null {
  for (let i = 0; i < chain.steps.length; i++) {
    if (p.completed.includes(i)) continue;
    if (p.activeStep === i) continue;
    return { step: chain.steps[i], index: i };
  }
  return null;
}

/** 正在进行的链数。 */
function activeChainCount(cs: ChainState): number {
  return Object.values(cs).filter((p) => !p.finished && (p.activeStep >= 0 || p.completed.length > 0)).length;
}

/** 把链步骤转成标准 quest 对象（供任务板展示与 accept/complete 复用）。 */
export function chainStepToQuest(
  chain: QuestChainDef,
  step: QuestStepDef,
  stepIndex: number,
  locationId: string,
  questId: string,
): any {
  const loc = (LOCATIONS as any)[locationId];
  const others = Object.keys(LOCATIONS).filter((l) => l !== locationId);
  // 用地点 id 的哈希做确定性「随机」，保证同一步骤每次生成一致
  const pick = (arr: string[]) => arr[hashStr(locationId + stepIndex) % arr.length];

  const base: any = {
    id: questId,
    type: step.type,
    chainId: chain.id,
    chainStep: stepIndex,
    briefing: step.briefing,
    completion: step.completion,
    reward_cash: step.rewardCash,
    reward_renown: step.rewardRenown,
    location_id: locationId,
    is_chain: true,
  };

  if (step.type === "hunt_bandits") {
    const count = 3 + (stepIndex % 4);
    base.target_count = count;
    base.current_count = 0;
    base.unit_id = step.targetUnit ?? "bandit";
    base.desc = step.briefing;
  } else if (step.type === "deliver_goods") {
    const goodsId = step.targetUnit ?? "wheat";
    const target = step.targetLocation ?? pick(others);
    const amount = 3 + (stepIndex % 4);
    base.goods_id = goodsId;
    base.amount = amount;
    base.target_location = target;
    base.desc = step.briefing;
  } else if (step.type === "escort") {
    const target = step.targetLocation ?? pick(others);
    base.target_location = target;
    base.desc = step.briefing;
  } else {
    // meet_lord：去见某国君主
    base.target_location = step.targetLocation ?? locationId;
    base.target_lord = step.targetLord;
    base.desc = step.briefing;
  }
  return base;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * 为某城镇生成「链任务」优先列表。
 *
 * 规则：
 *  1. 已接取未完成的链 → 返回其当前步骤（让任务板持续显示）；
 *  2. 进行中的链 → 返回下一步（未满 2 条时开新链）；
 *  3. 都不满足 → 返回空数组（由随机模板补齐）。
 */
export function chainQuestsFor(state: any, locationId: string, startId: () => string): any[] {
  const cs = initChainState(state);
  const out: any[] = [];

  // 1. 已接取的链步骤
  for (const chain of QUEST_CHAINS) {
    const p = cs[chain.id];
    if (!p || p.finished || p.activeStep < 0) continue;
    const step = chain.steps[p.activeStep];
    if (!step) continue;
    out.push(chainStepToQuest(chain, step, p.activeStep, locationId, startId()));
  }

  // 2. 开新链（未满上限）
  if (activeChainCount(cs) < MAX_ACTIVE_CHAINS) {
    for (const chain of QUEST_CHAINS) {
      const p = cs[chain.id];
      if (p.finished) continue;
      if (p.activeStep >= 0) continue;
      const next = pendingStep(chain, p);
      if (!next) { p.finished = true; continue; }
      out.push(chainStepToQuest(chain, next.step, next.index, locationId, startId()));
      break; // 每次只开一条新链，避免任务板被链占满
    }
  }

  return out;
}

/** 接取链任务：标记 activeStep。 */
export function acceptChainQuest(state: any, quest: any): void {
  if (!quest?.chainId) return;
  const cs = initChainState(state);
  const p = cs[quest.chainId];
  if (p) p.activeStep = quest.chainStep;
}

/** 完成链任务：记入 completed，解锁下一步。 */
export function completeChainQuest(state: any, quest: any): void {
  if (!quest?.chainId) return;
  const cs = initChainState(state);
  const p = cs[quest.chainId];
  if (!p) return;
  if (!p.completed.includes(quest.chainStep)) p.completed.push(quest.chainStep);
  p.activeStep = -1;
  const chain = QUEST_CHAINS.find((c) => c.id === quest.chainId);
  if (chain && p.completed.length >= chain.steps.length) p.finished = true;
}

/** 供 UI 展示：玩家当前的链进度。 */
export function chainProgressSummary(state: any): { name: string; done: number; total: number; finished: boolean }[] {
  const cs = initChainState(state);
  return QUEST_CHAINS.map((c) => {
    const p = cs[c.id];
    return {
      name: c.name,
      done: p?.completed.length ?? 0,
      total: c.steps.length,
      finished: p?.finished ?? false,
    };
  });
}
