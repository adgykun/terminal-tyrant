/**
 * 核心引擎逻辑模块：包含大地图移动、休息、事件触发与简单战斗结算。
 *
 * 纯逻辑计算，不包含任何 UI、print() 或 input()。
 */

import {
    LOCATIONS,
    EVENTS,
    UNITS,
    GOODS,
    COMPANIONS,
    EQUIPMENT,
    FACTIONS,
    QUEST_TEMPLATES,
    POLICIES,
    FISHING_GEAR,
    FISH_LOOT_TABLE,
    NPC_MERCHANTS,
    APPEARANCE_TIERS,
    BARD_LISTEN_COST,
    BARD_MORALE_GAIN,
    GAMBLER_MIN_BET,
    BEGGAR_ALMS,
    BEGGAR_RENOWN_GAIN,
    BEGGAR_STEAL_CHANCE,
    BEGGAR_STEAL_AMOUNT,
    DESERTER_RECRUIT_COST,
    DESERTER_POWER_BONUS,
    DESERTER_ARMY_BONUS,
    DESERTER_RELATION_PENALTY,
    SCAVENGE_MIN_DAYS,
    SCAVENGE_MAX_DAYS,
    SCAVENGE_AMBUSH_CHANCE,
    SCAVENGE_GOLD_PER_ENEMY_POWER,
    SCAVENGE_LOOT_CHANCE,
    RANSOM_GOLD_PER_PRISONER,
    RANSOM_RELATION_PENALTY,
    RELEASE_RENOWN_PER_PRISONER,
    RELEASE_MORALITY_GAIN,
    EXECUTE_MORALITY_LOSS,
    EXECUTE_RELATION_PENALTY,
    EXECUTE_INTIMIDATION_GAIN,
    EXECUTE_RENOWN_GAIN,
    INTIMIDATION_CAP,
    INTIMIDATION_ENEMY_REDUCTION,
    LORDS,
    LORD_PERSONALITY_MODIFIERS,
    NEWS_TEMPLATES,
    WORLD_NEWS_CHANCE,
    WORLD_NEWS_HISTORY_LIMIT,
    LORD_GRUDGE_DECAY,
    RECIPES,
    FACILITY_NAMES,
    HAGGLE_CHARM_FACTOR,
    HAGGLE_BIG_SUCCESS_RATE,
    HAGGLE_FAIL_RATE,
    HAGGLE_MAX_DISCOUNT,
    MERCENARY_RANKS,
    KNIGHT_ORDERS,
    MERCENARY_CONTRACT_WAGE_INTERVAL,
} from "./data.js";

import { WORLD_REGIONS, get_region, RegionConfig } from "./world_regions.js";
import { generate_region_map } from "./map_generator.js";
import {
    APPEARANCE_REVEAL_TEXTS,
    ADMIRER_EVENT_TEXTS,
    BARD_STORIES,
    SCAVENGE_SUCCESS_TEXTS,
    SCAVENGE_AMBUSH_TEXTS,
} from "./dialogues.js";
import { get_formatted_npc_dialogue, get_dialogue } from "./dialogue_engine.js";

let _quest_id_counter = 1;

// 随机数辅助函数
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function weightedChoice<T>(items: T[], weights: number[]): T {
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < items.length; i++) {
        if (rand < weights[i]) {
            return items[i];
        }
        rand -= weights[i];
    }
    return items[items.length - 1];
}

function randomSample<T>(arr: T[], k: number): T[] {
    const copied = [...arr];
    const result: T[] = [];
    for (let i = 0; i < k && copied.length > 0; i++) {
        const idx = Math.floor(Math.random() * copied.length);
        result.push(copied.splice(idx, 1)[0]);
    }
    return result;
}

/** 分配 15 点基础属性并盲盒抽取外貌数值。 */
export function create_character(state: any, str_pts: number, int_pts: number, charm_pts: number): any {
    if (str_pts + int_pts + charm_pts !== 15) {
        throw new Error("属性点数总和必须严格等于 15！");
    }
    const checkPts = [
        ["力量", str_pts],
        ["智力", int_pts],
        ["魅力", charm_pts],
    ] as const;
    for (const [name, pts] of checkPts) {
        if (pts < 1 || pts > 10) {
            throw new Error(`${name} 属性必须在 1 至 10 之间！`);
        }
    }

    state.attributes = {
        strength: str_pts,
        intellect: int_pts,
        charm: charm_pts,
    };
    state.appearance = randomInt(1, 100);
    state.appearance_revealed = false;
    return state;
}

/** 计算玩家基础外貌与当前穿戴装备的外貌加成之和。 */
export function get_total_appearance(state: any): number {
    const base_app = state.appearance ?? 50;
    let eq_app_bonus = 0;
    if (state.equipment && typeof state.equipment === "object") {
        for (const eq_id of Object.values(state.equipment) as string[]) {
            if (eq_id in EQUIPMENT) {
                eq_app_bonus += EQUIPMENT[eq_id].appearance_bonus ?? 0;
            }
        }
    }
    return base_app + eq_app_bonus;
}

/** 揭晓玩家外貌值及对应的外貌描述层级。 */
export function reveal_appearance(state: any): string {
    const app_val = state.appearance ?? 50;
    state.appearance_revealed = true;

    let matched_tier: [string, any] | null = null;
    for (const [key, tier_data] of Object.entries(APPEARANCE_TIERS)) {
        const [min, max] = tier_data.range;
        if (app_val >= min && app_val <= max) {
            matched_tier = [key, tier_data];
            break;
        }
    }

    let texts: string[];
    let tier_data: any;
    if (!matched_tier) {
        tier_data = { desc: "大众脸", combat_effect: "none", social_modifier: 0 };
        texts = ["你在溪边照了照，水中的倒影气色尚可，面貌规规矩矩。"];
    } else {
        const [key, t_data] = matched_tier;
        tier_data = t_data;
        texts = APPEARANCE_REVEAL_TEXTS[key] || ["你注视着自己的倒影。"];
    }

    const desc_text = randomChoice(texts);
    const tier_name = tier_data.desc ?? "未知";
    const res_msg = `【外貌揭晓】外貌数值: ${app_val} (${tier_name})\n${desc_text}`;
    state.add_log(res_msg);
    return res_msg;
}

/** 绝世容颜倒贴随机事件：随机给予金钱 (100-500) 或稀有装备。 */
export function trigger_admirer_event(state: any): string {
    const template = randomChoice(ADMIRER_EVENT_TEXTS);
    let reward_str = "";
    if (Math.random() < 0.7) {
        const reward_gold = randomInt(100, 500);
        state.gold += reward_gold;
        reward_str = `获得 ${reward_gold} 金币`;
    } else {
        const eq_id = randomChoice(Object.keys(EQUIPMENT));
        const eq_item = { ...EQUIPMENT[eq_id] };
        state.loot.push(eq_item);
        reward_str = `获得稀有装备 [${eq_item.name}]`;
    }

    const event_msg = `【仰慕者倾心】${template.replace("[REWARD]", reward_str)}`;
    state.add_log(event_msg);
    return event_msg;
}

/** 获取所有已招募同伴在本轮战斗中的吐槽台词列表。 */
export function get_battle_companion_quote(state: any, combat_context: string): string[] {
    const quotes: string[] = [];
    if (!state.companions || !Array.isArray(state.companions) || state.companions.length === 0) {
        return quotes;
    }

    for (const comp_id of state.companions) {
        let comp_info = COMPANIONS[comp_id];
        if (!comp_info) {
            comp_info = { id: comp_id, name: comp_id, personality: "cautious" } as any;
        }

        const comp_name = comp_info.name ?? comp_id;
        const dialogue_text = get_dialogue(comp_info, combat_context, state);
        quotes.push(`[${comp_name}]: “${dialogue_text}”`);
    }

    return quotes;
}

/** 记录一条事件日志到历史记录，并维持最多 50 条最近记录。 */
export function add_log(state: any, event_text: string): void {
    state.log_history.push({ day: state.day, event: event_text });
    if (state.log_history.length > 50) {
        state.log_history = state.log_history.slice(-50);
    }
}

/** 每日结算：更新势力之间的动态关系。 */
export function update_faction_relations(state: any): void {
    const f_ids = Object.keys(FACTIONS);
    if (f_ids.length < 2) {
        return;
    }

    const [f1_id, f2_id] = randomSample(f_ids, 2);
    if (Math.random() < 0.10) {
        const rel = FACTIONS[f1_id].relations[f2_id] ?? 0;
        let msg = "";
        if (rel < 0) {
            FACTIONS[f1_id].relations[f2_id] = 20;
            FACTIONS[f2_id].relations[f1_id] = 20;
            msg = `【势力外交】${FACTIONS[f1_id].name} 与 ${FACTIONS[f2_id].name} 达成了停战协议！`;
        } else {
            FACTIONS[f1_id].relations[f2_id] = -50;
            FACTIONS[f2_id].relations[f1_id] = -50;
            msg = `【势力外交】${FACTIONS[f1_id].name} 向 ${FACTIONS[f2_id].name} 正式宣战！`;
        }
        state.add_log(msg);
    }
}

/** 每日结算：为城镇生成任务。 */
export function generate_quests(location_id: string): void {
    const loc = LOCATIONS[location_id];
    if (!loc || loc.type !== "town") {
        return;
    }

    if (!("active_quests" in loc) || !Array.isArray(loc.active_quests)) {
        loc.active_quests = [];
    }

    const active_quests = loc.active_quests;
    const other_locations = Object.keys(LOCATIONS).filter(lid => lid !== location_id);

    while (active_quests.length < 3) {
        const template = randomChoice(QUEST_TEMPLATES);
        const q_type = template.type;
        const q_id = `q_${_quest_id_counter}`;
        _quest_id_counter += 1;

        let quest: any = null;

        if (q_type === "hunt_bandits") {
            const count = randomInt(3, 10);
            const unit_id = randomChoice(Object.keys(UNITS));
            const unit_name = UNITS[unit_id].name;
            const desc = `剿灭 ${count} 个 ${unit_name} 匪徒`;
            quest = {
                id: q_id,
                type: q_type,
                desc: desc,
                reward_cash: template.reward_cash,
                reward_renown: template.reward_renown,
                target_count: count,
                current_count: 0,
                unit_id: unit_id,
                location_id: location_id,
            };
        } else if (q_type === "deliver_goods") {
            const amount = randomInt(3, 8);
            const goods_id = randomChoice(Object.keys(GOODS));
            const goods_name = GOODS[goods_id].name;
            const target_loc_id = randomChoice(other_locations);
            const target_loc_name = LOCATIONS[target_loc_id].name;
            const desc = `将 ${amount} 单位 ${goods_name} 从 ${loc.name} 运到 ${target_loc_name}`;
            quest = {
                id: q_id,
                type: q_type,
                desc: desc,
                reward_cash: template.reward_cash,
                reward_renown: template.reward_renown,
                goods_id: goods_id,
                amount: amount,
                target_location: target_loc_id,
                location_id: location_id,
            };
        } else if (q_type === "escort") {
            const target_loc_id = randomChoice(other_locations);
            const target_loc_name = LOCATIONS[target_loc_id].name;
            const desc = `护送商队从 ${loc.name} 到 ${target_loc_name}`;
            quest = {
                id: q_id,
                type: q_type,
                desc: desc,
                reward_cash: template.reward_cash,
                reward_renown: template.reward_renown,
                target_location: target_loc_id,
                location_id: location_id,
            };
        } else {
            continue;
        }

        // Phase 16: 领主性格影响任务报酬
        const lord = get_faction_lord(loc.faction_id);
        if (lord) {
            const modifier = LORD_PERSONALITY_MODIFIERS[lord.personality] ?? 1.0;
            quest.reward_cash = Math.max(0, Math.floor(quest.reward_cash * modifier));
            quest.reward_renown = Math.max(0, Math.floor(quest.reward_renown * modifier));
            quest.lord_id = lord.id;
        }

        active_quests.push(quest);
    }
}

/** 玩家接取城镇任务板上的任务。 */
export function accept_quest(state: any, quest_id: string): string {
    const loc = get_current_location(state) ?? {};
    const active_quests = loc.active_quests || [];

    let target_quest: any = null;
    for (const q of active_quests) {
        if (q.id === quest_id) {
            target_quest = q;
            break;
        }
    }

    if (!target_quest) {
        return `城镇任务板上未找到任务 '${quest_id}'`;
    }

    const idx = active_quests.indexOf(target_quest);
    if (idx !== -1) {
        active_quests.splice(idx, 1);
    }
    state.active_quests.push(target_quest);
    const msg = `成功接取任务：${target_quest.desc}`;
    state.add_log(msg);
    return msg;
}

/** 尝试完成玩家接取的任务。 */
export function complete_quest(state: any, quest_id: string): string {
    let target_quest: any = null;
    for (const q of state.active_quests) {
        if (q.id === quest_id) {
            target_quest = q;
            break;
        }
    }

    if (!target_quest) {
        return `你当前未接取任务 '${quest_id}'`;
    }

    const q_type = target_quest.type;

    if (q_type === "deliver_goods") {
        const target_loc_id = target_quest.target_location;
        const target_loc_name = LOCATIONS[target_loc_id]?.name ?? target_loc_id;
        if (state.location !== target_loc_id) {
            return `尚未到达目标地点！需要将货物运送到 [${target_loc_name}]`;
        }

        const goods_id = target_quest.goods_id;
        const goods_name = GOODS[goods_id]?.name ?? goods_id;
        const amount = target_quest.amount;
        const current_amount = state.inventory[goods_id] ?? 0;
        if (current_amount < amount) {
            return `货物不足！需要 ${amount} 单位 ${goods_name}，当前持有 ${current_amount} 单位`;
        }

        state.inventory[goods_id] -= amount;

    } else if (q_type === "escort") {
        const target_loc_id = target_quest.target_location;
        const target_loc_name = LOCATIONS[target_loc_id]?.name ?? target_loc_id;
        if (state.location !== target_loc_id) {
            return `尚未到达目标地点！需要护送商队到达 [${target_loc_name}]`;
        }

    } else if (q_type === "hunt_bandits") {
        const curr_cnt = target_quest.current_count ?? 0;
        const target_cnt = target_quest.target_count ?? 1;
        if (curr_cnt < target_cnt) {
            return `任务未完成！还需剿灭 ${target_cnt - curr_cnt} 个匪徒`;
        }
    }

    const reward_cash = target_quest.reward_cash ?? 0;
    const reward_renown = target_quest.reward_renown ?? 0;

    state.cash += reward_cash;
    state.renown += reward_renown;

    const idx = state.active_quests.indexOf(target_quest);
    if (idx !== -1) {
        state.active_quests.splice(idx, 1);
    }
    state.completed_quests.push(quest_id);

    const msg = `成功完成任务 [${target_quest.desc}]！获得 ${reward_cash} 金币，${reward_renown} 声望。`;
    state.add_log(msg);
    return msg;
}

/** 在当前地点的酒馆招募同伴。 */
export function hire_companion(state: any, companion_id: string): string {
    if (!(companion_id in COMPANIONS)) {
        return `同伴 '${companion_id}' 不存在`;
    }

    if (state.companions.includes(companion_id)) {
        return `已经招募过同伴 '${COMPANIONS[companion_id].name}'`;
    }

    const comp = COMPANIONS[companion_id];
    const cost = comp.cost ?? 0;
    const req_renown = comp.required_renown ?? 0;

    if (state.renown < req_renown) {
        return `声望不足！招募 '${comp.name}' 需要 ${req_renown} 声望，当前声望：${state.renown}`;
    }

    if (state.cash < cost) {
        return `金钱不足！招募 '${comp.name}' 需要 ${cost} 金，当前金钱：${state.cash}`;
    }

    state.cash -= cost;
    state.companions.push(companion_id);

    const bonus_type = comp.bonus_type;
    const bonus_value = comp.bonus_value ?? 0;

    if (bonus_type === "combat") {
        state.max_army_size += Math.floor(bonus_value);
    } else if (bonus_type === "morale") {
        state.morale = Math.min(100, state.morale + Math.floor(bonus_value));
    }

    const msg = `成功招募同伴 '${comp.name}'！花费 ${cost} 金。`;
    state.add_log(msg);
    return msg;
}

/** 掠夺或占领地点。 */
export function conquer_location(state: any, location_id: string, action: string): string {
    const loc = get_location(state, location_id);
    if (!loc) {
        return `地点 '${location_id}' 不存在`;
    }

    if (action === "loot") {
        const tax = loc.tax_income ?? 20;
        const loot_gold = tax * 10;
        state.cash += loot_gold;
        state.renown = Math.max(0, state.renown - 10);
        loc.owner = "looted";
        const msg = `对 [${loc.name}] 进行了掠夺！获得 ${loot_gold} 金币，声望减少 10 点。`;
        state.add_log(msg);
        return msg;

    } else if (action === "occupy") {
        if (loc.owner === "looted") {
            return `[${loc.name}] 已被掠夺破坏，无法再占领！`;
        }

        if (state.renown < 50) {
            return `声望不足，无法占领 [${loc.name}]！需要 50 声望，当前声望：${state.renown}。`;
        }

        loc.owner = "player";
        if (!state.fiefs.includes(location_id)) {
            state.fiefs.push(location_id);
        }
        state.renown += 20;
        const msg = `成功占领 [${loc.name}]！声望增加 20 点，该地点已成为你的封地。`;
        state.add_log(msg);
        return msg;

    } else {
        return `未知的征服行为 '${action}'`;
    }
}

/** 每日结算：收税、耗粮、势力关系演变、任务生成与士气/解散判定。 */
export function daily_update(state: any): string {
    // 0. 外交动态演变与任务生成
    update_faction_relations(state);
    for (const loc_id of Object.keys(LOCATIONS)) {
        generate_quests(loc_id);
    }

    // 0.1 Phase 16: 生成世界新闻，并结算与玩家结怨领主的关系衰减
    generate_world_news(state);
    apply_lord_grudge_decay(state);

    // 1. 收税（领主管理，税收减半）
    let tax_income = 0.0;
    for (const fief_id of state.fiefs) {
        const f_info = get_location(state, fief_id) ?? {};
        const base_tax = f_info.tax_income ?? 0;
        if (f_info.owner === "lord") {
            tax_income += base_tax * 0.5;
        } else {
            tax_income += base_tax;
        }
    }

    // 1.1 政策叠加效果
    if (state.is_king && state.current_policy) {
        if (state.current_policy === "tax_high") {
            tax_income *= 1.5;
            state.morale = Math.max(0, state.morale - 5);
        } else if (state.current_policy === "tax_low") {
            tax_income *= 0.8;
            state.morale = Math.min(100, state.morale + 5);
        } else if (state.current_policy === "conscription") {
            state.renown = Math.max(0, state.renown - 2);
        }
    }

    const tax_income_int = Math.floor(tax_income);
    state.cash += tax_income_int;

    // 2. 战败惩罚
    if (state.battle_lost_today) {
        state.morale = Math.max(0, state.morale - 20);
        state.battle_lost_today = false;
    }

    // 3. 耗粮与无粮惩罚
    let total_food_consumed = 0.0;
    for (const [unit_id, count] of Object.entries(state.troops) as [string, number][]) {
        if (count > 0) {
            const u_info = UNITS[unit_id] || {};
            const rate = u_info.food_consumption ?? 1.0;
            total_food_consumed += count * rate;
        }
    }

    state.food -= total_food_consumed;

    if (state.food <= 0) {
        state.food = 0.0;
        state.morale = Math.max(0, state.morale - 10);
    }

    // 4. 脱队机制
    let disband_msg = "";
    if (state.morale < 30) {
        const total_soldiers = (Object.values(state.troops) as number[]).reduce((a, b) => a + b, 0);
        if (total_soldiers > 0) {
            const to_desert = Math.min(total_soldiers, randomInt(1, 2));
            let remaining_desert = to_desert;
            const deserted_detail: Record<string, number> = {};

            const priority_order = ["peasant", "archer", "infantry"];
            for (const unit_id of priority_order) {
                if (state.troops[unit_id] && state.troops[unit_id] > 0 && remaining_desert > 0) {
                    const loss = Math.min(state.troops[unit_id], remaining_desert);
                    state.troops[unit_id] -= loss;
                    remaining_desert -= loss;
                    deserted_detail[unit_id] = loss;
                }
            }

            for (const unit_id of Object.keys(state.troops)) {
                if (remaining_desert <= 0) {
                    break;
                }
                if (state.troops[unit_id] > 0) {
                    const loss = Math.min(state.troops[unit_id], remaining_desert);
                    state.troops[unit_id] -= loss;
                    remaining_desert -= loss;
                    deserted_detail[unit_id] = loss;
                }
            }

            const desert_parts = Object.entries(deserted_detail)
                .filter(([, cnt]) => cnt > 0)
                .map(([uid, cnt]) => `${UNITS[uid]?.name ?? uid} ${cnt} 人`);
            const desert_str = desert_parts.length > 0 ? desert_parts.join("、") : "无";
            disband_msg = `⚠️ 士气低落，士兵正在逃跑！流失了 ${to_desert} 名士兵（${desert_str}）。`;
        }
    }

    const report = `【每日结算】税收增加：${tax_income_int} 金 | 耗粮：${total_food_consumed.toFixed(1)} | 当前粮食：${state.food.toFixed(1)} | 当前士气：${state.morale}` +
        (disband_msg ? `\n【惩罚警告】${disband_msg}` : "");

    state.add_log(report);
    add_log(state, `第 ${state.day} 天结束。税收: ${tax_income_int}, 耗粮: ${total_food_consumed.toFixed(1)}`);
    return report;
}

/** 根据部队成员数量与单位基础战斗力计算玩家军队总战力。 */
export function calculate_army_power(troops: Record<string, number>): number {
    let total_power = 0;
    for (const [troop_id, count] of Object.entries(troops)) {
        const unit_info = UNITS[troop_id] || {};
        const power = unit_info.power ?? 1;
        total_power += power * count;
    }
    return total_power;
}

/** 推进游戏时间一日。 */
export function advance_day(state: any): any {
    state.day += 1;
    return state;
}

/** 在当前地点休息一日，恢复士气。 */
export function rest(state: any): any {
    advance_day(state);
    const morale_gain = 15;
    state.morale = Math.min(100, state.morale + morale_gain);
    state.add_log(`部队进行了休整，恢复了 ${morale_gain} 点士气。当前士气：${state.morale}`);
    return state;
}

/** 根据需要扣除的伤亡总人数，依次扣减部队兵员数量。 */
export function apply_casualties(troops: Record<string, number>, casualties: number): Record<string, number> {
    let remaining_casualties = casualties;
    const loss_summary: Record<string, number> = {};
    for (const troop_id of Object.keys(troops)) {
        loss_summary[troop_id] = 0;
    }

    const priority_order = ["peasant", "archer", "infantry"];
    for (const troop_id of priority_order) {
        if (troops[troop_id] && troops[troop_id] > 0 && remaining_casualties > 0) {
            const loss = Math.min(troops[troop_id], remaining_casualties);
            troops[troop_id] -= loss;
            remaining_casualties -= loss;
            loss_summary[troop_id] += loss;
        }
    }

    for (const troop_id of Object.keys(troops)) {
        if (remaining_casualties <= 0) {
            break;
        }
        if (troops[troop_id] > 0) {
            const loss = Math.min(troops[troop_id], remaining_casualties);
            troops[troop_id] -= loss;
            remaining_casualties -= loss;
            loss_summary[troop_id] += loss;
        }
    }

    return loss_summary;
}

/** 根据权重随机抽取一个事件。 */
export function select_random_event(): any {
    const event_list = Object.values(EVENTS);
    const weights = event_list.map(evt => evt.weight ?? 10);
    return weightedChoice(event_list, weights);
}

/** 尝试将玩家移动到目标地点。 */
export function move(state: any, target_location_id: string): [boolean, string, any] {
    const current_loc = get_current_location(state);
    const target_loc = get_location(state, target_location_id);

    if (!current_loc || !target_loc) {
        return [false, "目标地点不存在", null];
    }

    if (!current_loc.neighbors?.includes(target_location_id)) {
        return [false, `无法直接从 ${current_loc.name} 前往 ${target_loc.name}`, null];
    }

    advance_day(state);
    state.location = target_location_id;
    state.morale = Math.max(0, state.morale - 5);

    const app_val = state.appearance ?? 50;
    if (app_val >= 96 && Math.random() < 0.15) {
        const admirer_msg = trigger_admirer_event(state);
        state.add_log(admirer_msg);
    }

    const event = select_random_event();
    const event_type = event.type;
    const event_data = { ...event };

    if (event_type === "caravan") {
        const gold = event.gold_reward ?? 30;
        state.gold += gold;
        state.add_log(`移动至 ${target_loc.name} 途中：${event.description} 获得 ${gold} 金币。`);
        add_log(state, `你在移动途中遭遇了：${event.description}`);
    } else if (event_type === "treasure") {
        const gold = event.gold_reward ?? 50;
        state.gold += gold;
        state.add_log(`移动至 ${target_loc.name} 途中：${event.description} 获得 ${gold} 金币。`);
        add_log(state, `你在移动途中遭遇了：${event.description}`);
    } else if (event_type === "nothing") {
        state.add_log(`移动至 ${target_loc.name} 途中：${event.description}`);
        add_log(state, `你在移动途中遭遇了：${event.description}`);
    } else if (event_type === "combat") {
        const min_pow = event.enemy_power_min ?? 5;
        const max_pow = event.enemy_power_max ?? 20;
        const enemy_power = randomInt(min_pow, max_pow);
        event_data.enemy_power = enemy_power;
        state.add_log(`移动至 ${target_loc.name} 途中：${event.description} 敌方战力：${enemy_power}。`);
        add_log(state, `你在移动途中遭遇了：${event.description}`);
    }

    return [true, `顺利到达 ${target_loc.name}`, event_data];
}

/** 结算简单战斗模式（包含装备加成、战利品与俘虏）。 */
export function resolve_combat_simple(state: any, enemy_power: number, choice: string): any {
    let eq_bonus = 0;
    if (state.equipment && typeof state.equipment === "object") {
        for (const eq_id of Object.values(state.equipment) as string[]) {
            if (eq_id in EQUIPMENT) {
                eq_bonus += EQUIPMENT[eq_id].power_bonus ?? 0;
            }
        }
    }

    const player_power = calculate_army_power(state.troops) + state.personal_power + eq_bonus;
    const total_soldiers = (Object.values(state.troops) as number[]).reduce((a, b) => a + b, 0);

    let intimidate_msg = "";
    const app_val = state.appearance ?? 0;
    if (app_val >= 1 && app_val <= 10) {
        intimidate_msg = "你的凶恶面容让敌人感到恐惧，敌方士气大减！";
        enemy_power = Math.max(1, Math.floor(enemy_power * 0.85));
    }

    const intimidation = state.intimidation ?? 0;
    if (intimidation > 0) {
        const reduction = Math.min(0.5, intimidation * INTIMIDATION_ENEMY_REDUCTION);
        enemy_power = Math.max(1, Math.floor(enemy_power * (1 - reduction)));
        intimidate_msg += ` 你处决俘虏的凶名传开，敌军未战先怯（敌方战力折减 ${Math.floor(reduction * 100)}%）！`;
    }

    let victory = false;
    let gold_gained = 0;
    let casualties = 0;
    const loot_gained: any[] = [];
    const prisoners_gained: Record<string, number> = {};

    if (choice === "retreat") {
        victory = false;
        gold_gained = 0;
        if (total_soldiers > 0) {
            casualties = Math.min(total_soldiers, Math.max(1, Math.floor(enemy_power / 10)));
        } else {
            casualties = 0;
        }

        const loss_detail = apply_casualties(state.troops, casualties);
        let message = `有序撤退避开战斗。伤亡人数：${casualties}。`;
        if (intimidate_msg) {
            message = intimidate_msg + " " + message;
        }
        state.add_log(`遭遇战斗选择撤退。${message}`);
        add_log(state, `战斗撤退，伤亡 ${casualties} 人。`);

        return {
            victory,
            choice,
            player_power,
            enemy_power,
            total_casualties: casualties,
            casualties_detail: loss_detail,
            gold_gained,
            loot_gained,
            prisoners_gained,
            message,
        };

    } else if (choice === "attack") {
        let loss_detail: Record<string, number>;
        let message: string;
        if (player_power >= enemy_power) {
            victory = true;
            gold_gained = enemy_power * 5;
            state.gold += gold_gained;
            if (total_soldiers > 0) {
                const damage_ratio = enemy_power / Math.max(1, player_power);
                casualties = Math.min(total_soldiers, Math.floor(total_soldiers * damage_ratio * 0.3));
            }
            loss_detail = apply_casualties(state.troops, casualties);
            message = `强力进攻取得大胜！获得战利品 ${gold_gained} 金币，伤亡人数：${casualties}。`;
        } else {
            victory = false;
            gold_gained = 0;
            if (total_soldiers > 0) {
                casualties = Math.min(total_soldiers, Math.max(1, Math.floor(total_soldiers * 0.5)));
            }
            loss_detail = apply_casualties(state.troops, casualties);
            message = `进攻受阻不敌对手。伤亡人数：${casualties}。`;
        }

        if (intimidate_msg) {
            message = intimidate_msg + " " + message;
        }

        if (victory) {
            if (Math.random() < 0.3) {
                const eq_id = randomChoice(Object.keys(EQUIPMENT));
                const eq_item = { ...EQUIPMENT[eq_id] };
                state.loot.push(eq_item);
                loot_gained.push(eq_item);
            }

            const p_count = enemy_power > 0 ? Math.max(1, Math.floor(enemy_power * 0.5)) : 0;
            if (p_count > 0) {
                state.prisoners.peasant = (state.prisoners.peasant ?? 0) + p_count;
                prisoners_gained.peasant = p_count;
            }

            for (const q of state.active_quests) {
                if (q.type === "hunt_bandits") {
                    q.current_count = Math.min(q.target_count ?? 1, (q.current_count ?? 0) + 1);
                }
            }
        } else {
            state.battle_lost_today = true;
        }

        const loc_info = get_current_location(state) ?? {};
        const faction_id = loc_info.faction_id;
        if (faction_id && faction_id in state.faction_relations) {
            state.faction_relations[faction_id] -= 10;
            const faction_name = FACTIONS[faction_id]?.name ?? faction_id;
            const faction_notice = `你攻击了 ${faction_name} 的部队，关系下降。`;
            message += ` (${faction_notice})`;
        }

        state.add_log(`选择主动进攻。${message}`);
        add_log(state, `战斗${victory ? "胜利" : "失败"}，伤亡 ${casualties} 人。`);
        return {
            victory,
            choice,
            player_power,
            enemy_power,
            total_casualties: casualties,
            casualties_detail: loss_detail,
            gold_gained,
            loot_gained,
            prisoners_gained,
            message,
        };

    } else if (choice === "defend") {
        const effective_power = Math.floor(player_power * 1.3);
        let loss_detail: Record<string, number>;
        let message: string;
        if (effective_power >= enemy_power) {
            victory = true;
            gold_gained = enemy_power * 2;
            state.gold += gold_gained;
            if (total_soldiers > 0) {
                const damage_ratio = enemy_power / Math.max(1, effective_power);
                casualties = Math.min(total_soldiers, Math.floor(total_soldiers * damage_ratio * 0.15));
            }
            loss_detail = apply_casualties(state.troops, casualties);
            message = `严密坚守击退敌军！获得战利品 ${gold_gained} 金币，伤亡人数：${casualties}。`;
        } else {
            victory = false;
            gold_gained = 0;
            if (total_soldiers > 0) {
                casualties = Math.min(total_soldiers, Math.max(1, Math.floor(total_soldiers * 0.3)));
            }
            loss_detail = apply_casualties(state.troops, casualties);
            message = `防线被打破陷入苦战。伤亡人数：${casualties}。`;
        }

        if (intimidate_msg) {
            message = intimidate_msg + " " + message;
        }

        if (victory) {
            if (Math.random() < 0.3) {
                const eq_id = randomChoice(Object.keys(EQUIPMENT));
                const eq_item = { ...EQUIPMENT[eq_id] };
                state.loot.push(eq_item);
                loot_gained.push(eq_item);
            }

            const p_count = enemy_power > 0 ? Math.max(1, Math.floor(enemy_power * 0.5)) : 0;
            if (p_count > 0) {
                state.prisoners.peasant = (state.prisoners.peasant ?? 0) + p_count;
                prisoners_gained.peasant = p_count;
            }

            for (const q of state.active_quests) {
                if (q.type === "hunt_bandits") {
                    q.current_count = Math.min(q.target_count ?? 1, (q.current_count ?? 0) + 1);
                }
            }
        } else {
            state.battle_lost_today = true;
        }

        const loc_info = get_current_location(state) ?? {};
        const faction_id = loc_info.faction_id;
        if (faction_id && faction_id in state.faction_relations) {
            state.faction_relations[faction_id] -= 10;
            const faction_name = FACTIONS[faction_id]?.name ?? faction_id;
            const faction_notice = `你攻击了 ${faction_name} 的部队，关系下降。`;
            message += ` (${faction_notice})`;
        }

        state.add_log(`选择筑防坚守。${message}`);
        add_log(state, `战斗${victory ? "胜利" : "失败"}，伤亡 ${casualties} 人。`);
        return {
            victory,
            choice,
            player_power,
            enemy_power,
            total_casualties: casualties,
            casualties_detail: loss_detail,
            gold_gained,
            loot_gained,
            prisoners_gained,
            message,
        };

    } else {
        throw new Error(`未知的战斗决策: ${choice}`);
    }
}

/** 在指定地点的奴隶市场出售俘虏。 */
export function sell_prisoners(state: any, location_id: string, unit_id: string, quantity: number): string {
    if (quantity <= 0) {
        return "卖出数量必须大于 0";
    }

    const loc = get_location(state, location_id);
    if (!loc) {
        return `地点 '${location_id}' 不存在`;
    }

    if (!loc.slave_market) {
        return `[${loc.name ?? location_id}] 没有奴隶市场！`;
    }

    const current_prisoners = state.prisoners[unit_id] ?? 0;
    const unit_info = UNITS[unit_id] || {};
    const unit_name = unit_info.name ?? unit_id;

    if (current_prisoners < quantity) {
        return `俘虏数量不足！当前持有 ${unit_name} 俘虏：${current_prisoners}，尝试卖出：${quantity}`;
    }

    const prisoner_val = unit_info.prisoner_value ?? 3;
    const income = prisoner_val * quantity;

    state.prisoners[unit_id] -= quantity;
    state.gold += income;

    const msg = `成功在 [${loc.name}] 卖出 ${quantity} 个 ${unit_name} 俘虏，获得 ${income} 金币。`;
    state.add_log(msg);
    return msg;
}

/** 将俘虏招募为己方士兵。 */
export function recruit_prisoner(state: any, unit_id: string, quantity: number): string {
    if (quantity <= 0) {
        return "招募数量必须大于 0";
    }

    if (state.renown < 20) {
        return `声望不足！招募俘虏需要 20 声望，当前声望：${state.renown}`;
    }

    const current_prisoners = state.prisoners[unit_id] ?? 0;
    const unit_info = UNITS[unit_id] || {};
    const unit_name = unit_info.name ?? unit_id;

    if (current_prisoners < quantity) {
        return `俘虏数量不足！当前持有 ${unit_name} 俘虏：${current_prisoners}，尝试招募：${quantity}`;
    }

    const current_army = (Object.values(state.troops) as number[]).reduce((a, b) => a + b, 0);
    if (current_army + quantity > state.max_army_size) {
        return `超出带兵上限！当前兵力：${current_army}，上限：${state.max_army_size}，无法招募 ${quantity} 人`;
    }

    state.prisoners[unit_id] -= quantity;
    state.troops[unit_id] = (state.troops[unit_id] ?? 0) + quantity;

    const msg = `成功将 ${quantity} 个 ${unit_name} 俘虏招募为士兵！`;
    state.add_log(msg);
    return msg;
}

/** 在城镇竞技场参加 1v1 擂台挑战。 */
export function arena_fight(state: any, location_id: string, rounds: number): string {
    if (rounds <= 0) {
        return "竞技场轮数必须大于 0";
    }

    const loc = get_location(state, location_id);
    if (!loc) {
        return `地点 '${location_id}' 不存在`;
    }

    if (!loc.arena) {
        return `[${loc.name ?? location_id}] 没有竞技场！`;
    }

    let eq_bonus = 0;
    if (state.equipment && typeof state.equipment === "object") {
        for (const eq_id of Object.values(state.equipment) as string[]) {
            if (eq_id in EQUIPMENT) {
                eq_bonus += EQUIPMENT[eq_id].power_bonus ?? 0;
            }
        }
    }

    const player_arena_power = state.personal_power + eq_bonus;

    let wins = 0;
    let losses = 0;
    let gold_change = 0;
    let renown_change = 0;
    let morale_change = 0;

    for (let r = 0; r < rounds; r++) {
        const opp_power = Math.max(1, Math.floor(player_arena_power * (0.8 + Math.random() * 0.4)));
        if (player_arena_power >= opp_power) {
            wins += 1;
            gold_change += 100;
            renown_change += 5;
        } else {
            losses += 1;
            gold_change -= 50;
            morale_change -= 10;
        }
    }

    state.gold = Math.max(0, state.gold + gold_change);
    state.renown = Math.max(0, state.renown + renown_change);
    state.morale = Math.max(0, Math.min(100, state.morale + morale_change));

    const gold_str = gold_change >= 0 ? `+${gold_change}` : `${gold_change}`;
    const renown_str = renown_change >= 0 ? `+${renown_change}` : `${renown_change}`;
    const morale_str = morale_change >= 0 ? `+${morale_change}` : `${morale_change}`;

    const report = `【竞技场结算】在 [${loc.name}] 完成 ${rounds} 轮擂台挑战！战绩: ${wins} 胜 ${losses} 败 | 金币: ${gold_str} | 声望: ${renown_str} | 士气: ${morale_str}`;
    state.add_log(report);
    return report;
}

/** 在指定地点的市场交易商品（买入/卖出）。 */
export function trade(state: any, location_id: string, action: string, goods_id: string, quantity: number): string {
    if (quantity <= 0) {
        return "交易数量必须大于 0";
    }

    const loc = get_location(state, location_id);
    if (!loc) {
        return `地点 '${location_id}' 不存在`;
    }
    if (!loc.market) {
        return `地点 '${loc.name ?? location_id}' 没有市场`;
    }

    let trade_bonus = 0.0;
    for (const c_id of state.companions) {
        const c_info = COMPANIONS[c_id] || {};
        if (c_info.bonus_type === "trade") {
            trade_bonus += c_info.bonus_value ?? 0.0;
        }
    }

    if (["grain", "food"].includes(goods_id)) {
        if (action === "buy") {
            const buy_price = 10;
            const total_cost = buy_price * quantity;
            if (state.cash < total_cost) {
                return `金钱不足！购买 ${quantity} 单位粮食需要 ${total_cost} 金，当前金钱：${state.cash}`;
            }
            state.cash -= total_cost;
            const food_gained = quantity * 10;
            state.food += food_gained;
            const msg = `成功购买 ${quantity} 单位粮食（获得 ${food_gained} 粮食），花费 ${total_cost} 金`;
            state.add_log(msg);
            return msg;
        }
    }

    const market = loc.market || {};
    if (!market || !(goods_id in market)) {
        const goods_name = GOODS[goods_id]?.name ?? goods_id;
        return `${loc.name ?? location_id} 的市场不提供商品 '${goods_name}' 的买卖`;
    }

    const goods_info = GOODS[goods_id] || {};
    const goods_name = goods_info.name ?? goods_id;
    const price_info = market[goods_id];

    if (action === "buy") {
        const buy_price = price_info.buy_price ?? 0;
        const total_cost = buy_price * quantity;
        if (state.cash < total_cost) {
            return `金钱不足！购买 ${quantity} ${goods_name} 需要 ${total_cost} 金，当前金钱：${state.cash}`;
        }
        state.cash -= total_cost;
        state.inventory[goods_id] = (state.inventory[goods_id] ?? 0) + quantity;
        const msg = `成功购买 ${quantity} ${goods_name}，花费 ${total_cost} 金`;
        state.add_log(msg);
        return msg;

    } else if (action === "sell") {
        const base_sell_price = price_info.sell_price ?? 0;
        const price_mult = get_price_multiplier(state, location_id, goods_id);
        const sell_price = Math.floor(base_sell_price * (1.0 + trade_bonus) * price_mult);
        const current_amount = state.inventory[goods_id] ?? 0;
        if (current_amount < quantity) {
            return `${goods_name} 数量不足！当前持有：${current_amount}，尝试卖出：${quantity}`;
        }
        const total_income = sell_price * quantity;
        state.inventory[goods_id] -= quantity;
        state.cash += total_income;
        let msg = `成功卖出 ${quantity} ${goods_name}，获得 ${total_income} 金`;
        if (trade_bonus > 0) {
            msg += `（含同伴交易加成 +${Math.floor(trade_bonus * 100)}%）`;
        }
        if (Math.abs(price_mult - 1.0) > 1e-9) {
            msg += `（${goods_name} 当前行情 ×${price_mult.toFixed(1)}）`;
        }
        state.add_log(msg);
        return msg;

    } else {
        return `未知的交易操作 '${action}'`;
    }
}

/** 在指定地点的兵营招募士兵。 */
export function recruit(state: any, location_id: string, unit_id: string, quantity: number): string {
    if (quantity <= 0) {
        return "招募数量必须大于 0";
    }

    const loc = get_location(state, location_id);
    if (!loc) {
        return `地点 '${location_id}' 不存在`;
    }

    const barracks = loc.barracks || [];
    if (!barracks.length) {
        return `地点 '${loc.name ?? location_id}' 没有兵营`;
    }
    if (!barracks.includes(unit_id)) {
        const unit_name = UNITS[unit_id]?.name ?? unit_id;
        return `${loc.name ?? location_id} 的兵营不可招募 '${unit_name}'`;
    }

    const current_army_count = (Object.values(state.troops) as number[]).reduce((a, b) => a + b, 0);
    if (current_army_count + quantity > state.max_army_size) {
        return `超出带兵上限！当前兵力：${current_army_count}，上限：${state.max_army_size}，无法招募 ${quantity} 人`;
    }

    const unit_info = UNITS[unit_id] || {};
    const unit_name = unit_info.name ?? unit_id;
    const base_cost_per_unit = unit_info.recruit_cost ?? 0;

    let charm = 5;
    if (state.attributes && typeof state.attributes === "object") {
        charm = state.attributes.charm ?? 5;
    }
    const cost_discount = Math.max(0.0, 1.0 - charm * 0.02);
    const discounted_cost_per_unit = Math.max(1, Math.floor(base_cost_per_unit * cost_discount));
    const total_cost = discounted_cost_per_unit * quantity;

    if (state.cash < total_cost) {
        return `金钱不足！招募 ${quantity} ${unit_name} 需要 ${total_cost} 金，当前金钱：${state.cash}`;
    }

    state.cash -= total_cost;
    state.troops[unit_id] = (state.troops[unit_id] ?? 0) + quantity;
    const msg = `成功招募 ${quantity} ${unit_name}，花费 ${total_cost} 金`;
    state.add_log(msg);
    return msg;
}

/** 建国称王逻辑。 */
export function declare_kingdom(state: any, kingdom_name: string): string {
    if (state.is_king) {
        return `你已经建立了王国 [${state.kingdom_name}]，无需重复建国！`;
    }

    if (state.renown < 500) {
        return `声望不足，无法建国！建国需要至少 500 声望，当前声望：${state.renown}。`;
    }

    if (state.fiefs.length < 3) {
        return `封地不足，无法建国！建国需要至少 3 个封地，当前封地数量：${state.fiefs.length}。`;
    }

    state.is_king = true;
    state.kingdom_name = kingdom_name;
    const msg = `恭喜！你成功建立王国 [${kingdom_name}]，自立为王！`;
    state.add_log(msg);
    add_log(state, `伟大的 ${kingdom_name} 成立了！`);
    return msg;
}

/** 分封同伴为领主管理封地。 */
export function assign_lord(state: any, companion_id: string, location_id: string): string {
    if (!state.is_king) {
        return "尚未建国，无法分封领主！";
    }

    if (!state.companions.includes(companion_id)) {
        const comp_name = COMPANIONS[companion_id]?.name ?? companion_id;
        return `未招募同伴 '${comp_name}'！`;
    }

    if (state.lords.includes(companion_id)) {
        const comp_name = COMPANIONS[companion_id]?.name ?? companion_id;
        return `同伴 '${comp_name}' 已经被分封为领主！`;
    }

    if (!state.fiefs.includes(location_id)) {
        const loc_name = get_location(state, location_id)?.name ?? location_id;
        return `地点 '${loc_name}' 不是你的封地！`;
    }

    state.lords.push(companion_id);
    const loc = get_location(state, location_id);
    if (loc) {
        loc.owner = "lord";
    }

    const comp_name = COMPANIONS[companion_id]?.name ?? companion_id;
    const loc_name = get_location(state, location_id)?.name ?? location_id;
    const msg = `成功分封同伴 [${comp_name}] 管理 [${loc_name}]！`;
    state.add_log(msg);
    return msg;
}

/** 制定国家政策。 */
export function set_policy(state: any, policy_id: string): string {
    if (!state.is_king) {
        return "尚未建国，无法制定国家政策！";
    }

    if (!(policy_id in POLICIES)) {
        return `政策 '${policy_id}' 不存在！`;
    }

    const old_policy = state.current_policy;
    if (old_policy !== "conscription" && policy_id === "conscription") {
        state.max_army_size += 20;
    } else if (old_policy === "conscription" && policy_id !== "conscription") {
        state.max_army_size -= 20;
    }

    state.current_policy = policy_id;
    const policy_name = POLICIES[policy_id].name;
    const msg = `成功制定国家政策：[${policy_name}]！`;
    state.add_log(msg);
    return msg;
}

/** 将现有部队兵种晋升为高级兵种。 */
export function upgrade_unit(state: any, unit_id: string, quantity: number): string {
    if (quantity <= 0) {
        return "晋升数量必须大于 0";
    }

    const current_count = state.troops[unit_id] ?? 0;
    const unit_info = UNITS[unit_id] || {};
    const unit_name = unit_info.name ?? unit_id;

    if (current_count < quantity) {
        return `兵员不足！当前拥有 ${unit_name}：${current_count}，尝试晋升：${quantity}`;
    }

    const upgrade_to_id = unit_info.upgrade_to;
    if (!upgrade_to_id || !(upgrade_to_id in UNITS)) {
        return `兵种 '${unit_name}' 无法继续晋升`;
    }

    const target_info = UNITS[upgrade_to_id] || {};
    const target_name = target_info.name ?? upgrade_to_id;
    const upgrade_cost_per_unit = unit_info.upgrade_cost ?? 0;
    const total_cost = upgrade_cost_per_unit * quantity;

    if (state.cash < total_cost) {
        return `金钱不足！晋升 ${quantity} ${unit_name} 需要 ${total_cost} 金，当前金钱：${state.cash}`;
    }

    state.cash -= total_cost;
    state.troops[unit_id] -= quantity;
    state.troops[upgrade_to_id] = (state.troops[upgrade_to_id] ?? 0) + quantity;
    const msg = `成功将 ${quantity} ${unit_name} 晋升为 ${quantity} ${target_name}，花费 ${total_cost} 金`;
    state.add_log(msg);
    return msg;
}

/** 购买钓鱼装备（鱼竿或饵料）。 */
export function buy_gear(state: any, gear_id: string, quantity: number = 1): string {
    if (!(gear_id in FISHING_GEAR)) {
        return `装备/物品 '${gear_id}' 不存在！`;
    }

    if (quantity <= 0) {
        return "购买数量必须大于 0";
    }

    const gear_info = FISHING_GEAR[gear_id];
    const gear_name = gear_info.name;
    const price = gear_info.price;

    if (gear_id === "rod") {
        if (state.equipment_gear?.rod) {
            return "你已经拥有鱼竿，无需重复购买！";
        }
        quantity = 1;
    }

    const total_cost = price * quantity;
    if (state.cash < total_cost) {
        return `金钱不足！购买 ${quantity} 个 [${gear_name}] 需要 ${total_cost} 金，当前金钱：${state.cash}`;
    }

    state.cash -= total_cost;
    let msg = "";
    if (gear_id === "rod") {
        state.equipment_gear.rod = true;
        msg = `成功购买 [${gear_name}]！花费 ${total_cost} 金。`;
    } else if (gear_id === "bait") {
        state.bait_count += quantity;
        msg = `成功购买 ${quantity} 个 [${gear_name}]！花费 ${total_cost} 金。`;
    }

    state.add_log(msg);
    return msg;
}

/** 在可钓鱼地点进行钓鱼行动。 */
export function fish(state: any, location_id: string): string {
    const loc = get_location(state, location_id);
    if (!loc) {
        return `地点 '${location_id}' 不存在`;
    }

    const terrain = loc.terrain_type;
    if (!["river", "lake", "sea"].includes(terrain)) {
        return `[${loc.name ?? location_id}] 不是水源地（河流/湖泊/海边），无法钓鱼！`;
    }

    if (!state.equipment_gear?.rod) {
        return "你没有鱼竿，无法钓鱼！请先购买鱼竿。";
    }

    if (state.bait_count <= 0) {
        return "你的饵料用尽了，无法钓鱼！请先购买饵料。";
    }

    state.bait_count -= 1;

    advance_day(state);
    const daily_report = daily_update(state);

    const items = Object.keys(FISH_LOOT_TABLE);
    const weights = items.map(k => FISH_LOOT_TABLE[k].weight);
    const loot_id = weightedChoice(items, weights);
    const loot_info = FISH_LOOT_TABLE[loot_id];
    const loot_name = loot_info.name;

    state.fish_inventory[loot_id] = (state.fish_inventory[loot_id] ?? 0) + 1;
    let msg = `经过一天的等待，你钓到了 [${loot_name}]！`;

    const companion_notes: string[] = [];
    for (const comp_id of state.companions) {
        const comp_info = COMPANIONS[comp_id] || {};
        if (comp_info.likes_fishing && Math.random() < 0.30) {
            const comp_loot_id = weightedChoice(items, weights);
            const comp_loot_info = FISH_LOOT_TABLE[comp_loot_id];
            const comp_loot_name = comp_loot_info.name;
            state.fish_inventory[comp_loot_id] = (state.fish_inventory[comp_loot_id] ?? 0) + 1;
            const comp_name = comp_info.name ?? comp_id;
            companion_notes.push(`[${comp_name}] 也钓到了一条 [${comp_loot_name}]！`);
        }
    }

    if (companion_notes.length > 0) {
        msg += "\n" + companion_notes.join("\n");
    }

    msg += `\n${daily_report}`;
    state.add_log(`在 [${loc.name}] 钓鱼，获得 [${loot_name}]。`);
    return msg;
}

/** 在拥有市场的地点出售钓到的鱼或垃圾。 */
export function sell_fish(state: any, item_id: string, quantity: number): string {
    if (quantity <= 0) {
        return "出售数量必须大于 0";
    }

    const loc = get_current_location(state);
    if (!loc || loc.market === null || loc.market === undefined) {
        const loc_name = loc ? loc.name : state.location;
        return `[${loc_name}] 没有市场，无法出售物品！`;
    }

    if (!(item_id in FISH_LOOT_TABLE)) {
        return `物品 '${item_id}' 不是钓鱼产物！`;
    }

    const current_qty = state.fish_inventory[item_id] ?? 0;
    const item_info = FISH_LOOT_TABLE[item_id];
    const item_name = item_info.name;

    if (current_qty < quantity) {
        return `[${item_name}] 数量不足！当前持有：${current_qty}，尝试出售：${quantity}`;
    }

    const unit_val = item_info.value;
    const total_income = unit_val * quantity;

    state.fish_inventory[item_id] -= quantity;
    state.cash += total_income;

    const msg = `成功卖出 ${quantity} 个 [${item_name}]，获得 ${total_income} 金币。`;
    state.add_log(msg);
    return msg;
}

/** 访问酒馆，与酒馆老板交互并处理喝酒与听传闻选项。 */
export function visit_tavern(state: any, action: string | null = null, tip_amount: number = 20): any {
    const welcome_dialogue = get_formatted_npc_dialogue("tavern_keeper", "enter_tavern", state);

    if (action === "drink") {
        const cost = Math.max(10, tip_amount);
        if (state.cash < cost) {
            const msg = `金币不足！在酒馆喝酒需要 ${cost} 金，当前只有 ${state.cash} 金。`;
            return {
                success: false,
                welcome: welcome_dialogue,
                dialogue: welcome_dialogue,
                message: msg,
            };
        }

        state.cash -= cost;
        state.morale = Math.min(100, state.morale + 10);
        state.npc_states.tavern_keeper.mood = "happy";
        const drink_dialogue = get_formatted_npc_dialogue("tavern_keeper", "tavern_drink", state);
        const msg = `你花了 ${cost} 金币痛饮了一杯。老板收了你的钱，脸色好多了！（士气 +10）`;
        state.add_log(msg);
        return {
            success: true,
            welcome: welcome_dialogue,
            dialogue: drink_dialogue,
            message: msg,
        };

    } else if (action === "rumor") {
        const rumors = [
            "听说迷雾森林附近近期有匪徒出没，打败他们能拿到不少战利品。",
            "许昌大都的市场特产丰富，运送麦子过去能卖个好价钱！",
            "黑风山上的强盗凶悍无比，没有足够的精兵切勿贸然前往。",
            "竞技场里经常能见到高筹码押注，有眼光的人一晚就能暴富！",
        ];
        const rumor_text = randomChoice(rumors);
        const msg = `【酒馆小道消息】${rumor_text}`;
        state.add_log(msg);
        return {
            success: true,
            welcome: welcome_dialogue,
            dialogue: welcome_dialogue,
            message: msg,
        };
    }

    return {
        success: true,
        welcome: welcome_dialogue,
        dialogue: welcome_dialogue,
        message: "你走进了喧闹的酒馆。",
    };
}

/** 访问铁匠铺，与铁匠交互并处理装备升级选项。 */
export function visit_smithy(state: any, action: string | null = null): any {
    const welcome_dialogue = get_formatted_npc_dialogue("blacksmith", "enter_smithy", state);

    if (action === "upgrade") {
        const cost_gold = 100;
        const cost_iron = 1;
        const iron_count = state.inventory.iron ?? 0;

        if (state.cash < cost_gold || iron_count < cost_iron) {
            state.npc_states.blacksmith.mood = "angry";
            const taunt_dialogue = get_formatted_npc_dialogue("blacksmith", "blacksmith_no_money", state);
            const msg = `资源不足！升级装备需要 ${cost_gold} 金与 ${cost_iron} 单位铁。铁匠见你没钱，气得哼了一声！`;
            state.add_log(msg);
            return {
                success: false,
                welcome: welcome_dialogue,
                dialogue: taunt_dialogue,
                message: msg,
            };
        }

        state.cash -= cost_gold;
        state.inventory.iron -= cost_iron;
        state.personal_power += 3;
        state.npc_states.blacksmith.mood = "happy";
        const upgrade_dialogue = get_formatted_npc_dialogue("blacksmith", "blacksmith_upgrade", state);
        const msg = "升级成功！铁匠为你打造了更精良的兵刃，个人战力 +3！铁匠收了材料与工钱，心情大好！";
        state.add_log(msg);
        return {
            success: true,
            welcome: welcome_dialogue,
            dialogue: upgrade_dialogue,
            message: msg,
        };
    }

    return {
        success: true,
        welcome: welcome_dialogue,
        dialogue: welcome_dialogue,
        message: "你走进了火光熊熊的铁匠铺。",
    };
}

/** 访问竞技场，与主持人交互并处理自己打或押注选项。 */
export function visit_arena(state: any, action: string | null = null, bet_amount: number = 50): any {
    const welcome_dialogue = get_formatted_npc_dialogue("arena_host", "enter_arena", state);

    if (action === "fight") {
        const report = arena_fight(state, state.location, 1);
        return {
            success: true,
            welcome: welcome_dialogue,
            dialogue: welcome_dialogue,
            message: report,
        };

    } else if (action === "bet") {
        if (bet_amount <= 0) {
            return {
                success: false,
                welcome: welcome_dialogue,
                dialogue: welcome_dialogue,
                message: "押注金额必须大于 0！",
            };
        }

        if (state.cash < bet_amount) {
            const msg = `金币不足！无法下注 ${bet_amount} 金币，当前拥有 ${state.cash} 金币。`;
            return {
                success: false,
                welcome: welcome_dialogue,
                dialogue: welcome_dialogue,
                message: msg,
            };
        }

        state.cash -= bet_amount;
        const win = Math.random() < 0.5;

        if (win) {
            const gain = bet_amount * 2;
            state.cash += gain;
            state.npc_states.arena_host.mood = "happy";
            const win_dialogue = get_formatted_npc_dialogue("arena_host", "arena_bet_win", state);
            const msg = `押注胜利！赢得了 ${gain} 金币（净赚 ${bet_amount} 金）。主持人看你赢了大钱，笑脸相迎！`;
            state.add_log(msg);
            return {
                success: true,
                welcome: welcome_dialogue,
                dialogue: win_dialogue,
                message: msg,
            };
        } else {
            state.npc_states.arena_host.mood = "angry";
            const lose_dialogue = get_formatted_npc_dialogue("arena_host", "arena_bet_lose", state);
            const msg = `押注失败！损失了 ${bet_amount} 金币。主持人肆意嘲笑了你的决策！`;
            state.add_log(msg);
            return {
                success: false,
                welcome: welcome_dialogue,
                dialogue: lose_dialogue,
                message: msg,
            };
        }
    }

    return {
        success: true,
        welcome: welcome_dialogue,
        dialogue: welcome_dialogue,
        message: "你来到了热血沸腾的竞技场。",
    };
}

// ===== Phase 14：酒馆真实感重构 —— 三教九流与市井生态 =====

/** 安全地设置某个 NPC 的心情，若其状态条目缺失（旧存档）则自动补建。 */
export function set_npc_mood(state: any, npc_id: string, mood: string): void {
    if (!state.npc_states || typeof state.npc_states !== "object") {
        state.npc_states = {};
    }
    if (!(npc_id in state.npc_states)) {
        state.npc_states[npc_id] = { mood: "neutral", last_interaction: "" };
    }
    state.npc_states[npc_id].mood = mood;
}

/** 聆听游吟诗人弹唱：花费金钱、恢复士气，并逐步解锁大陆世界观故事。 */
export function listen_bard(state: any): any {
    const welcome_dialogue = get_formatted_npc_dialogue("bard", "bard_listen", state);
    if (state.cash < BARD_LISTEN_COST) {
        const msg = `金币不足！聆听一曲需要 ${BARD_LISTEN_COST} 金，你当前只有 ${state.cash} 金。`;
        return { success: false, welcome: welcome_dialogue, dialogue: welcome_dialogue, story: "", message: msg };
    }
    state.cash -= BARD_LISTEN_COST;
    state.morale = Math.min(100, state.morale + BARD_MORALE_GAIN);
    set_npc_mood(state, "bard", "happy");
    const unheard = BARD_STORIES.filter(s => !state.unlocked_lore.includes(s));
    const story = unheard.length > 0 ? randomChoice(unheard) : randomChoice(BARD_STORIES);
    if (unheard.length > 0) {
        state.unlocked_lore.push(story);
    }
    const end_dialogue = get_formatted_npc_dialogue("bard", "bard_story_end", state);
    const msg = `你花 ${BARD_LISTEN_COST} 金听了一段弹唱，心绪为之一振（士气 +${BARD_MORALE_GAIN}）。\n${story}`;
    state.add_log(msg);
    return { success: true, welcome: welcome_dialogue, dialogue: end_dialogue, story, message: msg };
}

/** 与赌徒掷骰子赌博：双方各掷一枚骰子比大小，输赢改变赌徒心情。 */
export function gamble_dice(state: any, bet: number): any {
    const welcome_dialogue = get_formatted_npc_dialogue("gambler", "gambler_invite", state);
    if (bet < GAMBLER_MIN_BET) {
        return {
            success: false,
            welcome: welcome_dialogue,
            dialogue: welcome_dialogue,
            message: `押注过少！赌徒嗤笑一声：最少押 ${GAMBLER_MIN_BET} 金才配坐下。`,
            result: "invalid",
            net: 0,
            player_die: 0,
            gambler_die: 0,
        };
    }
    if (state.cash < bet) {
        set_npc_mood(state, "gambler", "angry");
        return {
            success: false,
            welcome: welcome_dialogue,
            dialogue: welcome_dialogue,
            message: `金币不足！你无法押注 ${bet} 金，当前只有 ${state.cash} 金。赌徒不耐烦地轰你走。`,
            result: "invalid",
            net: 0,
            player_die: 0,
            gambler_die: 0,
        };
    }
    state.cash -= bet;
    const player_die = randomInt(1, 6);
    const gambler_die = randomInt(1, 6);
    let net = 0;
    let result = "";
    let result_dialogue = "";
    let msg = "";

    if (player_die > gambler_die) {
        state.cash += bet * 2;
        net = bet;
        result = "win";
        set_npc_mood(state, "gambler", "angry");
        result_dialogue = get_formatted_npc_dialogue("gambler", "gambler_win", state);
        msg = `骰子落定：你 ${player_die} 点 vs 赌徒 ${gambler_die} 点，你赢了！净赚 ${net} 金。`;
    } else if (player_die < gambler_die) {
        net = -bet;
        result = "lose";
        set_npc_mood(state, "gambler", "happy");
        result_dialogue = get_formatted_npc_dialogue("gambler", "gambler_lose", state);
        msg = `骰子落定：你 ${player_die} 点 vs 赌徒 ${gambler_die} 点，你输了！损失 ${bet} 金。`;
    } else {
        net = 0;
        result = "tie";
        state.cash += bet;
        set_npc_mood(state, "gambler", "neutral");
        result_dialogue = welcome_dialogue;
        msg = `骰子落定：双方都是 ${player_die} 点，平局！赌徒悻悻退还了你的押注。`;
    }
    state.add_log(msg);
    return {
        success: result === "win",
        welcome: welcome_dialogue,
        dialogue: result_dialogue,
        message: msg,
        result,
        net,
        player_die,
        gambler_die,
    };
}

/** 与乞丐进行道德抉择交互：施舍加声望，拒绝则可能被顺手牵羊。 */
export function beggar_interact(state: any, action: string | null = null): any {
    const welcome_dialogue = get_formatted_npc_dialogue("beggar", "beggar_plead", state);
    if (action === "give") {
        const cost = BEGGAR_ALMS;
        if (state.cash < cost) {
            return {
                success: false,
                welcome: welcome_dialogue,
                dialogue: welcome_dialogue,
                message: `你摸了摸干瘪的钱袋，连 ${cost} 金的施舍都拿不出，只得讪讪走开。`,
                stolen: 0,
            };
        }
        state.cash -= cost;
        state.renown += BEGGAR_RENOWN_GAIN;
        set_npc_mood(state, "beggar", "happy");
        const grateful = get_formatted_npc_dialogue("beggar", "beggar_grateful", state);
        const msg = `你施舍了 ${cost} 金。乞丐千恩万谢，你的仁义之名悄然传开（声望 +${BEGGAR_RENOWN_GAIN}）。`;
        state.add_log(msg);
        return { success: true, welcome: welcome_dialogue, dialogue: grateful, message: msg, stolen: 0 };

    } else if (action === "refuse") {
        set_npc_mood(state, "beggar", "angry");
        const curse = get_formatted_npc_dialogue("beggar", "beggar_curse", state);
        let stolen = 0;
        let msg = "";
        if (state.cash > 0 && Math.random() < BEGGAR_STEAL_CHANCE) {
            stolen = Math.min(BEGGAR_STEAL_AMOUNT, state.cash);
            state.cash -= stolen;
            msg = `你冷冷拒绝。乞丐眼中闪过一丝怨毒，趁乱摸走了你 ${stolen} 金！(声望未增)`;
        } else {
            msg = "你摇了摇头，转身离去。乞丐在身后咒骂了几句，却不敢真的动手。";
        }
        state.add_log(msg);
        return { success: true, welcome: welcome_dialogue, dialogue: curse, message: msg, stolen };
    }

    return {
        success: true,
        welcome: welcome_dialogue,
        dialogue: welcome_dialogue,
        message: "一个衣衫褴褛的乞丐拦在你面前，伸出枯瘦的手乞求施舍。",
        stolen: 0,
    };
}

/** 招揽酒馆中的逃兵：强力但会因窝藏逃兵而得罪各势力。 */
export function recruit_deserter(state: any): any {
    const welcome_dialogue = get_formatted_npc_dialogue("deserter", "deserter_hide", state);
    if (state.deserter_recruited) {
        return {
            success: false,
            welcome: welcome_dialogue,
            dialogue: welcome_dialogue,
            message: "那名逃兵早已归入你的麾下，此刻正在营中当值。",
        };
    }
    if (state.cash < DESERTER_RECRUIT_COST) {
        return {
            success: false,
            welcome: welcome_dialogue,
            dialogue: welcome_dialogue,
            message: `金币不足！替逃兵打点官府、收买缉兵需要 ${DESERTER_RECRUIT_COST} 金，你当前只有 ${state.cash} 金。`,
        };
    }
    state.cash -= DESERTER_RECRUIT_COST;
    state.deserter_recruited = true;
    state.personal_power += DESERTER_POWER_BONUS;
    state.max_army_size += DESERTER_ARMY_BONUS;
    for (const fid of Object.keys(state.faction_relations)) {
        state.faction_relations[fid] -= DESERTER_RELATION_PENALTY;
    }
    set_npc_mood(state, "deserter", "happy");
    const join_dialogue = get_formatted_npc_dialogue("deserter", "deserter_join", state);
    const msg = `你花 ${DESERTER_RECRUIT_COST} 金替逃兵打点了官府，将他收为麾下死士！` +
        `（个人战力 +${DESERTER_POWER_BONUS}，带兵上限 +${DESERTER_ARMY_BONUS}）` +
        `但窝藏逃兵的行径传了出去，三大势力对你的观感皆下降 ${DESERTER_RELATION_PENALTY} 点。`;
    state.add_log(msg);
    return { success: true, welcome: welcome_dialogue, dialogue: join_dialogue, message: msg };
}

/** 婉拒逃兵的投靠请求，仅返回其台词而不改变数值。 */
export function decline_deserter(state: any): any {
    const welcome_dialogue = get_formatted_npc_dialogue("deserter", "deserter_hide", state);
    const refuse_dialogue = get_formatted_npc_dialogue("deserter", "deserter_refuse", state);
    return {
        success: true,
        welcome: welcome_dialogue,
        dialogue: refuse_dialogue,
        message: "你婉言谢绝了逃兵的投靠，他黯然退回了酒馆的阴影里。",
    };
}

// ===== Phase 15：战场真实感 —— 打扫战场与俘虏处理 =====

/** 战后快速撤离：安全返回，不消耗额外天数、无额外收益。 */
export function quick_withdraw(state: any): any {
    const msg = "你当机立断，率部快速撤离了战场，敌军残部无从追击，全军而退。";
    state.add_log(msg);
    add_log(state, "战后快速撤离，安全返回。");
    return { success: true, message: msg, days: 0 };
}

/** 打扫战场：耗时 1-2 天，获得高额金币与概率装备，但有概率遭遇伏击。 */
export function scavenge_battlefield(state: any, enemy_power: number = 10): any {
    const days = randomInt(SCAVENGE_MIN_DAYS, SCAVENGE_MAX_DAYS);
    const gold_gained = Math.max(10, enemy_power * SCAVENGE_GOLD_PER_ENEMY_POWER);
    state.cash += gold_gained;
    const loot_gained: any[] = [];
    if (Math.random() < SCAVENGE_LOOT_CHANCE) {
        const eq_id = randomChoice(Object.keys(EQUIPMENT));
        const eq_item = { ...EQUIPMENT[eq_id] };
        state.loot.push(eq_item);
        loot_gained.push(eq_item);
    }
    const narr = randomChoice(SCAVENGE_SUCCESS_TEXTS);
    let msg = `你决定打扫战场。${narr}获得 ${gold_gained} 金币`;
    if (loot_gained.length > 0) {
        msg += `，并搜得装备 [${loot_gained[0].name}]`;
    }
    let ambushed = false;
    let losses = 0;
    let stolen_gold = 0;
    if (Math.random() < SCAVENGE_AMBUSH_CHANCE) {
        ambushed = true;
        const ambush_text = randomChoice(SCAVENGE_AMBUSH_TEXTS);
        const total_soldiers = (Object.values(state.troops) as number[]).reduce((a, b) => a + b, 0);
        msg += `\n【遭遇伏击】${ambush_text}`;
        if (total_soldiers > 0 && Math.random() < 0.6) {
            losses = Math.min(total_soldiers, randomInt(1, 3));
            apply_casualties(state.troops, losses);
            msg += ` 混战之中，你损失了 ${losses} 名士兵！`;
        } else {
            stolen_gold = Math.min(state.cash, randomInt(20, 60));
            state.cash -= stolen_gold;
            msg += ` 慌乱之中，被夺走了 ${stolen_gold} 金币！`;
        }
    }
    const reports: string[] = [];
    for (let i = 0; i < days; i++) {
        advance_day(state);
        reports.push(daily_update(state));
    }
    msg += `\n打扫战场共耗时 ${days} 天。`;
    state.add_log(msg);
    add_log(state, `打扫战场耗时 ${days} 天` + (ambushed ? "，途中遭遇伏击" : ""));
    return {
        success: true,
        message: msg,
        days,
        gold_gained,
        loot_gained,
        ambushed,
        reports,
    };
}

function _get_prisoner_unit_name(unit_id: string): string {
    return UNITS[unit_id]?.name ?? unit_id;
}

function _reduce_faction_relation(state: any, penalty: number): string {
    const loc = get_current_location(state) ?? {};
    const faction_id = loc.faction_id;
    if (faction_id && faction_id in state.faction_relations) {
        state.faction_relations[faction_id] -= penalty;
        return FACTIONS[faction_id]?.name ?? faction_id;
    }
    for (const fid of Object.keys(state.faction_relations)) {
        state.faction_relations[fid] -= penalty;
    }
    return "各大势力";
}

/** 索要赎金：换取大量金币，但会降低势力关系。 */
export function ransom_prisoners(state: any, unit_id: string, quantity: number): string {
    if (quantity <= 0) {
        return "数量必须大于 0";
    }
    const have = state.prisoners[unit_id] ?? 0;
    if (have < quantity) {
        const unit_name = _get_prisoner_unit_name(unit_id);
        return `俘虏不足！当前 ${unit_name} 俘虏：${have}，尝试勒索：${quantity}`;
    }
    const unit_name = _get_prisoner_unit_name(unit_id);
    const income = RANSOM_GOLD_PER_PRISONER * quantity;
    state.prisoners[unit_id] -= quantity;
    state.cash += income;
    const hit_faction = _reduce_faction_relation(state, RANSOM_RELATION_PENALTY);
    const msg = `你派使者向俘虏的家族索要赎金，成功换得 ${income} 金币！但此举令 ${hit_faction} 对你的观感下降 ${RANSOM_RELATION_PENALTY} 点。`;
    state.add_log(msg);
    return msg;
}

/** 释放俘虏：赢得声望与仁义之名（提升道德值）。 */
export function release_prisoners(state: any, unit_id: string, quantity: number): string {
    if (quantity <= 0) {
        return "数量必须大于 0";
    }
    const have = state.prisoners[unit_id] ?? 0;
    if (have < quantity) {
        const unit_name = _get_prisoner_unit_name(unit_id);
        return `俘虏不足！当前 ${unit_name} 俘虏：${have}，尝试释放：${quantity}`;
    }
    const unit_name = _get_prisoner_unit_name(unit_id);
    state.prisoners[unit_id] -= quantity;
    const renown_gain = RELEASE_RENOWN_PER_PRISONER * quantity;
    const morality_gain = RELEASE_MORALITY_GAIN * quantity;
    state.renown += renown_gain;
    state.morality = Math.min(100, state.morality + morality_gain);
    const msg = `你解开了 ${quantity} 名 ${unit_name} 俘虏的绳索，放他们归乡。你的仁义之名远播（声望 +${renown_gain}，道德 +${morality_gain}）。`;
    state.add_log(msg);
    return msg;
}

/** 处决俘虏：道德大损、势力震怒，但积累威慑值并折减来犯敌军战力。 */
export function execute_prisoners(state: any, unit_id: string, quantity: number): string {
    if (quantity <= 0) {
        return "数量必须大于 0";
    }
    const have = state.prisoners[unit_id] ?? 0;
    if (have < quantity) {
        const unit_name = _get_prisoner_unit_name(unit_id);
        return `俘虏不足！当前 ${unit_name} 俘虏：${have}，尝试处决：${quantity}`;
    }
    const unit_name = _get_prisoner_unit_name(unit_id);
    state.prisoners[unit_id] -= quantity;
    state.morality = Math.max(0, state.morality - EXECUTE_MORALITY_LOSS * quantity);
    state.intimidation = Math.min(INTIMIDATION_CAP, state.intimidation + EXECUTE_INTIMIDATION_GAIN * quantity);
    state.renown += EXECUTE_RENOWN_GAIN * quantity;
    const hit_faction = _reduce_faction_relation(state, EXECUTE_RELATION_PENALTY);
    let msg = `你下令当众处决了 ${quantity} 名 ${unit_name} 俘虏！你的凶名传遍四方` +
        `（威慑 +${EXECUTE_INTIMIDATION_GAIN * quantity}，声望 +${EXECUTE_RENOWN_GAIN * quantity}），` +
        `但道德大损、${hit_faction} 对你怒不可遏（关系 -${EXECUTE_RELATION_PENALTY}）。`;

    const loc_faction = get_current_location(state)?.faction_id;
    if (loc_faction) {
        const lords = lords_of_faction(loc_faction);
        if (lords.length > 0) {
            const angered = randomChoice(lords);
            if (provoke_lord_grudge(state, angered.id)) {
                msg += `\n【结下血仇】${angered.title} 因你残害其子民而与你结怨，其家族将世代记恨。`;
            }
        }
    }

    state.add_log(msg);
    return msg;
}

/** 战斗胜利后，已招募同伴依据各自性格对分赃发表意见。 */
export function get_loot_opinion_quotes(state: any): string[] {
    const quotes: string[] = [];
    const comps = state.companions || [];
    for (const comp_id of comps) {
        let comp_info = COMPANIONS[comp_id];
        if (!comp_info) {
            comp_info = { id: comp_id, name: comp_id, personality: "cautious" } as any;
        }
        const comp_name = comp_info.name ?? comp_id;
        const text = get_dialogue(comp_info, "loot_opinion", state);
        quotes.push(`[${comp_name}]: “${text}”`);
    }
    return quotes;
}

// ===== Phase 16：世界真实感 —— 领主、动态新闻与恩怨系统 =====

/** 返回某势力旗下的全部领主（按名册插入顺序）。 */
export function lords_of_faction(faction_id: string): any[] {
    return Object.values(LORDS).filter(lord => lord.faction_id === faction_id);
}

/** 返回某势力的主要领主（名册首位），用于决定其治下任务报酬风格。 */
export function get_faction_lord(faction_id: string): any | null {
    const lords = lords_of_faction(faction_id);
    return lords.length > 0 ? lords[0] : null;
}

/** 记录与某领主结下的血仇；若已存在或领主非法则返回 False。 */
export function provoke_lord_grudge(state: any, lord_id: string): boolean {
    if (!(lord_id in LORDS)) {
        return false;
    }
    if (!state.lord_grudges || !Array.isArray(state.lord_grudges)) {
        state.lord_grudges = [];
    }
    if (state.lord_grudges.includes(lord_id)) {
        return false;
    }
    state.lord_grudges.push(lord_id);
    add_log(state, `你与 ${LORDS[lord_id].title} 结下了血仇。`);
    return true;
}

/** 每日结算：与你结怨的领主，其所属势力关系持续缓慢恶化（永不修复）。 */
export function apply_lord_grudge_decay(state: any): void {
    const grudges = state.lord_grudges || [];
    if (grudges.length === 0) {
        return;
    }
    for (const lord_id of grudges) {
        const lord = LORDS[lord_id];
        if (!lord) {
            continue;
        }
        const fid = lord.faction_id;
        if (fid in state.faction_relations) {
            state.faction_relations[fid] -= LORD_GRUDGE_DECAY;
        }
    }
}

/** 判断某领主对你的立场：血仇 / 敌对 / 友好 / 中立。 */
export function get_lord_stance(state: any, lord_id: string): string {
    const lord = LORDS[lord_id];
    if (!lord) {
        return "unknown";
    }
    if ((state.lord_grudges || []).includes(lord_id)) {
        return "grudge";
    }
    const rel = state.faction_relations[lord.faction_id] ?? 0;
    if (rel <= -20) {
        return "hostile";
    }
    if (rel >= 40) {
        return "friendly";
    }
    return "neutral";
}

/** 拜会领主：依据声望、性格与恩怨返回动态台词与当前立场。 */
export function meet_lord(state: any, lord_id: string): any {
    const lord = LORDS[lord_id];
    if (!lord) {
        return { success: false, title: "", stance: "unknown", dialogue: "", message: `查无此领主: '${lord_id}'` };
    }
    const stance = get_lord_stance(state, lord_id);
    const npc = { ...lord } as any;
    if (stance === "grudge") {
        npc.mood = "angry";
    }
    const dialogue = get_formatted_npc_dialogue(npc, "lord_talk", state);
    const stance_label = ({ grudge: "血仇", hostile: "敌对", friendly: "友好", neutral: "中立" } as Record<string, string>)[stance] ?? "未知";
    const faction_name = FACTIONS[lord.faction_id].name;
    const msg = `你拜会了 ${lord.title}。（所属：${faction_name}，当前立场：${stance_label}）`;
    state.add_log(msg);
    return { success: true, title: lord.title, stance, dialogue, message: msg };
}

/** 按概率生成一条世界新闻并写入 state.world_news（会真实影响物价）。 */
export function generate_world_news(state: any): any | null {
    if (!state.world_news || !Array.isArray(state.world_news)) {
        state.world_news = [];
    }
    if (Math.random() >= WORLD_NEWS_CHANCE) {
        return null;
    }
    const tpl = randomChoice(NEWS_TEMPLATES);
    let desc = "";
    let location_id: string | null = null;
    if (tpl.scope === "location") {
        const loc_id = randomChoice(Object.keys(LOCATIONS));
        desc = tpl.template.replace("{loc}", LOCATIONS[loc_id].name);
        location_id = loc_id;
    } else {
        const fid = randomChoice(Object.keys(FACTIONS));
        desc = tpl.template.replace("{faction}", FACTIONS[fid].name);
        location_id = null;
    }
    const entry = {
        id: `news_${state.day}_${randomInt(1, 9999)}`,
        day: state.day,
        type: tpl.type,
        desc: desc,
        goods: tpl.goods,
        sell_multiplier: tpl.sell_multiplier,
        location_id: location_id,
        expires_day: state.day + tpl.duration,
    };
    state.world_news.push(entry);
    if (state.world_news.length > WORLD_NEWS_HISTORY_LIMIT) {
        state.world_news = state.world_news.slice(-WORLD_NEWS_HISTORY_LIMIT);
    }
    state.add_log(`【世界新闻】${desc}`);
    add_log(state, `世界新闻：${desc}`);
    return entry;
}

/** 返回当前尚未过期的世界新闻列表。 */
export function get_active_news(state: any): any[] {
    const news_list = state.world_news || [];
    return news_list.filter((n: any) => state.day <= (n.expires_day ?? 0));
}

/** 依据当前生效的世界新闻，计算某地点某商品卖出价的倍率（最低 0.1）。 */
export function get_price_multiplier(state: any, location_id: string, goods_id: string): number {
    let multiplier = 1.0;
    for (const news of get_active_news(state)) {
        if (news.goods !== goods_id) {
            continue;
        }
        const nloc = news.location_id;
        if (nloc !== null && nloc !== undefined && nloc !== location_id) {
            continue;
        }
        multiplier *= news.sell_multiplier ?? 1.0;
    }
    return Math.max(0.1, multiplier);
}

// ===== Phase 17：经济真实感 —— 产业链加工与讨价还价 =====

/** 判断某地点是否拥有指定加工设施。 */
export function has_facility(location_id: string, facility: string, state?: any): boolean {
    const loc = (state ? get_location(state, location_id) : LOCATIONS[location_id]) || {};
    const facilities = loc.facilities || [];
    return facilities.includes(facility);
}

/** 返回某地点凭借现有设施可承接的加工配方列表。 */
export function list_recipes(location_id: string): any[] {
    return Object.values(RECIPES).filter(r => has_facility(location_id, r.facility));
}

/** 委托加工：以原料 + 手续费换取更高价值的成品。 */
export function commission_crafting(state: any, recipe_id: string, location_id: string | null = null): string {
    const loc_id = location_id !== null ? location_id : state.location;
    const recipe = RECIPES[recipe_id];
    if (!recipe) {
        return `未知的加工配方 '${recipe_id}'`;
    }
    const loc = get_location(state, loc_id) ?? {};
    const fac_name = FACILITY_NAMES[recipe.facility] ?? "工坊";
    if (!has_facility(loc_id, recipe.facility, state)) {
        return `[${loc.name ?? loc_id}] 没有${fac_name}，无法进行 [${recipe.name}] 加工！`;
    }
    const in_goods = recipe.input_goods;
    const in_amount = recipe.input_amount;
    const fee = recipe.fee;
    const in_name = GOODS[in_goods]?.name ?? in_goods;
    const have = state.inventory[in_goods] ?? 0;
    if (have < in_amount) {
        return `原料不足！[${recipe.name}] 需要 ${in_amount} 单位 ${in_name}，当前持有 ${have}`;
    }
    if (state.cash < fee) {
        return `金钱不足！[${recipe.name}] 委托手续费需 ${fee} 金，当前只有 ${state.cash} 金`;
    }
    const out_goods = recipe.output_goods;
    const out_amount = recipe.output_amount;
    const out_name = GOODS[out_goods]?.name ?? out_goods;
    state.inventory[in_goods] -= in_amount;
    state.cash -= fee;
    state.inventory[out_goods] = (state.inventory[out_goods] ?? 0) + out_amount;
    const msg = `你在 [${loc.name ?? loc_id}] 的${fac_name}委托 [${recipe.name}]：` +
        `${in_amount} ${in_name} + ${fee} 金手续费 → ${out_amount} ${out_name}。成品售价远高于原料！`;
    state.add_log(msg);
    return msg;
}

/** 讨价还价交易：魅力决定议价空间，掷骰决定成败，并叠加世界新闻行情。不改动原 trade()。 */
export function haggle_trade(state: any, location_id: string, action: string, goods_id: string, quantity: number): any {
    const loc = get_location(state, location_id) ?? {};
    const market = loc.market || {};
    const goods_name = GOODS[goods_id]?.name ?? goods_id;
    if (quantity <= 0) {
        return { success: false, result: "invalid", discount: 0.0, dialogue: "", message: "交易数量必须大于 0" };
    }
    if (!market || !(goods_id in market)) {
        return {
            success: false,
            result: "invalid",
            discount: 0.0,
            dialogue: "",
            message: `${loc.name ?? location_id} 不提供 ${goods_name} 的买卖`,
        };
    }
    const price_info = market[goods_id];
    const price_mult = get_price_multiplier(state, location_id, goods_id);
    let ref_price = 0;
    if (action === "buy") {
        ref_price = (price_info.buy_price ?? 0) * price_mult;
    } else if (action === "sell") {
        ref_price = (price_info.sell_price ?? 0) * price_mult;
    } else {
        return { success: false, result: "invalid", discount: 0.0, dialogue: "", message: `未知的交易操作 '${action}'` };
    }

    let charm = 5;
    if (state.attributes && typeof state.attributes === "object") {
        charm = state.attributes.charm ?? 5;
    }
    const base_power = Math.min(HAGGLE_MAX_DISCOUNT, charm * HAGGLE_CHARM_FACTOR);
    const roll = Math.random();
    let result = "";
    let discount = 0.0;
    let dialogue = "";

    if (roll < HAGGLE_FAIL_RATE) {
        result = "fail";
        discount = 0.0;
        dialogue = get_formatted_npc_dialogue("merchant", "haggle_fail", state);
    } else if (roll < HAGGLE_FAIL_RATE + HAGGLE_BIG_SUCCESS_RATE) {
        result = "big";
        discount = Math.min(HAGGLE_MAX_DISCOUNT, base_power * 1.5);
        dialogue = get_formatted_npc_dialogue("merchant", "haggle_win", state);
    } else {
        result = "ok";
        discount = base_power;
        dialogue = get_formatted_npc_dialogue("merchant", "haggle_ok", state);
    }

    if (action === "buy") {
        const unit = Math.max(1, Math.floor(ref_price * (1 - discount)));
        const total = unit * quantity;
        if (state.cash < total) {
            return {
                success: false,
                result,
                discount,
                dialogue,
                message: `金钱不足！议定单价 ${unit} 金，购买 ${quantity} ${goods_name} 需 ${total} 金，当前 ${state.cash} 金`,
            };
        }
        state.cash -= total;
        state.inventory[goods_id] = (state.inventory[goods_id] ?? 0) + quantity;
        const msg = `讨价还价后买入 ${quantity} ${goods_name}，单价 ${unit} 金（原价 ${Math.floor(ref_price)}），共 ${total} 金。`;
        state.add_log(msg);
        return { success: true, result, discount, dialogue, message: msg };
    } else {
        const have = state.inventory[goods_id] ?? 0;
        if (have < quantity) {
            return {
                success: false,
                result,
                discount,
                dialogue,
                message: `${goods_name} 数量不足！当前持有 ${have}，尝试卖出 ${quantity}`,
            };
        }
        const unit = Math.floor(ref_price * (1 + discount));
        const total = unit * quantity;
        state.inventory[goods_id] -= quantity;
        state.cash += total;
        const msg = `讨价还价后卖出 ${quantity} ${goods_name}，单价 ${unit} 金（原价 ${Math.floor(ref_price)}），共 ${total} 金。`;
        state.add_log(msg);
        return { success: true, result, discount, dialogue, message: msg };
    }
}

// ==================== 区域辅助函数 ====================

/** 返回所有可游玩区域配置。 */
export function get_all_regions(): RegionConfig[] {
    return WORLD_REGIONS;
}

/** 初始化区域：根据 regionId 生成区域地图并存入 state。 */
/** 区域出生点选择：优先有市场的地点。 */
function pick_region_spawn(locs: Record<string, any>): any | null {
    const list = Object.values(locs);
    if (list.length === 0) return null;
    return list.find(l => !!l.market) ?? list[0];
}

export function init_region(state: any, regionId: string, force: boolean = false): string {
    // 幂等：同一区域已生成且未强制，复用已有数据
    if (!force && state.selected_region === regionId && state.region_locations && Object.keys(state.region_locations).length > 0) {
        if (state.region_locations[state.location]) {
            return `已在区域内，地点正常`;
        }
        const spawn = pick_region_spawn(state.region_locations);
        if (spawn) {
            state.location = spawn.id;
            return `已修复区域地点指针 → ${spawn.name}`;
        }
        return `区域地点数据异常`;
    }
    const region = get_region(regionId);
    if (!region) {
        return `区域 '${regionId}' 不存在`;
    }
    const generated = generate_region_map(region);
    state.selected_region = regionId;
    state.region_locations = generated;
    const spawn = pick_region_spawn(generated);
    if (!spawn) {
        return `区域生成失败：无可用地点`;
    }
    state.location = spawn.id;
    state.add_log(`你来到了 ${region.name} 的 ${spawn.name}，开始了新的征途。`);
    return `已初始化区域: ${region.name}`;
}

/** 获取当前选中的区域配置。 */
export function get_current_region(state: any): RegionConfig | null {
    if (!state.selected_region) return null;
    return get_region(state.selected_region) ?? null;
}

/** 获取当前所在地对象（自动区分区域模式/经典模式）。 */
/** 统一地点解析：优先当前区域的生成地点，回退经典 LOCATIONS。经典模式行为不变。 */
export function get_location(state: any, location_id: string | null | undefined): any | null {
    if (!location_id) return null;
    if (state.selected_region && state.region_locations) {
        const region_loc = state.region_locations[location_id];
        if (region_loc) return region_loc;
    }
    return LOCATIONS[location_id] ?? null;
}

export function get_current_location(state: any): any | null {
    return get_location(state, state.location);
}

/** 区域模式下的移动（镜像 move()，使用 region_locations 和 terrain 成本）。 */
export function move_region(state: any, targetId: string): [boolean, string, any] {
    if (!state.selected_region) {
        return [false, "未选择区域，无法进行区域移动", null];
    }
    const locs = state.region_locations;
    const current = locs[state.location];
    const target = locs[targetId];
    if (!current || !target) {
        return [false, "目标地点不存在", null];
    }
    if (!current.neighbors?.includes(targetId)) {
        return [false, `无法从 ${current.name} 前往 ${target.name}`, null];
    }
    // 使用地形移动成本
    advance_day(state);
    state.location = targetId;
    state.morale = Math.max(0, state.morale - 5);
    // 检查地形事件
    const event = select_random_event();
    const event_data = { ...event };
    const evt = event.type;
    if (evt === "caravan" || evt === "treasure") {
        const gold = event.gold_reward ?? 30;
        state.gold += gold;
        event_data.enemy_power = 0;
        event_data.type = evt;
        event_data.description = `移动至 ${target.name}：${event.description} 获得 ${gold} 金币。`;
    } else if (evt === "combat") {
        const min_pow = event.enemy_power_min ?? 5;
        const max_pow = event.enemy_power_max ?? 20;
        event_data.enemy_power = randomInt(min_pow, max_pow);
        event_data.type = evt;
        event_data.description = `移动至 ${target.name}：${event.description} 敌方战力：${event_data.enemy_power}。`;
    } else {
        event_data.type = "nothing";
        event_data.description = event.description;
    }
    state.add_log(`移动至 ${target.name}。`);
    return [true, `到达 ${target.name}`, event_data];
}

// ==================== 佣兵/骑士团信息查询 ====================

/** 获取当前佣兵契约的显示信息（若未签约返回 null）。 */
export function get_mercenary_info(state: any): any | null {
    const contract = state.mercenary_contract;
    if (!contract) return null;
    const lord = LORDS[contract.lord_id];
    const rankInfo = MERCENARY_RANKS[contract.rank];
    if (!lord || !rankInfo) return null;
    const wageInterval = MERCENARY_CONTRACT_WAGE_INTERVAL;
    const wageElapsed = contract.days_served - contract.last_wage_day;
    const wageRem = wageInterval > 0 ? ((wageElapsed % wageInterval) + wageInterval) % wageInterval : 0;
    const days_until_wage = wageInterval <= 0 ? 0 : (wageRem === 0 && wageElapsed > 0) ? 0 : wageInterval - wageRem;
    return {
        lord_name: lord.name,
        faction_name: FACTIONS[lord.faction_id]?.name ?? "未知",
        rank_name: rankInfo.name,
        wage: rankInfo.wage,
        days_served: contract.days_served,
        days_until_wage,
        perk: rankInfo.perk,
    };
}

/** 获取当前骑士团信息的显示摘要（若未入团返回 null）。 */
export function get_knight_order_info(state: any): any | null {
    const orderId = state.knight_order;
    if (!orderId) return null;
    const order = KNIGHT_ORDERS[orderId];
    if (!order) return null;
    return {
        order_name: order.name,
        desc: order.desc,
        vows: order.vows,
    };
}

/** 原子退出区域：清 selected_region 同时把 location 落回有效经典地点，防反向悬空。 */
export function exit_region(state: any, classic_location_id: string): string {
    const target = LOCATIONS[classic_location_id];
    if (!target) return `经典地点 '${classic_location_id}' 不存在`;
    state.selected_region = null;
    state.region_locations = null;
    state.location = classic_location_id;
    state.add_log(`你离开了区域，回到了 ${target.name}。`);
    return `已返回大地图：${target.name}`;
}
