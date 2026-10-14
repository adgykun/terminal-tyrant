/** 对话引擎模块：根据 NPC 的性格、记忆、心情与玩家声望动态选择并生成台词。 */

import { ATTITUDE_LEVELS, NPC_MERCHANTS } from "./data.js";
import { DIALOGUE_DATABASE } from "./dialogues.js";

export const LEAVE_PARTY = "LEAVE_PARTY";

export const ATTITUDE_KEYS = ["contempt", "neutral", "respect", "fawning"];

/** 将事件记录到 NPC 的记忆列表中，并维持最多 10 条遗忘机制。 */
export function update_memory(npc: any, event: string): void {
    if (typeof npc === "object" && npc !== null) {
        if (!Array.isArray(npc.memory)) {
            npc.memory = [];
        }
        npc.memory.push(event);
        if (npc.memory.length > 10) {
            npc.memory = npc.memory.slice(-10);
        }
    }
}

/** 根据玩家声望与 NPC 当前心情计算态度基调键名。 */
export function get_attitude_key(state: any, npc: any): string {
    let renown = 100;
    if (state !== null && state !== undefined) {
        if (typeof state === "object") {
            renown = state.renown ?? 100;
        }
    }

    let base_idx = 1;
    if (renown < 100) {
        base_idx = 0;
    } else if (renown >= 100 && renown <= 500) {
        base_idx = 1;
    } else if (renown >= 501 && renown <= 1000) {
        base_idx = 2;
    } else {
        base_idx = 3;
    }

    let mood = "neutral";
    let npc_id: string | null = null;
    if (typeof npc === "string") {
        npc_id = npc;
    } else if (typeof npc === "object" && npc !== null) {
        npc_id = npc.id ?? null;
        mood = npc.mood ?? "neutral";
    }

    if (state !== null && state !== undefined) {
        const npc_states = state.npc_states;
        if (npc_states && typeof npc_states === "object" && npc_id && npc_id in npc_states) {
            mood = npc_states[npc_id].mood ?? mood;
        }
    }

    if (mood === "angry") {
        base_idx = Math.max(0, base_idx - 1);
    } else if (mood === "happy") {
        base_idx = Math.min(3, base_idx + 1);
    }

    return ATTITUDE_KEYS[base_idx];
}

/** 根据 NPC 的性格、态度基调和情境检索并返回对话台词。 */
export function get_dialogue(npc: any, context: string, state: any = null): string {
    let personality = "cautious";
    let memory: string[] = [];

    if (typeof npc === "string") {
        const npc_info = NPC_MERCHANTS[npc] || { personality: "cautious" };
        personality = npc_info.personality || "cautious";
        memory = [];
    } else if (typeof npc === "object" && npc !== null) {
        personality = npc.personality || "cautious";
        memory = Array.isArray(npc.memory) ? npc.memory : [];
    }

    if (context === "combat_lost_fled" && personality === "hot_headed") {
        if (Math.random() < 0.5) {
            return LEAVE_PARTY;
        }
    }

    const attitude = get_attitude_key(state, npc);

    let candidates: string[] = [];

    function _find_in_category(category_dict: any): string[] {
        if (typeof category_dict !== "object" || category_dict === null) {
            return [];
        }

        // 1. 匹配 attitude -> personality
        if (attitude in category_dict && typeof category_dict[attitude] === "object" && category_dict[attitude] !== null) {
            const p_dict = category_dict[attitude];
            if (personality in p_dict && Array.isArray(p_dict[personality]) && p_dict[personality].length > 0) {
                return p_dict[personality];
            }
            for (const p in p_dict) {
                if (Array.isArray(p_dict[p]) && p_dict[p].length > 0) {
                    return p_dict[p];
                }
            }
        }

        // 2. 降级匹配其他 attitude
        const fallbackAttitudes = ["neutral", "contempt", "respect", "fawning"];
        for (const att of fallbackAttitudes) {
            if (att in category_dict && typeof category_dict[att] === "object" && category_dict[att] !== null) {
                const p_dict = category_dict[att];
                if (personality in p_dict && Array.isArray(p_dict[personality]) && p_dict[personality].length > 0) {
                    return p_dict[personality];
                }
                for (const p in p_dict) {
                    if (Array.isArray(p_dict[p]) && p_dict[p].length > 0) {
                        return p_dict[p];
                    }
                }
            }
        }

        // 3. 兼容旧版直接以 personality 为 key 的结构
        if (personality in category_dict && Array.isArray(category_dict[personality]) && category_dict[personality].length > 0) {
            return category_dict[personality];
        }

        for (const p in category_dict) {
            const val = category_dict[p];
            if (Array.isArray(val) && val.length > 0) {
                return val;
            }
        }

        return [];
    }

    if (context in DIALOGUE_DATABASE) {
        candidates = _find_in_category(DIALOGUE_DATABASE[context]);
    }

    if (candidates.length === 0 && memory.length > 0) {
        for (let i = memory.length - 1; i >= 0; i--) {
            const mem_event = memory[i];
            if (mem_event in DIALOGUE_DATABASE) {
                candidates = _find_in_category(DIALOGUE_DATABASE[mem_event]);
                if (candidates.length > 0) {
                    break;
                }
            }
        }
    }

    if (candidates.length === 0) {
        const generic = DIALOGUE_DATABASE.generic || {};
        candidates = _find_in_category(generic);
    }

    if (candidates.length === 0) {
        candidates = ["..."];
    }

    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
}

/** 生成带 NPC 称号/名字和态度描述的格式化台词，格式: [贪婪的酒馆老板] (蔑视地): “台词” */
export function get_formatted_npc_dialogue(npc: any, context: string, state: any = null): string {
    let npc_info: any = {};
    if (typeof npc === "string") {
        npc_info = NPC_MERCHANTS[npc] || { name: npc, title: npc, personality: "cautious" };
    } else if (typeof npc === "object" && npc !== null) {
        npc_info = npc;
    } else {
        npc_info = {
            name: "NPC",
            title: "NPC",
            personality: "cautious",
        };
    }

    const title = npc_info.title || npc_info.name || "NPC";
    const attitude_key = get_attitude_key(state, npc);
    const attitude_label = ATTITUDE_LEVELS[attitude_key]?.label ?? "平静地";

    const dialogue_text = get_dialogue(npc, context, state);
    if (dialogue_text === LEAVE_PARTY) {
        return LEAVE_PARTY;
    }

    return `[${title}] (${attitude_label}): “${dialogue_text}”`;
}
