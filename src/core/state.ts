import * as fs from "fs";

export interface GameStateData {
    day?: number;
    gold?: number;
    location?: string;
    morale?: number;
    troops?: Record<string, number>;
    inventory?: Record<string, number>;
    logs?: string[];
    companions?: string[];
    fiefs?: string[];
    renown?: number;
    food?: number;
    max_army_size?: number;
    equipment?: Record<string, string>;
    prisoners?: Record<string, number>;
    personal_power?: number;
    loot?: any[];
    faction_relations?: Record<string, number>;
    active_quests?: any[];
    completed_quests?: any[];
    is_king?: boolean;
    kingdom_name?: string;
    current_policy?: string | null;
    lords?: any[];
    log_history?: any[];
    equipment_gear?: Record<string, boolean>;
    bait_count?: number;
    fish_inventory?: Record<string, number>;
    battle_lost_today?: boolean;
    npc_states?: Record<string, { mood: string; last_interaction: string }>;
    attributes?: Record<string, number>;
    appearance?: number;
    appearance_revealed?: boolean;
    current_equipment?: Record<string, any>;
    deserter_recruited?: boolean;
    unlocked_lore?: string[];
    morality?: number;
    intimidation?: number;
    world_news?: any[];
    lord_grudges?: string[];
}

/** 管理游戏世界的持久化状态数据结构。 */
export class GameState {
    day: number;
    gold: number;
    location: string;
    morale: number;
    troops: Record<string, number>;
    inventory: Record<string, number>;
    logs: string[];
    companions: string[];
    fiefs: string[];
    renown: number;
    food: number;
    max_army_size: number;
    equipment: Record<string, string>;
    prisoners: Record<string, number>;
    personal_power: number;
    loot: any[];
    faction_relations: Record<string, number>;
    active_quests: any[];
    completed_quests: any[];
    is_king: boolean;
    kingdom_name: string;
    current_policy: string | null;
    lords: any[];
    log_history: any[];
    equipment_gear: Record<string, boolean>;
    bait_count: number;
    fish_inventory: Record<string, number>;
    battle_lost_today: boolean;
    npc_states: Record<string, { mood: string; last_interaction: string }>;
    attributes: Record<string, number>;
    appearance: number;
    appearance_revealed: boolean;
    current_equipment: Record<string, any>;
    deserter_recruited: boolean;
    unlocked_lore: string[];
    morality: number;
    intimidation: number;
    world_news: any[];
    lord_grudges: string[];

    constructor(data: GameStateData = {}) {
        this.day = data.day ?? 1;
        this.gold = data.gold ?? 100;
        this.location = data.location ?? "oak_village";
        this.morale = Math.max(0, Math.min(100, data.morale ?? 100));
        this.troops = data.troops ? { ...data.troops } : { peasant: 0, infantry: 0, archer: 0 };
        this.inventory = data.inventory ? { ...data.inventory } : { wheat: 0, iron: 0 };
        this.logs = data.logs ? [...data.logs] : [];
        this.companions = data.companions ? [...data.companions] : [];
        this.fiefs = data.fiefs ? [...data.fiefs] : [];
        this.renown = data.renown ?? 0;
        this.food = data.food ?? 100;
        this.max_army_size = data.max_army_size ?? 20;
        this.equipment = data.equipment ? { ...data.equipment } : {};
        this.prisoners = data.prisoners ? { ...data.prisoners } : {};
        this.personal_power = data.personal_power ?? 10;
        this.loot = data.loot ? [...data.loot] : [];
        this.faction_relations = data.faction_relations ? { ...data.faction_relations } : { f1: 0, f2: 0, f3: 0 };
        this.active_quests = data.active_quests ? [...data.active_quests] : [];
        this.completed_quests = data.completed_quests ? [...data.completed_quests] : [];
        this.is_king = data.is_king ?? false;
        this.kingdom_name = data.kingdom_name ?? "";
        this.current_policy = data.current_policy ?? null;
        this.lords = data.lords ? [...data.lords] : [];
        this.log_history = data.log_history ? [...data.log_history] : [];
        this.equipment_gear = data.equipment_gear ? { ...data.equipment_gear } : { rod: false };
        this.bait_count = data.bait_count ?? 0;
        this.fish_inventory = data.fish_inventory ? { ...data.fish_inventory } : {};
        this.battle_lost_today = data.battle_lost_today ?? false;
        if (data.npc_states !== undefined && data.npc_states !== null) {
            this.npc_states = { ...data.npc_states };
        } else {
            this.npc_states = {
                tavern_keeper: { mood: "neutral", last_interaction: "" },
                blacksmith: { mood: "neutral", last_interaction: "" },
                arena_host: { mood: "neutral", last_interaction: "" },
                bard: { mood: "neutral", last_interaction: "" },
                gambler: { mood: "neutral", last_interaction: "" },
                beggar: { mood: "neutral", last_interaction: "" },
                deserter: { mood: "neutral", last_interaction: "" },
            };
        }
        this.attributes = data.attributes ? { ...data.attributes } : { strength: 5, intellect: 5, charm: 5 };
        this.appearance = data.appearance ?? 0;
        this.appearance_revealed = data.appearance_revealed ?? false;
        this.current_equipment = data.current_equipment ? { ...data.current_equipment } : { clothing: null };
        this.deserter_recruited = data.deserter_recruited ?? false;
        this.unlocked_lore = data.unlocked_lore ? [...data.unlocked_lore] : [];
        this.morality = Math.max(0, Math.min(100, data.morality ?? 100));
        this.intimidation = Math.max(0, data.intimidation ?? 0);
        this.world_news = data.world_news ? [...data.world_news] : [];
        this.lord_grudges = data.lord_grudges ? [...data.lord_grudges] : [];
    }

    /** 金钱属性别名，指向 gold。 */
    get cash(): number {
        return this.gold;
    }

    set cash(value: number) {
        this.gold = value;
    }

    /** 部队属性别名，指向 troops。 */
    get army(): Record<string, number> {
        return this.troops;
    }

    set army(value: Record<string, number>) {
        this.troops = value;
    }

    /** 记录一条事件日志。 */
    add_log(message: string): void {
        const log_entry = `[第 ${this.day} 天] ${message}`;
        this.logs.push(log_entry);
    }

    /** 将当前状态转换为字典格式。 */
    to_dict(): Record<string, any> {
        return {
            day: this.day,
            gold: this.gold,
            location: this.location,
            morale: this.morale,
            troops: { ...this.troops },
            inventory: { ...this.inventory },
            logs: [...this.logs],
            companions: [...this.companions],
            fiefs: [...this.fiefs],
            renown: this.renown,
            food: this.food,
            max_army_size: this.max_army_size,
            equipment: { ...this.equipment },
            prisoners: { ...this.prisoners },
            personal_power: this.personal_power,
            loot: [...this.loot],
            faction_relations: { ...this.faction_relations },
            active_quests: this.active_quests.map(q => (typeof q === 'object' && q !== null ? { ...q } : q)),
            completed_quests: [...this.completed_quests],
            is_king: this.is_king,
            kingdom_name: this.kingdom_name,
            current_policy: this.current_policy,
            lords: [...this.lords],
            log_history: this.log_history.map(e => ({ ...e })),
            equipment_gear: { ...this.equipment_gear },
            bait_count: this.bait_count,
            fish_inventory: { ...this.fish_inventory },
            battle_lost_today: this.battle_lost_today,
            npc_states: Object.fromEntries(Object.entries(this.npc_states).map(([k, v]) => [k, { ...v }])),
            attributes: { ...this.attributes },
            appearance: this.appearance,
            appearance_revealed: this.appearance_revealed,
            current_equipment: { ...this.current_equipment },
            deserter_recruited: this.deserter_recruited,
            unlocked_lore: [...this.unlocked_lore],
            morality: this.morality,
            intimidation: this.intimidation,
            world_news: this.world_news.map(e => ({ ...e })),
            lord_grudges: [...this.lord_grudges],
        };
    }

    /** 从字典数据重建 GameState 实例。 */
    static from_dict(data: Record<string, any>): GameState {
        return new GameState({
            day: data.day ?? 1,
            gold: data.gold ?? 100,
            location: data.location ?? "oak_village",
            morale: data.morale ?? 100,
            troops: data.troops ?? {},
            inventory: data.inventory ?? {},
            logs: data.logs ?? [],
            companions: data.companions ?? [],
            fiefs: data.fiefs ?? [],
            renown: data.renown ?? 0,
            food: data.food ?? 100,
            max_army_size: data.max_army_size ?? 20,
            equipment: data.equipment ?? {},
            prisoners: data.prisoners ?? {},
            personal_power: data.personal_power ?? 10,
            loot: data.loot ?? [],
            faction_relations: data.faction_relations ?? { f1: 0, f2: 0, f3: 0 },
            active_quests: data.active_quests ?? [],
            completed_quests: data.completed_quests ?? [],
            is_king: data.is_king ?? false,
            kingdom_name: data.kingdom_name ?? "",
            current_policy: data.current_policy ?? null,
            lords: data.lords ?? [],
            log_history: data.log_history ?? [],
            equipment_gear: data.equipment_gear ?? { rod: false },
            bait_count: data.bait_count ?? 0,
            fish_inventory: data.fish_inventory ?? {},
            battle_lost_today: data.battle_lost_today ?? false,
            npc_states: data.npc_states ?? null,
            attributes: data.attributes ?? { strength: 5, intellect: 5, charm: 5 },
            appearance: data.appearance ?? 0,
            appearance_revealed: data.appearance_revealed ?? false,
            current_equipment: data.current_equipment ?? { clothing: null },
            deserter_recruited: data.deserter_recruited ?? false,
            unlocked_lore: data.unlocked_lore ?? [],
            morality: data.morality ?? 100,
            intimidation: data.intimidation ?? 0,
            world_news: data.world_news ?? [],
            lord_grudges: data.lord_grudges ?? [],
        });
    }

    /** 将当前状态保存为 JSON 文件。 */
    save(filepath: string): void {
        fs.writeFileSync(filepath, JSON.stringify(this.to_dict(), null, 2), "utf-8");
    }

    /** 从 JSON 文件加载并恢复 GameState 实例。 */
    static load(filepath: string): GameState {
        const data = JSON.parse(fs.readFileSync(filepath, "utf-8"));
        return GameState.from_dict(data);
    }
}
