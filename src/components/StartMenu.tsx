import { useState } from "react";
import { GameState } from "../core/state";
import { get_all_regions } from "../core/engine";
import { WORLD_REGIONS, TERRAIN_NAMES } from "../core/world_regions";
import { Sword, ScrollText, Shield, Globe, ChevronRight, ChevronLeft, Star, Play, Upload, Skull } from "lucide-react";

interface StartMenuProps {
  onStart: (str: number, int: number, charm: number) => void;
  onStartWithRegion: (str: number, int: number, charm: number, regionId: string) => void;
  onLoad: () => void;
  hasSave: () => boolean;
}

type Stage = "main" | "create" | "region";

export function StartMenu({ onStart, onStartWithRegion, onLoad, hasSave }: StartMenuProps) {
  const [stage, setStage] = useState<Stage>("main");
  const [str, setStr] = useState(5);
  const [int, setInt] = useState(5);
  const [charm, setCharm] = useState(5);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const remaining = 15 - str - int - charm;

  const handleStart = () => {
    if (str + int + charm !== 15) return;
    if (selectedRegion) {
      onStartWithRegion(str, int, charm, selectedRegion);
    } else {
      onStart(str, int, charm);
    }
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
            旧帝国崩塌后的第 50 年，亚欧非大陆风云变幻。<br/>
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

  if (stage === "create") {
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

  return (
    <div className="title-screen" style={{ justifyContent: "flex-start", paddingTop: "40px", overflow: "auto", height: "auto", minHeight: "100vh", paddingBottom: "40px" }}>
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <h2 className="text-display text-xl text-gold" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
          <Globe size={28} /> 选择起始区域
        </h2>
        <p className="text-muted text-sm" style={{ maxWidth: "620px", margin: "12px auto 0", lineHeight: 1.7 }}>
          亚欧非大陆共有 12 个区域可供选择。每个区域有独特的地形、势力、货币和生态。
        </p>
      </div>

      <div className="card-grid" style={{ maxWidth: "960px", width: "100%", marginTop: "24px", zIndex: 1 }}>
        {WORLD_REGIONS.map(region => {
          const isSelected = selectedRegion === region.id;
          return (
            <div
              key={region.id}
              className={`region-card ${isSelected ? "selected" : ""}`}
              onClick={() => setSelectedRegion(region.id)}
            >
              <div className="flex-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="card-title" style={{ color: isSelected ? "var(--accent-gold)" : "var(--accent-gold-light)" }}>{region.name}</span>
                <span style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={13}
                      fill={i < region.difficulty ? "var(--accent-gold)" : "transparent"}
                      color={i < region.difficulty ? "var(--accent-gold)" : "var(--border-color)"}
                    />
                  ))}
                </span>
              </div>
              <div className="card-desc" style={{ marginTop: "10px" }}>
                {region.description}
              </div>
              <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.7 }}>
                <div><span className="text-secondary text-bold">势力</span> {region.factions.map(f => f.name).join("、")}</div>
                <div><span className="text-secondary text-bold">货币</span> {region.currencies.map(c => c.name).join("、")}</div>
                <div><span className="text-secondary text-bold">地形</span> {Object.entries(region.terrain.weights).map(([t, w]) => `${TERRAIN_NAMES[t as keyof typeof TERRAIN_NAMES]} ${Math.round((w ?? 0) * 100)}%`).join("、")}</div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedRegion && (
        <div className="panel" style={{ maxWidth: "620px", width: "100%", marginTop: "16px", zIndex: 1 }}>
          <div className="panel-title">{WORLD_REGIONS.find(r => r.id === selectedRegion)?.name} — 背景故事</div>
          <p className="text-sm text-secondary" style={{ lineHeight: 1.8 }}>
            {WORLD_REGIONS.find(r => r.id === selectedRegion)?.lore}
          </p>
        </div>
      )}

      <div className="flex-row gap-12" style={{ marginTop: "16px", zIndex: 1 }}>
        <button onClick={() => setStage("create")}>
          <ChevronLeft size={16} style={{ display: "inline", marginRight: "4px" }} />返回
        </button>
        <button className="primary" onClick={handleStart} disabled={!selectedRegion || remaining !== 0}>
          <Play size={16} style={{ display: "inline", marginRight: "4px" }} />开始冒险
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
