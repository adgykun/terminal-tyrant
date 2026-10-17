import type { GameState } from "../core/state";
import { calculate_army_power, get_battle_companion_quote } from "../core/engine";
import { Swords, Shield, Zap, Footprints, MessageSquare } from "lucide-react";

interface CombatModalProps {
  combat: {
    enemyPower: number;
    result: any | null;
    description: string;
  };
  state: GameState;
  onResolve: (choice: string) => void;
  onClose: () => void;
}

export function CombatModal({ combat, state, onResolve, onClose }: CombatModalProps) {
  const armyPower = calculate_army_power(state.troops) + state.personal_power;
  const totalTroops = Object.values(state.troops).reduce((a: number, b: number) => a + b, 0);
  const result = combat.result;
  const companionQuotes = result ? get_battle_companion_quote(state, result.victory ? "combat_won" : "combat_lost_fled") : [];

  if (result) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal fade-in" onClick={e => e.stopPropagation()}>
          <h2 className="text-display text-xl" style={{ marginBottom: "16px", color: result.victory ? "var(--accent-green-light)" : "var(--accent-red-light)" }}>
            {result.victory ? "胜利！" : "战败！"}
          </h2>
          <div className="flex-col gap-8 mb-16">
            {result.message && <div className="text-sm text-secondary" style={{ lineHeight: 1.7 }}>{result.message}</div>}
            {result.casualties > 0 && <div className="text-sm text-red-light">伤亡: {result.casualties} 人</div>}
            {result.gold_gained > 0 && <div className="text-sm text-gold-light">获得金币: {result.gold_gained}</div>}
            {result.loot_gained?.length > 0 && (
              <div className="text-sm text-gold-light">
                战利品: {result.loot_gained.map((l: any) => l.name).join(", ")}
              </div>
            )}
            {result.prisoners && Object.keys(result.prisoners).length > 0 && (
              <div className="text-sm text-secondary">
                俘虏: {Object.entries(result.prisoners).map(([k, v]: [string, any]) => `${k} x${v}`).join(", ")}
              </div>
            )}
            {companionQuotes.length > 0 && <div className="divider" />}
            {companionQuotes.map((q: string, i: number) => (
              <div key={i} className="text-sm text-muted" style={{ fontStyle: "italic" }}>{q}</div>
            ))}
          </div>
          <button className="primary" onClick={onClose}>继续</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal fade-in">
        <h2 className="text-display text-xl text-gold" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <Swords size={28} /> 遭遇敌人！
        </h2>
        <p className="text-sm text-secondary mb-16" style={{ lineHeight: 1.7 }}>{combat.description || "前方遭遇了敌人！"}</p>

        <div className="vs-display" style={{ marginBottom: "20px" }}>
          <div className="vs-side">
            <Shield size={40} style={{ color: "var(--accent-blue-light)", filter: "drop-shadow(0 0 8px rgba(74,140,184,0.3))" }} />
            <span className="text-xs text-muted">我方战力</span>
            <span className="text-bold text-xl text-blue-light">{armyPower}</span>
            <span className="text-xs text-muted">{totalTroops} 兵</span>
          </div>
          <div className="vs-divider">VS</div>
          <div className="vs-side">
            <Swords size={40} style={{ color: "var(--accent-red-light)", filter: "drop-shadow(0 0 8px rgba(196,74,74,0.3))" }} />
            <span className="text-xs text-muted">敌方战力</span>
            <span className="text-bold text-xl text-red-light">{combat.enemyPower}</span>
          </div>
        </div>

        <div className="flex-col gap-8">
          <button className="primary" onClick={() => onResolve("fight")}>
            <Zap size={18} style={{ display: "inline", marginRight: "6px" }} />正面交锋
          </button>
          <button onClick={() => onResolve("flee")}>
            <Footprints size={16} style={{ display: "inline", marginRight: "6px" }} />撤退
          </button>
          {state.attributes?.charm >= 5 && (
            <button onClick={() => onResolve("negotiate")}>
              <MessageSquare size={16} style={{ display: "inline", marginRight: "6px" }} />尝试谈判
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
