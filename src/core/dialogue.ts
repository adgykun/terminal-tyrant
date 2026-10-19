/**
 * dialogue.ts —— NPC 对话内核（骑砍式「身份相关」对话）。
 *
 * 设计目标：让 NPC 的反应取决于「你是谁」，而不是固定一句台词。
 *
 * 三股输入：
 *   1. 身份（culture / 出身）：同文化有亲切加成，宿敌文化有敌意；
 *   2. 声望（renown）：无名小卒 / 成名领主 / 一国之君，NPC 语气完全不同；
 *   3. 关系（relationWithPlayer）：好感高给折扣、委托私事；好感低直接赶人。
 *
 * 对话不是随机抽句，而是 (身份, 声望, 关系) 三元组查表，
 * 因此同一个 NPC 在不同阶段对玩家说的话不同，且可预期。
 */
import { LORDS_BANNERLORD, PERSONALITY_TRAIT } from "./lords_bannerlord";
import { COMPANIONS } from "./data";
import { KINGDOM_REL } from "./map_units";

/** 玩家身份快照。 */
export interface PlayerIdentity {
  /** 效忠的王国（null = 自由冒险者）。 */
  kingdom: string | null;
  /** 是否是一国之君。 */
  isKing: boolean;
  /** 声望。 */
  renown: number;
  /** 持有的封地数量。 */
  fiefCount: number;
}

/** 声望档位（决定 NPC 对玩家的称呼与态度）。 */
export type RenownTier = "nobody" | "known" | "famous" | "lordly" | "legendary";

export function renownTier(renown: number): RenownTier {
  if (renown >= 2000) return "legendary";
  if (renown >= 800) return "lordly";
  if (renown >= 300) return "famous";
  if (renown >= 100) return "known";
  return "nobody";
}

/** 声望档位 → 称呼。 */
const TIER_TITLE: Record<RenownTier, string> = {
  nobody: "流浪者",
  known: "有些名气的战士",
  famous: "远近闻名的勇士",
  lordly: "尊贵的领主",
  legendary: "卡拉迪亚的传奇",
};

/** 两国关系档位（按八王国 KINGDOM_REL 判定）。 */
type RelationStance = "allied" | "neutral" | "hostile";

function stanceOf(a: string, b: string): RelationStance {
  // 同国视为盟友
  if (a === b) return "allied";
  const rel = KINGDOM_REL[a]?.[b] ?? KINGDOM_REL[b]?.[a] ?? 0;
  if (rel >= 20) return "allied";
  if (rel <= -20) return "hostile";
  return "neutral";
}

/** 一次对话的结果：说什么 + 给玩家什么选项。 */
export interface DialogueTurn {
  /** NPC 说的话。 */
  text: string;
  /** NPC 对玩家的态度（用于 UI 着色/语气）。 */
  tone: "friendly" | "neutral" | "wary" | "hostile";
  /** 本次对话是否触发了特殊内容（如私事委托）。 */
  special?: "errand" | "discount" | "recruit_offer" | "refused";
}

/**
 * 生成一位 NPC 对玩家的问候。
 *
 * @param npcId       COMPANIONS 或 LORDS_BANNERLORD 的 id
 * @param npcKind     "companion"（同伴，性格在 COMPANIONS）或 "lord"（领主）
 * @param identity    玩家身份
 * @param relation    该 NPC 与玩家的好感（-100..100）
 */
export function greet(
  npcId: string,
  npcKind: "companion" | "lord",
  identity: PlayerIdentity,
  relation = 0,
): DialogueTurn {
  const tier = renownTier(identity.renown);
  const title = TIER_TITLE[tier];

  // ── 领主：按性格 + 国家关系 + 声望 ──
  if (npcKind === "lord") {
    const lord = LORDS_BANNERLORD[npcId];
    if (!lord) return { text: "……（此人沉默地看着你）", tone: "neutral" };
    const trait = PERSONALITY_TRAIT[lord.personality];
    const stance = identity.kingdom ? stanceOf(lord.kingdom, identity.kingdom) : "neutral";

    // 友好度：关系 + 同阵营 + 声望
    let warmth = relation;
    if (stance === "allied") warmth += 25;
    if (stance === "hostile") warmth -= 30;
    if (identity.isKing) warmth += 15;
    if (tier === "legendary") warmth += 10;

    const tone: DialogueTurn["tone"] =
      warmth >= 40 ? "friendly" : warmth >= 0 ? "neutral" : warmth > -30 ? "wary" : "hostile";

    let text: string;
    if (tone === "hostile") {
      text = `${lord.name}（${lord.title}）冷冷地瞥了你一眼：「这里不欢迎你，${title}。」`;
    } else if (tone === "wary") {
      text = `${lord.name}（${lord.title}）按着剑柄打量你：「说吧，${title}，你此来有何贵干？」`;
    } else if (tone === "friendly") {
      text = `${lord.name}（${lord.title}）抬手致意：「${title}，见到你总是好事。我这儿刚有个差事，或许正适合你。」`;
      return { text, tone, special: "errand" };
    } else {
      text = `${lord.name}（${lord.title}）微微点头：「${title}，有话便讲。」`;
    }
    return { text, tone };
  }

  // ── 同伴：按性格 + 关系 ──
  const c = (COMPANIONS as any)[npcId];
  if (!c) return { text: "……", tone: "neutral" };
  const persona = String(c.personality ?? "neutral");
  const rel = relation;

  if (rel >= 60) {
    return {
      text: `${c.name}放下手里的活计：「${title}！有话直说，你的事就是我的事。」`,
      tone: "friendly",
      special: "discount",
    };
  }
  if (rel <= -40) {
    return { text: `${c.name}转过身去，懒得理你。`, tone: "hostile", special: "refused" };
  }
  // 性格化台词
  const lines: Record<string, string> = {
    greedy: `金币的声音永远比剑吟更悦耳，${title}有何高见？`,
    hot_headed: `我的剑早就渴了！说吧，${title}，下一个敌人是谁？`,
    honorable: `荣誉高于性命，${title}。你此来所为何事？`,
    cautious: `小心驶得万年船，${title}。先说说你的打算。`,
    generous: `有话慢慢说，${title}，我这儿还有时间。`,
    treacherous: `（${c.name}笑得意味深长）「哦？${title}，咱们能做笔什么买卖呢？」`,
  };
  return { text: lines[persona] ?? `${title}，有什么事？`, tone: rel >= 20 ? "friendly" : "neutral" };
}

/**
 * 任务链：完成前置任务后解锁后续任务。
 * 这让任务不再是孤立随机事件，而是有因果的故事线。
 */
export interface QuestChainDef {
  id: string;
  name: string;
  /** 链上每一步（按顺序解锁）。 */
  steps: QuestStepDef[];
}

export interface QuestStepDef {
  type: "hunt_bandits" | "deliver_goods" | "escort" | "meet_lord";
  /** 该步骤的固定目标（而非随机），保证故事连贯。 */
  targetLocation?: string;
  targetUnit?: string;
  targetLord?: string;
  /** 对白（接取时显示）。 */
  briefing: string;
  /** 完成时的对白。 */
  completion: string;
  rewardCash: number;
  rewardRenown: number;
}

/** 三条示范任务链。 */
export const QUEST_CHAINS: QuestChainDef[] = [
  {
    id: "chain_bandit_king",
    name: "匪王之影",
    steps: [
      {
        type: "hunt_bandits",
        targetUnit: "bandit",
        briefing: "「村里的麦子又被匪徒糟蹋了。替我教训他们，酬金照付。」",
        completion: "「干得漂亮。不过我听说，这群匪徒背后另有其人……」",
        rewardCash: 120,
        rewardRenown: 10,
      },
      {
        type: "hunt_bandits",
        targetUnit: "bandit",
        briefing: "「匪徒的营地往北去了。找到他们的头目，除掉他。」",
        completion: "「匪王死了？好！从今往后商路能太平一阵子。」",
        rewardCash: 260,
        rewardRenown: 25,
      },
      {
        type: "meet_lord",
        briefing: "「领主想亲眼见见办了这事的人。去城里走一趟。」",
        completion: "「领主对你赞不绝口。你的名字，很快就会传开了。」",
        rewardCash: 200,
        rewardRenown: 40,
      },
    ],
  },
  {
    id: "chain_trade_route",
    name: "商路兴衰",
    steps: [
      {
        type: "deliver_goods",
        briefing: "「这批货必须在天黑前送到邻镇。路上不太平，小心些。」",
        completion: "「货送到了？你比我想象的能干。」",
        rewardCash: 150,
        rewardRenown: 8,
      },
      {
        type: "escort",
        briefing: "「既然你靠得住，那就护送我的商队走一趟远路。」",
        completion: "「商队分毫未损！以后这条线就归你照看了。」",
        rewardCash: 320,
        rewardRenown: 20,
      },
    ],
  },
  {
    id: "chain_lord_favor",
    name: "领主的考验",
    steps: [
      {
        type: "escort",
        briefing: "「我有一封密函要送到友军领主手上，不能落入敌探之手。」",
        completion: "「密函安然送达。领主会记住你的谨慎。」",
        rewardCash: 180,
        rewardRenown: 15,
      },
      {
        type: "hunt_bandits",
        briefing: "「敌国的匪徒在骚扰我的采邑。把他们清干净。」",
        completion: "「采邑安定了。你已是领主信赖的人。」",
        rewardCash: 280,
        rewardRenown: 30,
      },
      {
        type: "meet_lord",
        briefing: "「领主欲封你一块采邑。去厅堂受封吧。」",
        completion: "「从今往后，你也是拥有采邑的领主了。」",
        rewardCash: 400,
        rewardRenown: 60,
      },
    ],
  },
];

/** 取一条链上「玩家下一步该做」的步骤（无则 null）。 */
export function nextChainStep(chain: QuestChainDef, completedStepIndices: number[]): QuestStepDef | null {
  for (let i = 0; i < chain.steps.length; i++) {
    if (!completedStepIndices.includes(i)) return chain.steps[i];
  }
  return null;
}
