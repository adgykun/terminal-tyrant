import { useState } from "react";
import { Sword, ScrollText, Shield, ChevronLeft, ChevronRight, Play, Upload, Skull } from "lucide-react";
interface StartMenuProps {
  onStart: (str: number, int: number, charm: number) => void;
  onLoad: () => void;
  hasSave: () => boolean;
}
type Stage = "main" | "create";
export function StartMenu({ onStart, onLoad, hasSave }: StartMenuProps) {
  const [stage, setStage] = useState<Stage>("main");
  const [str, setStr] = useState(5);
  const [int, setInt] = useState(5);
  const [charm, setCharm] = useState(5);
  const remaining = 15 - str - int - charm;
  const handleStart = () => {
    if (str + int + charm !== 15) return;
    onStart(str, int, charm);
  };
  if (stage === "main") {
    return (
      <div className="title-screen">
        <div style={{ textAlign: "center", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", marginBottom: "8px" }}>
            <Skull size={48} style={{ color: "var(--accent-gold)", filter: "drop-shadow(0 0 12px rgba(212,168,67,0.3))" }} />
            <h1 className="title-logo">终端暴君</h1>
          </div>
          <div style={{ width: "400px", height: "1px", background: "linear-gradient(90deg, transparent, var(--accent-gold-dark), transparent)", margin: "0 auto 16px" }} />
          <p className="title-subtitle">
            旧帝国崩塌后的第 50 年，卡拉迪亚大陆风云变幻。<br/>
            你是一名身无分文的流浪者，怀揣着成为"终端暴君"的野心，<br/>
            踏上了这片充满战火与机遇的土地……
          </p>
        </div>
        <div className="flex-col" style={{ gap: "14px", width: "300px", zIndex: 1 }}>
          {hasSave() && (
            <button className="primary" style={{ padding: "16px", fontSize: "16px" }} onClick={onLoad}>
              <Upload size={20} style={{ display: "inline", marginRight: "8px" }} />继续游戏
            </button>
          )}
          <button style={{ padding: "16px", fontSize: "16px" }} onClick={() => setStage("create")}>
            <Play size={20} style={{ display: "inline", marginRight: "8px" }} />新建游戏
          </button>
        </div>

        <div style={{ position: "absolute", bottom: "24px", color: "var(--text-dim)", fontSize: "12px", zIndex: 1 }}>
          v1.0.0 — Terminal Tyrant
        </div>
      </div>
    );
  }
  return (
    <div className="title-screen" style={{ justifyContent: "flex-start", paddingTop: "80px" }}>
      <h2 className="text-display text-xl text-gold" style={{ marginBottom: "8px" }}>创建角色</h2>
      <p className="text-muted text-sm" style={{ marginBottom: "24px" }}>分配 15 点属性（每项 1~10）</p>
      <div className="panel" style={{ width: "440px" }}>
        <AttrSlider label="力量" icon={<Sword size={18} />} value={str} setValue={setStr} remaining={remaining} />
        <AttrSlider label="智力" icon={<ScrollText size={18} />} value={int} setValue={setInt} remaining={remaining} />
        <AttrSlider label="魅力" icon={<Shield size={18} />} value={charm} setValue={setCharm} remaining={remaining} />
        <div className="divider" />
        <div className="flex-row" style={{ justifyContent: "space-between" }}>
          <span className="text-sm text-muted">剩余点数</span>
          <span className="text-bold text-gold text-lg">{remaining}</span>
        </div>
      </div>
      <div className="flex-row gap-12" style={{ marginTop: "8px" }}>
        <button onClick={() => setStage("main")}>
          <ChevronLeft size={16} style={{ display: "inline", marginRight: "4px" }} />返回
        </button>
        <button className="primary" onClick={() => handleStart()} disabled={remaining !== 0 || str < 1 || int < 1 || charm < 1}>
          开始冒险 <ChevronRight size={16} style={{ display: "inline", marginLeft: "4px" }} />
        </button>
      </div>
    </div>
  );
}
function AttrSlider({
  label,
  icon,
  value,
  setValue,
  remaining,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  setValue: (v: number) => void;
  remaining: number;
}) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <div className="flex-row" style={{ justifyContent: "space-between", marginBottom: "8px" }}>
        <span className="flex-row gap-8 text-secondary text-sm">{icon} {label}</span>
        <span className="text-bold text-gold text-lg">{value}</span>
      </div>
      <div className="flex-row gap-8">
        <button
          style={{ width: "36px", padding: "6px", fontSize: "16px" }}
          onClick={() => setValue(Math.max(1, value - 1))}
          disabled={value <= 1}
        >-</button>
        <div className="stat-bar-track" style={{ flex: 1, height: "12px" }}>
          <div className="stat-bar-fill" style={{ width: `${(value / 10) * 100}%` }} />
        </div>
        <button
          style={{ width: "36px", padding: "6px", fontSize: "16px" }}
          onClick={() => setValue(Math.min(10, value + 1))}
          disabled={value >= 10 || remaining <= 0}
        >+</button>
      </div>
    </div>
  );
}
