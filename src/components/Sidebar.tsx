import { GameView } from "../hooks/useGame";
import { Map, Home, User, Users, Backpack, ScrollText, Crown, LogOut, Volume2, VolumeX, Swords, Shield } from "lucide-react";
import { GameState } from "../core/state";

interface SidebarProps {
  view: GameView;
  setView: (v: GameView) => void;
  state: GameState | null;
  onQuit: () => void;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
}

export function Sidebar({ view, setView, state, onQuit, voiceEnabled, onToggleVoice }: SidebarProps) {
  if (!state) return null;

  const isInTown = !!state.location;

  return (
    <div className="sidebar">
      <div style={{
        padding: "12px 14px 16px",
        marginBottom: "8px",
        borderBottom: "1px solid var(--border-color)",
      }}>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--accent-gold)",
          letterSpacing: "2px",
          textAlign: "center",
        }}>
          TERMINAL
        </div>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--text-muted)",
          letterSpacing: "4px",
          textAlign: "center",
        }}>
          TYRANT
        </div>
      </div>

      <NavItem icon={<Map size={18} />} label="大地图" active={view === "map"} onClick={() => setView("map")} />
      <NavItem icon={<Home size={18} />} label="城镇" active={view === "town"} onClick={() => setView("town")} disabled={!isInTown} />
      <NavItem icon={<User size={18} />} label="角色" active={view === "character"} onClick={() => setView("character")} />
      <NavItem icon={<Users size={18} />} label="队伍" active={view === "party"} onClick={() => setView("party")} />
      <NavItem icon={<Backpack size={18} />} label="背包" active={view === "inventory"} onClick={() => setView("inventory")} />
      <NavItem icon={<Swords size={18} />} label="3D战场" active={view === "battle"} onClick={() => setView("battle")} />
      <NavItem icon={<ScrollText size={18} />} label="故事" active={view === "quests"} onClick={() => setView("quests")} />
      <NavItem icon={<Shield size={18} />} label="领主" active={view === "lords"} onClick={() => setView("lords")} />
      {state.is_king && (
        <NavItem icon={<Crown size={18} />} label="王国" active={view === "kingdom"} onClick={() => setView("kingdom")} />
      )}
      <div style={{ flex: 1 }} />
      {onToggleVoice && (
        <NavItem
          icon={voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          label={voiceEnabled ? "语音开" : "语音关"}
          active={false}
          onClick={onToggleVoice}
        />
      )}
      <NavItem icon={<LogOut size={18} />} label="退出" active={false} onClick={onQuit} />
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick} disabled={disabled}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
