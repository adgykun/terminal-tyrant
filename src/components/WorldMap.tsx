import { LOCATIONS, FACTIONS } from "../core/data";
import type { GameState } from "../core/state";
import { get_current_region, get_current_location, move_region } from "../core/engine";
import { TERRAIN_COLORS, TERRAIN_NAMES, TerrainType } from "../core/world_regions";
import { Home, Castle, TreePine, Mountain, Tent, Anchor, Shield, Waves } from "lucide-react";

interface WorldMapProps {
  state: GameState;
  onMove: (targetId: string) => void;
  onEnterTown?: () => void;
}

const factionColorMap: Record<string, string> = {
  rf1: "var(--faction-blue)",
  rf2: "var(--faction-green)",
  rf3: "var(--faction-red)",
  rf4: "#a855f7",
  f1: "var(--faction-blue)",
  f2: "var(--faction-green)",
  f3: "var(--faction-red)",
};

const locationIcons: Record<string, React.ReactNode> = {
  village: <Home size={20} />,
  town: <Castle size={24} />,
  wild: <TreePine size={20} />,
  pass: <Shield size={22} />,
  port: <Anchor size={22} />,
};

export function WorldMap({ state, onMove, onEnterTown }: WorldMapProps) {
  const isRegionMode = state.selected_region && state.region_locations;
  const regionLocations = isRegionMode ? state.region_locations : LOCATIONS;
  const currentLoc = isRegionMode ? state.region_locations[state.location] : LOCATIONS[state.location];
  const region = isRegionMode ? get_current_region(state) : null;

  if (!currentLoc) return <div className="text-muted">无法加载地图数据</div>;

  const neighbors = currentLoc.neighbors ?? [];
  const allLocations = Object.values(regionLocations) as any[];
  const maxX = Math.max(...allLocations.map((l: any) => l.x));
  const maxY = Math.max(...allLocations.map((l: any) => l.y));

  const padX = 8;
  const padY = 8;
  const mapW = maxX + padX * 2;
  const mapH = maxY + padY * 2;
  const scaleX = (100 / mapW);
  const scaleY = (100 / mapH);

  const toX = (x: number) => (x + padX) * scaleX;
  const toY = (y: number) => (y + padY) * scaleY;

  const factionName = (factionId: string) => {
    if (region) {
      return region.factions.find(f => f.id === factionId)?.name ?? "未知";
    }
    return FACTIONS[factionId]?.name ?? "未知";
  };

  const terrainColor = (loc: any) => {
    if (loc.terrain_type && TERRAIN_COLORS[loc.terrain_type as TerrainType]) {
      return TERRAIN_COLORS[loc.terrain_type as TerrainType];
    }
    return "var(--bg-darkest)";
  };

  const locTypeName = (type: string) => {
    const names: Record<string, string> = { village: "村庄", town: "城镇", wild: "野外", pass: "关隘", port: "港口" };
    return names[type] ?? "未知";
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-title">
          <Mountain size={22} /> {region ? `${region.name} — 区域地图` : "大地图"}
        </div>
        {region && (
          <p className="text-sm text-muted mb-12">{region.description}</p>
        )}
        <p className="text-sm text-muted mb-12">点击相邻地点进行移动（消耗 1 天，士气 -5）</p>

        <div style={{
          position: "relative",
          width: "100%",
          paddingTop: `${(mapH / mapW) * 100}%`,
          background: "var(--bg-darkest)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border-color)",
          marginBottom: "16px",
          overflow: "hidden",
        }}>
          {isRegionMode && region && (
            <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} viewBox={`0 0 100 100`} preserveAspectRatio="none">
              {region.terrain.rivers.map((r, i) => (
                <line
                  key={`river-${i}`}
                  x1={(r.x1 + padX) * scaleX} y1={(r.y1 + padY) * scaleY}
                  x2={(r.x2 + padX) * scaleX} y2={(r.y2 + padY) * scaleY}
                  stroke="#4a7cb8"
                  strokeWidth={1.5}
                  opacity={0.5}
                />
              ))}
              {allLocations.map((loc: any) => {
                if (!loc.terrain_type) return null;
                const size = 3;
                return (
                  <circle
                    key={`terrain-${loc.id}`}
                    cx={toX(loc.x)}
                    cy={toY(loc.y)}
                    r={size}
                    fill={terrainColor(loc)}
                    opacity={0.3}
                  />
                );
              })}
            </svg>
          )}

          {!isRegionMode && (
            <div style={{
              position: "absolute",
              top: 0, left: 0, width: "100%", height: "100%",
              backgroundImage: "radial-gradient(circle at 30% 40%, rgba(74,124,168,0.08) 0%, transparent 40%), radial-gradient(circle at 70% 60%, rgba(181,72,72,0.08) 0%, transparent 40%)",
            }} />
          )}

          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} viewBox={`0 0 100 100`} preserveAspectRatio="none">
            {allLocations.map((loc: any) => {
              const isNeighbor = neighbors.includes(loc.id);
              const isCurrent = loc.id === state.location;
              if (!isNeighbor && !isCurrent) return null;
              return loc.neighbors?.map((nId: string) => {
                const target = regionLocations[nId];
                if (!target) return null;
                const isPath = isCurrent && neighbors.includes(nId);
                return (
                  <line
                    key={`${loc.id}-${nId}`}
                    x1={toX(loc.x)} y1={toY(loc.y)}
                    x2={toX(target.x)} y2={toY(target.y)}
                    stroke={isPath ? "var(--accent-gold-dark)" : "var(--border-color)"}
                    strokeWidth={isPath ? 0.4 : 0.2}
                    strokeDasharray={isPath ? "0" : "0.5"}
                    opacity={isPath ? 0.6 : 0.3}
                  />
                );
              });
            })}
          </svg>

          {allLocations.map((loc: any) => {
            const isCurrent = loc.id === state.location;
            const isNeighbor = neighbors.includes(loc.id);
            const canMove = isNeighbor && !isCurrent;
            const factionColor = factionColorMap[loc.faction_id] ?? "var(--text-muted)";

            return (
              <div
                key={loc.id}
                onClick={() => canMove && onMove(loc.id)}
                style={{
                  position: "absolute",
                  left: `${toX(loc.x)}%`,
                  top: `${toY(loc.y)}%`,
                  transform: "translate(-50%, -50%)",
                  cursor: canMove ? "pointer" : "default",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                  transition: "all 0.2s ease",
                  opacity: isCurrent || isNeighbor ? 1 : 0.4,
                }}
              >
                {loc.terrain_type && isRegionMode && (
                  <div style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: terrainColor(loc),
                    opacity: 0.6,
                    position: "absolute",
                    top: "-4px",
                    zIndex: 0,
                  }} />
                )}
                <div style={{
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: isCurrent ? "var(--accent-gold-dark)" : "var(--bg-medium)",
                  border: `2px solid ${isCurrent ? "var(--accent-gold)" : canMove ? factionColor : "var(--border-color)"}`,
                  color: isCurrent ? "#1a1410" : canMove ? "var(--text-primary)" : "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "12px",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s ease",
                  boxShadow: isCurrent ? "0 0 12px rgba(212,168,67,0.4)" : "none",
                  position: "relative",
                  zIndex: 1,
                }}
                >
                  {locationIcons[loc.type] ?? <Tent size={18} />}
                  <span>{loc.name}</span>
                </div>
                {isCurrent && (
                  <div style={{ fontSize: "10px", color: "var(--accent-gold)", marginTop: "2px", position: "relative", zIndex: 1 }}>你在这里</div>
                )}
                {canMove && (
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", position: "relative", zIndex: 1 }}>点击前往</div>
                )}
              </div>
            );
          })}
        </div>

        {isRegionMode && currentLoc.terrain_type && (
          <div className="flex-row gap-12 mb-12" style={{ flexWrap: "wrap" }}>
            <span className="text-sm text-muted">当前地形: <span style={{ color: TERRAIN_COLORS[currentLoc.terrain_type as TerrainType] }}>{TERRAIN_NAMES[currentLoc.terrain_type as TerrainType] ?? "未知"}</span></span>
            {currentLoc.ecology && (
              <>
                <span className="text-sm text-muted">森林: {Math.round(currentLoc.ecology.forest_coverage)}%</span>
                <span className="text-sm text-muted">土壤: {Math.round(currentLoc.ecology.soil_fertility)}%</span>
                <span className="text-sm text-muted">水质: {Math.round(currentLoc.ecology.water_quality)}%</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">可前往地点</div>
        <div className="card-grid">
          {neighbors.map((nId: string) => {
            const loc = regionLocations[nId] as any;
            if (!loc) return null;
            return (
              <div key={nId} className="card" onClick={() => onMove(nId)}>
                <div className="card-title">{loc.name}</div>
                <div className="card-desc">
                  类型: {locTypeName(loc.type)}<br />
                  阵营: <span style={{ color: factionColorMap[loc.faction_id] ?? "var(--text-muted)" }}>{factionName(loc.faction_id)}</span><br />
                  {loc.terrain_type && <>地形: {TERRAIN_NAMES[loc.terrain_type as TerrainType] ?? "未知"}<br /></>}
                  {loc.type === "pass" && loc.garrison_power > 0 && (
                    <span style={{ color: "var(--accent-red)" }}>关隘守军: {loc.garrison_power}<br /></span>
                  )}
                  可用设施: {[
                    loc.market && Object.keys(loc.market).length > 0 && "市场",
                    loc.barracks?.length > 0 && "兵营",
                    loc.tavern?.length > 0 && "酒馆",
                    loc.arena && "竞技场",
                    loc.facilities?.length > 0 && "工坊",
                    loc.slave_market && "奴隶市场",
                  ].filter(Boolean).join("、") || "无"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">当前所在地</div>
        <div className="text-sm text-secondary">
          {currentLoc.name} — {locTypeName(currentLoc.type)}
          {currentLoc.terrain_type && ` | 地形: ${TERRAIN_NAMES[currentLoc.terrain_type as TerrainType] ?? "未知"}`}
        </div>
        {currentLoc.type === "town" || currentLoc.type === "village" || currentLoc.type === "port" ? (
          <button className="primary mt-12" onClick={() => onEnterTown?.()}>
            进入城镇
          </button>
        ) : null}
        {currentLoc.terrain_type === "forest" || currentLoc.terrain_type === "jungle" ? (
          <div className="mt-12 text-sm text-muted">
            此地有森林，可以砍伐木材（影响生态）
          </div>
        ) : null}
      </div>
    </div>
  );
}
