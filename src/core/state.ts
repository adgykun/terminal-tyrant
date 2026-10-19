


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
    vassal_of?: string | null;
    siege?: { location_id: string; days_remaining: number; garrison: number } | null;
    ai_sieges?: { location_id: string; attacker: string; defender: string; days_remaining: number; strength: number }[];
    joined_army?: string | null;  // 加入的王国军团 id（跟随行军）
    influence?: number;  // 王国影响力（封臣核心资源）
    current_policy?: string | null;
    lords?: any[];
    log_history?: any[];
    equipment_gear?: Record<string, boolean>;
    bait_count?: number;
    fish_inventory?: Record<string, number>;
    battle_lost_today?: boolean;
    npc_states?: Record<string, { mood: string; last_interaction: string }>;
    travel_accum?: number;
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
    mercenary_contract?: { lord_id: string; rank: string; days_served: number; last_wage_day: number } | null;
    knight_order?: string | null;
    knight_vow_broken?: boolean;
    selected_region?: string | null;
    region_locations?: Record<string, any>;
    currencies?: { holdings: Record<string, number>; rates: Record<string, number> };
    futures_contracts?: any[];
    government_bonds?: any[];
    available_futures?: any[];
    available_bonds?: any[];
    /** 外交内核状态（运行时演化，随存档持久化）。 */
    diplomacy?: any;
    /** 领主个人运行时状态（兵力/好感/俘虏/生死）。 */
    lords_runtime?: Record<string, any>;
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
    vassal_of: string | null;
    siege: { location_id: string; days_remaining: number; garrison: number } | null;
    ai_sieges: { location_id: string; attacker: string; defender: string; days_remaining: number; strength: number }[];
    joined_army: string | null;
    influence: number;
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
    mercenary_contract: { lord_id: string; rank: string; days_served: number; last_wage_day: number } | null;
    knight_order: string | null;
    knight_vow_broken: boolean;
    selected_region: string | null;
    region_locations: Record<string, any>;
    currencies: { holdings: Record<string, number>; rates: Record<string, number> };
    futures_contracts: any[];
    government_bonds: any[];
    available_futures: any[];
    available_bonds: any[];
    travel_accum: number;
    /** 外交内核状态（运行时演化，随存档持久化）。 */
    diplomacy?: any;
    /** 领主个人运行时状态（兵力/好感/俘虏/生死）。 */
    lords_runtime?: Record<string, any>;

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
        this.faction_relations = data.faction_relations ? { ...data.faction_relations } : { empire_n: 0, empire_w: 0, empire_s: 0, sturgia: 0, aserai: 0, vlandia: 0, battania: 0, khuzait: 0, rf1: 0, rf2: 0, rf3: 0, rf4: 0, rf5: 0, rf6: 0 };
        this.active_quests = data.active_quests ? [...data.active_quests] : [];
        this.completed_quests = data.completed_quests ? [...data.completed_quests] : [];
        this.is_king = data.is_king ?? false;
        this.kingdom_name = data.kingdom_name ?? "";
        this.vassal_of = data.vassal_of ?? null;
        this.siege = data.siege ? { ...data.siege } : null;
        this.ai_sieges = data.ai_sieges ? data.ai_sieges.map(x => ({ ...x })) : [];
        this.joined_army = data.joined_army ?? null;
        this.influence = data.influence ?? 0;
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
        this.mercenary_contract = data.mercenary_contract ?? null;
        this.knight_order = data.knight_order ?? null;
        this.knight_vow_broken = data.knight_vow_broken ?? false;
        this.selected_region = data.selected_region ?? null;
        this.region_locations = data.region_locations ? JSON.parse(JSON.stringify(data.region_locations)) : {};
        this.currencies = data.currencies ? { holdings: { ...data.currencies.holdings }, rates: { ...data.currencies.rates } } : { holdings: {}, rates: {} };
        this.futures_contracts = data.futures_contracts ? [...data.futures_contracts] : [];
        this.government_bonds = data.government_bonds ? [...data.government_bonds] : [];
        this.available_futures = data.available_futures ? [...data.available_futures] : [];
        this.available_bonds = data.available_bonds ? [...data.available_bonds] : [];
        this.travel_accum = data.travel_accum ?? 0;
        this.diplomacy = data.diplomacy;
        this.lords_runtime = data.lords_runtime;
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
            vassal_of: this.vassal_of,
            siege: this.siege ? { ...this.siege } : null,
            ai_sieges: this.ai_sieges.map(x => ({ ...x })),
            joined_army: this.joined_army ?? null,
            influence: this.influence ?? 0,
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
            mercenary_contract: this.mercenary_contract ? { ...this.mercenary_contract } : null,
            knight_order: this.knight_order,
            knight_vow_broken: this.knight_vow_broken,
            selected_region: this.selected_region,
            region_locations: JSON.parse(JSON.stringify(this.region_locations)),
            currencies: { holdings: { ...this.currencies.holdings }, rates: { ...this.currencies.rates } },
            futures_contracts: this.futures_contracts.map(f => ({ ...f })),
            government_bonds: this.government_bonds.map(b => ({ ...b })),
            available_futures: this.available_futures.map(f => ({ ...f })),
            available_bonds: this.available_bonds.map(b => ({ ...b })),
            travel_accum: this.travel_accum,
            diplomacy: this.diplomacy ?? null,
            lords_runtime: this.lords_runtime ? { ...this.lords_runtime } : null,
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
            faction_relations: data.faction_relations ?? { empire_n: 0, empire_w: 0, empire_s: 0, sturgia: 0, aserai: 0, vlandia: 0, battania: 0, khuzait: 0, rf1: 0, rf2: 0, rf3: 0, rf4: 0, rf5: 0, rf6: 0 },
            active_quests: data.active_quests ?? [],
            completed_quests: data.completed_quests ?? [],
            is_king: data.is_king ?? false,
            kingdom_name: data.kingdom_name ?? "",
            vassal_of: data.vassal_of ?? null,
            siege: data.siege ? { ...data.siege } : null,
            ai_sieges: data.ai_sieges ? data.ai_sieges.map((x: any) => ({ ...x })) : [],
            joined_army: data.joined_army ?? null,
            influence: data.influence ?? 0,
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
            mercenary_contract: data.mercenary_contract ?? null,
            knight_order: data.knight_order ?? null,
            knight_vow_broken: data.knight_vow_broken ?? false,
            selected_region: data.selected_region ?? null,
            region_locations: data.region_locations ?? {},
            currencies: data.currencies ?? { holdings: {}, rates: {} },
            futures_contracts: data.futures_contracts ?? [],
            government_bonds: data.government_bonds ?? [],
            available_futures: data.available_futures ?? [],
            available_bonds: data.available_bonds ?? [],
            travel_accum: data.travel_accum ?? 0,
            diplomacy: data.diplomacy ?? null,
            lords_runtime: data.lords_runtime ?? null,
        });
    }

    /** 将当前状态保存到浏览器本地存储。 */
    save(key: string = "terminal_tyrant_save"): void {
        localStorage.setItem(key, JSON.stringify(this.to_dict()));
    }

    /** 从浏览器本地存储加载并恢复 GameState 实例。 */
    static load(key: string = "terminal_tyrant_save"): GameState | null {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return GameState.from_dict(data);
    }

    /** 检查是否存在存档。 */
    static has_save(key: string = "terminal_tyrant_save"): boolean {
        return localStorage.getItem(key) !== null;
    }

    /** 删除存档。 */
    static delete_save(key: string = "terminal_tyrant_save"): void {
        localStorage.removeItem(key);
    }
}
