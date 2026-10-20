import type { GameState } from "../core/state";
import { FACTIONS, EQUIPMENT, KNIGHT_ORDERS, MERCENARY_RANKS } from "../core/data";
import { get_total_appearance, reveal_appearance, get_mercenary_info, get_knight_order_info, get_current_region } from "../core/engine";
import { derivePlayerCombat } from "../core/player_combat";
import { User, Eye, Star, Heart, Skull, Sparkles, Scroll, Crown, Swords } from "lucide-react";

interface CharacterPanelProps {
  state: GameState;
  performAction: (action: (...args: any[]) => any, ...args: any[]) => any;
}

export function CharacterPanel({ state, performAction }: CharacterPanelProps) {
  const totalApp = get_total_appearance(state);
  const mercInfo = get_mercenary_info(state);
  const orderInfo = get_knight_order_info(state);
  const equippedItems = Object.entries(state.equipment).map(([slot, eqId]: [string, string]) => ({
    slot,
    item: EQUIPMENT[eqId],
  }));
  // 战斗属性推导（属性 + 装备）
  const combat = derivePlayerCombat(state.attributes ?? {}, state.equipment ?? {});

  return (
    <div>
      <div className="panel">
        <div className="panel-title"><User size={22} /> 角色信息</div>
        <div className="flex-row gap-16 mb-12">
          <div className="flex-col gap-4" style={{ flex: 1 }}>
            <StatRow label="力量" value={state.attributes?.strength ?? 5} />
            <StatRow label="智力" value={state.attributes?.intellect ?? 5} />
            <StatRow label="魅力" value={state.attributes?.charm ?? 5} />
          </div>
          <div className="flex-col gap-4" style={{ flex: 1 }}>
            <StatRow label="个人战力" value={state.personal_power} icon={<Star size={16} />} />
            <StatRow label="外貌" value={totalApp} icon={<Sparkles size={16} />} />
            <StatRow label="道德" value={state.morality} icon={<Heart size={16} />} />
            <StatRow label="威慑" value={state.intimidation} icon={<Skull size={16} />} />
          </div>
        </div>

        {!state.appearance_revealed ? (
          <button className="primary" onClick={() => performAction(reveal_appearance)}>
            <Eye size={16} style={{ display: "inline", marginRight: "4px" }} />揭晓外貌
          </button>
        ) : (
          <div className="text-sm text-gold">外貌已揭晓，当前总外貌值: {totalApp}</div>
        )}
      </div>

      {/* 战斗属性（属性 + 装备推导） */}
      <div className="panel">
        <div className="panel-title"><Swords size={22} /> 战斗属性</div>
        <div className="flex-row gap-16 mb-12">
          <div className="flex-col gap-4" style={{ flex: 1 }}>
            <StatRow label="生命值" value={combat.hp} />
            <StatRow label="单次伤害" value={Number(combat.damage.toFixed(1))} />
            <StatRow label="攻击距离" value={combat.range} />
          </div>
          <div className="flex-col gap-4" style={{ flex: 1 }}>
            <StatRow label="移动速度" value={Number(combat.speed.toFixed(2))} />
            <StatRow label="护甲减伤" value={`${Math.round(combat.damageReduction * 100)}%`} />
            <StatRow label="士气光环" value={combat.moraleAura > 0 ? `+${combat.moraleAura}` : combat.moraleAura} />          </div>
        </div>
        <div className="divider" />
        <div className="text-sm text-secondary mb-8">属性推导明细</div>
        {combat.breakdown.length === 0 ? (
          <div className="text-muted text-sm">尚无属性或装备加成</div>
        ) : (
          combat.breakdown.map((b, i) => (
            <div key={i} className="text-sm text-muted" style={{ lineHeight: 1.8 }}>· {b}</div>
          ))
        )}
      </div>

      <div className="panel">
        <div className="panel-title">装备栏</div>
        {equippedItems.length === 0 ? (
          <div className="text-muted text-sm">尚未装备任何物品</div>
        ) : (
          equippedItems.map(({ slot, item }) => (
            <div key={slot} className="list-item">
              <div className="flex-col gap-4">
                <span className="text-sm text-muted">
                  {slot === "weapon" ? "武器" : slot === "armor" ? "护甲" : slot === "horse" ? "战马" : "服饰"}
                </span>
                <span className="text-bold">{item?.name ?? "未知"}</span>
              </div>
              <div className="text-sm">
                {item && <span className="text-blue">+{item.power_bonus} 战力</span>}
                {item && item.appearance_bonus > 0 && <span className="text-gold"> +{item.appearance_bonus} 外貌</span>}
              </div>
              <div></div>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <div className="panel-title">阵营关系</div>
        {(() => {
          const region = get_current_region(state);
          if (region) {
            return region.factions.map((faction: any) => {
              const fId = faction.id;
              const relation = state.faction_relations[fId] ?? 0;
              const relPercent = Math.max(0, Math.min(100, (relation + 100) / 2));
              const color = faction.color === "blue" ? "var(--faction-blue)" : faction.color === "green" ? "var(--faction-green)" : faction.color === "red" ? "var(--faction-red)" : "var(--faction-purple)";
              return (
                <div key={fId} className="mb-8">
                  <div className="flex-row" style={{ justifyContent: "space-between", marginBottom: "4px" }}>
                    <span className="text-sm" style={{ color }}>{faction.name}</span>
                    <span className="text-sm text-muted">{relation > 0 ? `+${relation}` : relation}</span>
                  </div>
                  <div className="stat-bar-track">
                    <div className="stat-bar-fill" style={{ width: `${relPercent}%`, background: color }} />
                  </div>
                </div>
              );
            });
          }
          return Object.entries(FACTIONS).map(([fId, faction]: [string, any]) => {
          const relation = state.faction_relations[fId] ?? 0;
          const relPercent = Math.max(0, Math.min(100, (relation + 100) / 2));
          const color = faction.color === "blue" ? "var(--faction-blue)" : faction.color === "green" ? "var(--faction-green)" : faction.color === "red" ? "var(--faction-red)" : faction.color === "brown" ? "var(--faction-brown)" : "var(--faction-purple)";
          return (
            <div key={fId} className="mb-8">
              <div className="flex-row" style={{ justifyContent: "space-between", marginBottom: "4px" }}>
                <span className="text-sm" style={{ color }}>{faction.name}</span>
                <span className="text-sm text-muted">{relation > 0 ? `+${relation}` : relation}</span>
              </div>
              <div className="stat-bar-track">
                <div className="stat-bar-fill" style={{ width: `${relPercent}%`, background: color }} />
              </div>
            </div>
          );
          });
        })()}
        <div className="divider" />
        <div className="panel-title" style={{ marginTop: 12 }}>卡拉迪亚王国态势</div>
        {(() => {
          const KINGDOMS = ["empire_n", "empire_w", "empire_s", "sturgia", "aserai", "vlandia", "battania", "khuzait"];
          const rows: { name: string; color: string; atWar: string[]; atPeace: string[] }[] = [];
          for (const k of KINGDOMS) {
            const f = FACTIONS[k];
            if (!f) continue;
            const atWar: string[] = [];
            const atPeace: string[] = [];
            for (const j of KINGDOMS) {
              if (j === k) continue;
              const rel = f.relations?.[j] ?? 0;
              if (rel < 0) atWar.push(FACTIONS[j]?.name ?? j);
              else atPeace.push(FACTIONS[j]?.name ?? j);
            }
            rows.push({ name: f.name, color: f.color, atWar, atPeace });
          }
          return rows.map(row => (
            <div key={row.name} className="mb-8">
              <div className="flex-row" style={{ justifyContent: "space-between", marginBottom: "4px" }}>
                <span className="text-sm text-bold" style={{ color: row.color === "blue" ? "var(--faction-blue)" : row.color === "green" ? "var(--faction-green)" : row.color === "red" ? "var(--faction-red)" : row.color === "brown" ? "var(--faction-brown)" : "var(--faction-purple)" }}>{row.name}</span>
              </div>
              <div className="text-sm text-muted">
                {row.atWar.length > 0 ? <span className="text-red">交战: {row.atWar.join("、")}</span> : <span>与诸国和平</span>}
                {row.atPeace.length > 0 && <span> | 和平: {row.atPeace.join("、")}</span>}
              </div>
            </div>
          ));
        })()}
      </div>

      {(mercInfo || orderInfo) && (
        <div className="panel">
          <div className="panel-title">身份与誓言</div>
          {mercInfo && (
            <div className="mb-12">
              <div className="flex-row gap-8 mb-8">
                <Scroll size={18} className="text-gold" />
                <span className="text-bold text-gold">佣兵契约</span>
              </div>
              <div className="text-sm text-secondary" style={{ lineHeight: 1.8 }}>
                签约领主: <span className="text-bold">{mercInfo.lord_name}</span><br />
                所属阵营: {mercInfo.faction_name}<br />
                当前军衔: <span className="text-gold">{mercInfo.rank_name}</span>（军饷 {mercInfo.wage} 金/周期）<br />
                服役天数: {mercInfo.days_served} | 距下次领饷: {mercInfo.days_until_wage} 天<br />
                军衔特权: {mercInfo.perk}
              </div>
            </div>
          )}
          {orderInfo && (
            <div>
              <div className="flex-row gap-8 mb-8">
                <Crown size={18} className="text-gold" />
                <span className="text-bold text-gold">骑士团誓言</span>
              </div>
              <div className="text-sm text-secondary" style={{ lineHeight: 1.8 }}>
                骑士团: <span className="text-gold">{orderInfo.order_name}</span><br />
                {orderInfo.desc}
              </div>
              <div className="divider" />
              <div className="text-sm text-secondary mb-8">誓言约束：</div>
              {orderInfo.vows.map((v: any) => (
                <div key={v.id} className="list-item">
                  <span className="text-sm text-bold">{v.desc}</span>
                  <span className="text-sm text-red">违反将被驱逐</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state.is_king && (
        <div className="panel">
          <div className="panel-title">王国信息</div>
          <div className="text-sm text-secondary">
            王国名称: <span className="text-gold text-bold">{state.kingdom_name}</span><br />
            当前政策: {state.current_policy ?? "无"}<br />
            封地数量: {state.fiefs.length}<br />
            封臣数量: {state.lords.length}
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, icon }: { label: string; value: number | string; icon?: React.ReactNode }) {
  return (
    <div className="flex-row" style={{ justifyContent: "space-between" }}>
      <span className="text-sm text-secondary flex-row gap-4">{icon}{label}</span>
      <span className="text-bold text-gold">{value}</span>
    </div>
  );
}
