import { GameState } from "../core/state";
import { calculate_army_power, get_mercenary_info, get_knight_order_info, get_current_region, get_current_location } from "../core/engine";
import { get_region_primary_currency } from "../core/world_regions";
import { Coins, Wheat, Heart, Star, Sword, MapPin, Calendar, Shield, Scroll, Crown, Globe } from "lucide-react";

interface StatusBarProps {
  state: GameState;
}

export function StatusBar({ state }: StatusBarProps) {
  const armyPower = calculate_army_power(state.troops);
  const totalTroops = Object.values(state.troops).reduce((a: number, b: number) => a + b, 0);
  const region = state.selected_region ? get_current_region(state) : null;
  const currentLoc = get_current_location(state);
  const displayName = currentLoc?.name ?? state.location;
  const primaryCurrency = state.selected_region ? get_region_primary_currency(state.selected_region) : null;
  const mercInfo = get_mercenary_info(state);
  const orderInfo = get_knight_order_info(state);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 20px",
      background: "linear-gradient(180deg, var(--bg-dark) 0%, var(--bg-darkest) 100%)",
      borderBottom: "1px solid var(--accent-gold-dark)",
      flexShrink: 0,
      overflowX: "auto",
      position: "relative",
    }}>
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: "1px",
        background: "linear-gradient(90deg, transparent, var(--accent-gold) 50%, transparent)",
        opacity: 0.3,
      }} />
      <div className="hud-stat">
        <Calendar size={16} style={{ color: "var(--accent-gold)" }} />
        <span className="text-sm text-secondary text-bold">第 {state.day} 天</span>
      </div>
      <HudStat icon={<Coins size={16} />} label={primaryCurrency?.name ?? "金币"} value={state.gold} color="var(--accent-gold)" />
      <HudStat icon={<Wheat size={16} />} label="粮食" value={state.food} color="var(--accent-green-light)" />
      <HudStat icon={<Heart size={16} />} label="士气" value={state.morale} color="var(--accent-red-light)" />
      <HudStat icon={<Star size={16} />} label="声望" value={state.renown} color="var(--accent-gold-light)" />
      <HudStat icon={<Sword size={16} />} label="兵力" value={totalTroops} color="var(--text-secondary)" />
      <HudStat icon={<Shield size={16} />} label="战力" value={armyPower + state.personal_power} color="var(--accent-blue-light)" />
      {mercInfo && (
        <div className="hud-stat">
          <Scroll size={16} style={{ color: "var(--accent-gold)" }} />
          <span className="text-sm text-secondary">佣兵:</span>
          <span className="text-sm text-bold text-gold">{mercInfo.rank_name}</span>
        </div>
      )}
      {orderInfo && (
        <div className="hud-stat">
          <Crown size={16} style={{ color: "var(--accent-gold)" }} />
          <span className="text-sm text-secondary">骑士团:</span>
          <span className="text-sm text-bold text-gold">{orderInfo.order_name}</span>
        </div>
      )}
      {region && (
        <div className="hud-stat" style={{ marginLeft: "auto" }}>
          <Globe size={16} style={{ color: "var(--accent-gold)" }} />
          <span className="text-sm text-bold text-gold">{region.name}</span>
        </div>
      )}
      <div className="hud-stat" style={region ? {} : { marginLeft: "auto" }}>
        <MapPin size={16} style={{ color: "var(--accent-gold)" }} />
        <span className="text-sm text-secondary">{displayName}</span>
      </div>
    </div>
  );
}

function HudStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="hud-stat">
      <span style={{ color }}>{icon}</span>
      <span className="text-xs" style={{ color }}>{label}</span>
      <span className="text-sm text-bold" style={{ color }}>{value}</span>
    </div>
  );
}
