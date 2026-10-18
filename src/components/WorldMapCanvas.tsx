import { useRef, useEffect, useState, useCallback } from "react";
import {
  get_map_locations, plan_travel_path, travel_eta_days,
  get_current_location, compute_content_bounds, nearest_location_id,
  FREE_MOVE_SPEED, FREE_MOVE_DAY_DISTANCE,
  resolve_combat_simple,
} from "../core/engine";
import { TERRAIN_COLORS, get_region } from "../core/world_regions";
import type { GameState } from "../core/state";
import { generateTerrainCanvas, type TerrainLayer } from "../core/terrain_noise";
import { generateMapUnits, advanceUnits, RF_TO_KINGDOM, KINGDOM_REL, type MapUnit } from "../core/map_units";
import { BANNERLORD_TROOPS } from "../core/troops_bannerlord";

function troopName(id: string): string {
  return BANNERLORD_TROOPS[id]?.name ?? id;
}

// === 常量 ===
const ARRIVE_RADIUS = 3.5;
const TRAVEL_SPEED = 10; // 世界单位/秒
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 5;
const HIT_RADIUS = 3; // 世界单位
const FACTION_COLORS: Record<string, string> = {
  rf1: "#4a90d9", rf2: "#5cb85c", rf3: "#c0392b", rf4: "#a855f7",
  f1: "#4a90d9", f2: "#5cb85c", f3: "#c0392b", f4: "#a855f7",
};
const LOC_LABEL: Record<string, string> = {
  village: "\u6751\u5e98", town: "\u9547\u57ce", wild: "\u91ce\u5916",
  pass: "\u5173\u9698", port: "\u6e2f\u53e3",
};
const UNIT_LABEL: Record<string, string> = {
  army: "\u519b\u961f", caravan: "\u5546\u961f", bandit: "\u52ab\u532a", npc: "\u65c5\u4eba",
};

// === 类型 ===
interface Camera { x: number; y: number; zoom: number }
interface TravelState {
  path: string[];
  legIndex: number;
  legT: number;
  active: boolean;
}

// === Props ===
interface WorldMapCanvasProps {
  state: GameState;
  onMove: (targetId: string) => void;
  onEnterTown?: () => void;
  onFreeMove?: (dist: number, onRoad: boolean) => void;
  onUnitPicked?: (unit: MapUnit) => void;
  onUnitCombat?: (enemyPower: number, desc: string) => void; // 打移动劫匪/攻城
  onUnitInteract?: (unit: MapUnit) => void;   // 商队交易/NPC聊天（壳）
  onPassBattle?: (garrison: number) => void;   // 关隘守军战斗（修死按钮）
  onCamp?: () => void;                          // 扎营（修死按钮）
  onSiege?: (action: "start" | "advance" | "assault" | "retreat", locId?: string) => void; // 攻城战
  onJoinArmy?: (armyId: string) => void;        // 加入王国军团
  onLeaveArmy?: () => void;                     // 脱离王国军团
}

// === 工具 ===
function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lerpPt(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// === 主组件 ===
export function WorldMapCanvas({ state, onMove, onEnterTown, onFreeMove, onUnitPicked, onUnitCombat, onUnitInteract, onPassBattle, onCamp, onSiege, onJoinArmy, onLeaveArmy }: WorldMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const miniFrameRef = useRef(0);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  // 相机
  const camRef = useRef<Camera>({ x: 45, y: 40, zoom: 1.5 });
  // 玩家视觉位置
  const playerPosRef = useRef<{ x: number; y: number }>({ x: 45, y: 40 });
  // 行程
  const travelRef = useRef<TravelState>({ path: [], legIndex: 0, legT: 0, active: false });
  // 目标标记
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  // 程序化地形 + AI 单位（活地图）
  const terrainRef = useRef<TerrainLayer | null>(null);
  const unitsRef = useRef<MapUnit[]>([]);
  const [selUnit, setSelUnit] = useState<MapUnit | null>(null); // 点选单位交互
  const selUnitRef = useRef<MapUnit | null>(null);
  const combatBusyRef = useRef(false);
  // 拖拽
  const dragRef = useRef<{ startX: number; startY: number; camX: number; camY: number; moved: boolean; startT: number } | null>(null);
  // 触摸
  const touchRef = useRef<{ lastDist: number; lastCx: number; lastCy: number; lastTapT: number; lastTapX: number; lastTapY: number }>({ lastDist: 0, lastCx: 0, lastCy: 0, lastTapT: 0, lastTapX: 0, lastTapY: 0 });
  // 键盘
  const keysRef = useRef<Record<string, boolean>>({});

  // React 状态（只存 UI 层）
  const hoveredIdRef = useRef<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [traveling, setTraveling] = useState(false);
  const [etaDays, setEtaDays] = useState(0);
  const [nearLocId, setNearLocId] = useState<string | null>(null);
  // 自由位移（B 方案）
  const [travelMode, setTravelMode] = useState<"free" | "road">("free");
  const travelModeRef = useRef<"free" | "road">("free");
  const freeRef = useRef<{ active: boolean; tx: number; ty: number; distAcc: number }>({ active: false, tx: 0, ty: 0, distAcc: 0 });
  const terrainSeedRef = useRef(0);
  const [physicalSize, setPhysicalSize] = useState({ w: 0, h: 0 });
  const [dayToast, setDayToast] = useState(0);
  const [clashToast, setClashToast] = useState<string[]>([]);

  // 地点缓存
  const locations = get_map_locations(state);
  const byId = useCallback((id: string) => {
    for (const l of locations) { if ((l as any).id === id) return l; }
    return null;
  }, [locations]);

  // 当前所在地
  const curLoc = get_current_location(state);
  const region = state.selected_region ? get_region(state.selected_region) : null;
  // === 区域变化：生成程序化地形 + AI 单位（活地图） ===
  useEffect(() => {
    const seed = (state.selected_region ? state.selected_region.length * 131 : 7) + 1000;
    if (terrainSeedRef.current === seed) return;
    terrainSeedRef.current = seed;
    terrainRef.current = generateTerrainCanvas(region, seed);
    const usable = (locations as any[]).filter((l) => typeof l.x === "number");
    unitsRef.current = generateMapUnits(region, usable, seed);
  }, [state.selected_region, locations]);
  useEffect(() => { selUnitRef.current = selUnit; }, [selUnit]);

  // 军团战斗消息 toast 3 秒后自动消失
  useEffect(() => {
    if (clashToast.length === 0) return;
    const t = setTimeout(() => setClashToast([]), 3000);
    return () => clearTimeout(t);
  }, [clashToast]);

  // === 初始化玩家位置 ===
  useEffect(() => {
    if (curLoc && typeof (curLoc as any).x === "number") {
      playerPosRef.current = { x: (curLoc as any).x, y: (curLoc as any).y };
      camRef.current.x = (curLoc as any).x;
      camRef.current.y = (curLoc as any).y;
    }
  }, [state.location]);

  // === 绘制地形（离屏） ===
  useEffect(() => {
    if (physicalSize.w === 0 || physicalSize.h === 0) return;
    const W = physicalSize.w, H = physicalSize.h;
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const octx = off.getContext("2d")!;
    // 底色
    const grad = octx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
    grad.addColorStop(0, "#2a2318");
    grad.addColorStop(0.5, "#1e1a12");
    grad.addColorStop(1, "#12100b");
    octx.fillStyle = grad;
    octx.fillRect(0, 0, W, H);
    // 噪点
    for (let i = 0; i < 3000; i++) {
      octx.fillStyle = "rgba(255,240,200," + (Math.random() * 0.015) + ")";
      octx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
    offscreenRef.current = off;
  }, [physicalSize.w, physicalSize.h, locations.length]);

  // === 坐标变换 ===
  const worldToScreen = useCallback((wx: number, wy: number) => {
    const cvs = canvasRef.current;
    if (!cvs) return { sx: 0, sy: 0 };
    const cam = camRef.current;
    const sx = (wx - cam.x) * cam.zoom * 2 + cvs.width / 2;
    const sy = (wy - cam.y) * cam.zoom * 2 + cvs.height / 2;
    return { sx, sy };
  }, []);

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const cvs = canvasRef.current;
    if (!cvs) return { wx: 0, wy: 0 };
    const cam = camRef.current;
    const wx = (sx - cvs.width / 2) / (cam.zoom * 2) + cam.x;
    const wy = (sy - cvs.height / 2) / (cam.zoom * 2) + cam.y;
    return { wx, wy };
  }, []);

  // === 渲染循环 ===
  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const cvs = canvasRef.current;
      if (!cvs) { raf = requestAnimationFrame(loop); return; }
      const ctx = cvs.getContext("2d")!;
      const W = cvs.width, H = cvs.height;
      const cam = camRef.current;

      // 键盘移动
      const spd = 20 * dt;
      if (keysRef.current["ArrowLeft"] || keysRef.current["a"]) cam.x -= spd / cam.zoom;
      if (keysRef.current["ArrowRight"] || keysRef.current["d"]) cam.x += spd / cam.zoom;
      if (keysRef.current["ArrowUp"] || keysRef.current["w"]) cam.y -= spd / cam.zoom;
      if (keysRef.current["ArrowDown"] || keysRef.current["s"]) cam.y += spd / cam.zoom;

      // 行程插值
      const trav = travelRef.current;
      if (trav.active && trav.path.length >= 2) {
        trav.legT += (TRAVEL_SPEED / dist(
          { x: (byId(trav.path[trav.legIndex]) as any)?.x ?? 0, y: (byId(trav.path[trav.legIndex]) as any)?.y ?? 0 },
          { x: (byId(trav.path[trav.legIndex + 1]) as any)?.x ?? 0, y: (byId(trav.path[trav.legIndex + 1]) as any)?.y ?? 0 }
        )) * dt;
        while (trav.legT >= 1 && trav.legIndex < trav.path.length - 1) {
          trav.legT -= 1;
          const arrivedId = trav.path[trav.legIndex + 1];
          onMove(arrivedId);
          trav.legIndex++;
          if (trav.legIndex >= trav.path.length - 1) {
            trav.active = false;
            setTraveling(false);
            setEtaDays(0);
            break;
          }
        }
        if (trav.active) {
          const from = byId(trav.path[trav.legIndex]);
          const to = byId(trav.path[trav.legIndex + 1]);
          if (from && to) {
            const p = lerpPt(from, to, Math.min(trav.legT, 1));
            playerPosRef.current = p;
          }
        }
      }

      // 自由位移（B 方案）：直线走向目标点，攒满 10 世界单位跨天
      const fr = freeRef.current;
      if (fr.active) {
        const pp = playerPosRef.current;
        const dx = fr.tx - pp.x, dy = fr.ty - pp.y;
        const dToTarget = Math.hypot(dx, dy);
        if (dToTarget < 0.5) {
          fr.active = false;
        } else {
          const step = Math.min(FREE_MOVE_SPEED * dt, dToTarget);
          pp.x += (dx / dToTarget) * step;
          pp.y += (dy / dToTarget) * step;
          fr.distAcc += step;
          if (fr.distAcc >= FREE_MOVE_DAY_DISTANCE) {
            const crossed = Math.floor(fr.distAcc / FREE_MOVE_DAY_DISTANCE);
            fr.distAcc -= crossed * FREE_MOVE_DAY_DISTANCE;
            onFreeMove?.(step, travelModeRef.current === "road");
            setDayToast(crossed);
          }
        }
      } else {
        // 无行程时清 distAcc
        fr.distAcc = 0;
      }

      // 跟随军团：joined_army 时玩家位置跟随该军团移动（行军/围城）
      if (state.joined_army) {
        const joined = unitsRef.current.find((u) => u.id === state.joined_army);
        if (joined) {
          playerPosRef.current = { x: joined.x, y: joined.y };
          camRef.current.x = joined.x;
          camRef.current.y = joined.y;
          // 军团行动中（行军到敌城/围城），玩家视角自动跟随
          if (joined.dwell > 0 && joined.x !== 999 && joined.y !== 999) {
            // 军团到点停留：视为围城/休整
            setClashToast(["你的军团正在行动…"]);
          }
        } else {
          // 军团已溃散/消失，自动脱离
          onLeaveArmy?.();
        }
      }

      // 清除 + blit 地形
      ctx.clearRect(0, 0, W, H);
      if (offscreenRef.current) ctx.drawImage(offscreenRef.current, 0, 0);

      // 动态层
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(cam.zoom * 2, cam.zoom * 2);
      ctx.translate(-cam.x, -cam.y);

      // 程序化地形（离屏，随镜头平移/缩放）
      if (terrainRef.current) {
        const tl = terrainRef.current;
        ctx.drawImage(tl.canvas, tl.worldX, tl.worldY, tl.worldW, tl.worldH);
      }
      // AI 单位逐帧推进（活地图，返回军团战斗消息）
      {
        const usable = (locations as any[]).filter((l) => typeof l.x === "number");
        if (unitsRef.current.length) {
          const clashMsgs = advanceUnits(unitsRef.current, dt, usable, 0);
          if (clashMsgs.length > 0) {
            setClashToast((prev) => [...prev.slice(-2), ...clashMsgs]);
          }
        }
      }

      // 河流（区域模式）
      if (region && region.terrain.rivers) {
        ctx.strokeStyle = "#4a7cb8";
        ctx.lineWidth = 0.3;
        ctx.globalAlpha = 0.6;
        for (const r of region.terrain.rivers) {
          ctx.beginPath();
          ctx.moveTo(r.x1, r.y1);
          // 贝塞尔曲线
          const mx = (r.x1 + r.x2) / 2 + (r.y2 - r.y1) * 0.1;
          const my = (r.y1 + r.y2) / 2 - (r.x2 - r.x1) * 0.1;
          ctx.quadraticCurveTo(mx, my, r.x2, r.y2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // 官道（neighbors）
      ctx.strokeStyle = "#5a4a30";
      ctx.lineWidth = 0.15;
      ctx.setLineDash([0.4, 0.3]);
      ctx.globalAlpha = 0.5;
      const drawn = new Set<string>();
      for (const loc of locations as any[]) {
        for (const nId of loc.neighbors || []) {
          const key = [loc.id, nId].sort().join("-");
          if (drawn.has(key)) continue;
          drawn.add(key);
          const target = byId(nId);
          if (!target) continue;
          ctx.beginPath();
          ctx.moveTo((loc as any).x, (loc as any).y);
          ctx.lineTo((target as any).x, (target as any).y);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // AI 单位 token（活地图）：画在地点层下，玩家旗帜上
      if (unitsRef.current.length) {
        const zoom = cam.zoom * 2;
        const pxPerWorldUnit = zoom * (window.devicePixelRatio || 1);
        const TARGET_ICON_PX = 14; // 屏幕目标字号（CSS px），移动端可到 16
        const worldFontSize = TARGET_ICON_PX / pxPerWorldUnit;
        // 军团围攻圈可视化：敌方领地旁若有多支敌军军团聚集，画围攻圈
        const armyCounts: Record<string, number> = {};
        for (const u of unitsRef.current) {
          if (u.type !== "army") continue;
          // 找到最近地点
          let bestLoc: any = null, bestD = 3.0;
          for (const loc of locations as any[]) {
            const d = Math.hypot(u.x - (loc as any).x, u.y - (loc as any).y);
            if (d < bestD) { bestD = d; bestLoc = loc; }
          }
          if (bestLoc) {
            const k = RF_TO_KINGDOM[(bestLoc as any).faction_id] || (bestLoc as any).faction_id;
            const uK = u.factionKey;
            if (uK && k && uK !== k) {
              const rel = KINGDOM_REL[uK]?.[k] ?? 0;
              if (rel < 0) armyCounts[(bestLoc as any).id] = (armyCounts[(bestLoc as any).id] ?? 0) + 1;
            }
          }
        }
        for (const loc of locations as any[]) {
          const cnt = armyCounts[(loc as any).id];
          if (cnt && cnt >= 2) {
            const lx = (loc as any).x, ly = (loc as any).y;
            ctx.beginPath();
            ctx.arc(lx, ly, 2.2 + Math.sin(Date.now() / 400) * 0.3, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255,120,40,0.6)";
            ctx.lineWidth = 0.12;
            ctx.setLineDash([0.3, 0.25]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = "0.7px sans-serif";
            ctx.fillStyle = "#ff9040";
            ctx.textAlign = "center";
            ctx.fillText(`⚔ ${cnt} 军围城`, lx, ly - 2.4);
          }
        }
        for (const u of unitsRef.current) {
          const uisSel = selUnitRef.current?.id === u.id;
          // 类型图标（小三角/方块区分）+ 势力色环 + 名字
          ctx.beginPath();
          ctx.arc(u.x, u.y, 0.55, 0, Math.PI * 2);
          ctx.fillStyle = u.color;
          ctx.fill();
          ctx.lineWidth = uisSel ? 0.22 : 0.1;
          ctx.strokeStyle = uisSel ? "#ffffff" : "#1a1410";
          ctx.stroke();
          // 类型标记（内嵌符号）：按屏幕目标字号反算，LOD 兜底
          if (pxPerWorldUnit >= 0.5) {
            ctx.fillStyle = "#fff";
            ctx.font = worldFontSize + "px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const sym = u.type === "army" ? "斛" : u.type === "caravan" ? "车" : u.type === "bandit" ? "勾" : "行";
            ctx.fillText(sym, u.x, u.y + 0.02);
          }
          // 选中外圈 + 名字标签（仅选中/悬停时显示）
          if (uisSel) {
            ctx.beginPath();
            ctx.arc(u.x, u.y, 1.4, 0, Math.PI * 2);
            ctx.strokeStyle = u.color;
            ctx.lineWidth = 0.12;
            ctx.stroke();
            ctx.font = worldFontSize + "px sans-serif";
            ctx.fillStyle = "#fff";
            ctx.textBaseline = "alphabetic";
            ctx.fillText((UNIT_LABEL[u.type] || "") + " \u00b7 " + u.name, u.x, u.y - 1.6);
          }
        }
        ctx.textBaseline = "alphabetic";
      }

      // 地点图标
      for (const loc of locations as any[]) {
        const lx = (loc as any).x, ly = (loc as any).y;
        const isCur = (loc as any).id === state.location;
        const isHover = (loc as any).id === hoveredIdRef.current;
        const fColor = FACTION_COLORS[(loc as any).faction_id] || "#888";

        // 光晕
        if (isCur || isHover) {
          ctx.beginPath();
          ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = isCur ? "rgba(212,168,67,0.25)" : "rgba(255,255,255,0.15)";
          ctx.fill();
        }
        // 圆形底座
        ctx.beginPath();
        ctx.arc(lx, ly, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "#1a1410";
        ctx.fill();
        ctx.strokeStyle = fColor;
        ctx.lineWidth = isCur ? 0.25 : 0.12;
        ctx.stroke();
        // 内部色点
        ctx.beginPath();
        ctx.arc(lx, ly, 0.5, 0, Math.PI * 2);
        ctx.fillStyle = isCur ? "#d4a843" : fColor;
        ctx.fill();
        // 围城标记（火焰 + 敌方警示）
        if (state.siege?.location_id === (loc as any).id) {
          // 火焰（三层，随时间跳动）
          const t = Date.now() / 500;
          const flicker = Math.sin(t + lx * 3) * 0.2;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(lx - 0.25 + i * 0.25, ly - 1.5 - i * 0.4 + flicker * 0.3, 0.35 - i * 0.08, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? "#ff8c00" : i === 1 ? "#ffc107" : "#fff3cd";
            ctx.fill();
          }
          // 红色警示外圈（呼吸）
          ctx.beginPath();
          ctx.arc(lx, ly, 1.8 + Math.sin(t * 1.5) * 0.3, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(220,60,40,0.7)";
          ctx.lineWidth = 0.15;
          ctx.stroke();
        }
        // 标签
        ctx.font = "0.8px sans-serif";
        ctx.fillStyle = isCur ? "#d4a843" : "#ccc";
        ctx.textAlign = "center";
        ctx.fillText((loc as any).name || "", lx, ly + 2.2);
      }

      // 目标标记
      if (targetRef.current) {
        const tp = targetRef.current;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 0.8, 0, Math.PI * 2);
        ctx.strokeStyle = "#d4a843";
        ctx.lineWidth = 0.15;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 0.2, 0, Math.PI * 2);
        ctx.fillStyle = "#d4a843";
        ctx.fill();
      }

      // 玩家旗帜
      const pp = playerPosRef.current;
      ctx.save();
      ctx.translate(pp.x, pp.y);
      // 旗帜杆
      ctx.beginPath();
      ctx.moveTo(0, -2.5);
      ctx.lineTo(0, 0);
      ctx.strokeStyle = "#d4a843";
      ctx.lineWidth = 0.2;
      ctx.stroke();
      // 旗帜三角
      ctx.beginPath();
      ctx.moveTo(0, -2.5);
      ctx.lineTo(1.5, -1.8);
      ctx.lineTo(0, -1.2);
      ctx.closePath();
      ctx.fillStyle = "#d4a843";
      ctx.fill();
      // 底座圆
      ctx.beginPath();
      ctx.arc(0, 0, 0.6, 0, Math.PI * 2);
      ctx.fillStyle = "#d4a843";
      ctx.fill();
      ctx.strokeStyle = "#1a1410";
      ctx.lineWidth = 0.15;
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      // 晕影
      const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
      vignette.addColorStop(0, "transparent");
      vignette.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      // 接近地点检测
      let nearId: string | null = null;
      for (const loc of locations as any[]) {
        if (dist(playerPosRef.current, loc) < ARRIVE_RADIUS) { nearId = loc.id; break; }
      }
      setNearLocId((prev) => prev === nearId ? prev : nearId);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [locations, state.location, onMove, byId]);

  // === Canvas 尺寸自适应 ===
  useEffect(() => {
    const cvs = canvasRef.current;
    const container = containerRef.current;
    if (!cvs || !container) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(container.clientWidth * dpr);
      const h = Math.floor(container.clientHeight * dpr);
      cvs.width = w;
      cvs.height = h;
      cvs.style.width = container.clientWidth + "px";
      cvs.style.height = container.clientHeight + "px";
      setPhysicalSize({ w, h }); // 触发离屏底图重建
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // === 交互：点击设目标 / 走路径 ===
  const startTravel = useCallback((targetId: string | null, tx?: number, ty?: number) => {
    if (targetId) targetRef.current = null;
    else if (tx !== undefined && ty !== undefined) targetRef.current = { x: tx, y: ty };
    else targetRef.current = null;
    let destId = targetId;
    if (!destId && tx !== undefined && ty !== undefined) {
      destId = nearest_location_id(locations as any[], tx, ty, 8);
    }
    // === 自由位移（B）：直线走，攒 10 单位跨天 ===
    if (travelModeRef.current === "free") {
      const wx = tx ?? (destId ? (byId(destId) as any)?.x : undefined);
      const wy = ty ?? (destId ? (byId(destId) as any)?.y : undefined);
      if (wx === undefined || wy === undefined) {
        travelRef.current = { path: [], legIndex: 0, legT: 0, active: false };
        setTraveling(false); return;
      }
      freeRef.current = { active: true, tx: wx, ty: wy, distAcc: 0 };
      travelRef.current = { path: [], legIndex: 0, legT: 0, active: false };
      setTraveling(true); setEtaDays(0);
      return;
    }
    // === 官道模式（方案 A）：沿 neighbors 路径 ===
    if (!destId) { travelRef.current.active = false; setTraveling(false); return; }
    const path = plan_travel_path(state, state.location, destId);
    if (!path || path.length < 2) {
      travelRef.current = { path: [], legIndex: 0, legT: 0, active: false };
      setTraveling(false); return;
    }
    freeRef.current = { active: false, tx: 0, ty: 0, distAcc: 0 };
    travelRef.current = { path, legIndex: 0, legT: 0, active: true };
    setTraveling(true);
    setEtaDays(travel_eta_days(path));
  }, [state, locations, byId]);

  // === 取消行程 ===
  const cancelTravel = useCallback(() => {
    travelRef.current = { path: [], legIndex: 0, legT: 0, active: false };
    targetRef.current = null;
    setTraveling(false);
    setEtaDays(0);
  }, []);

  // === 点选单位 token（优先于移动） ===
  const pickUnitAt = useCallback((wx: number, wy: number, radius = 2.5) => {
    let best: MapUnit | null = null;
    let bestD = radius;
    for (const u of unitsRef.current) {
      const d = Math.hypot(u.x - wx, u.y - wy);
      if (d < bestD) { bestD = d; best = u; }
    }
    return best;
  }, []);

  // === 鼠标事件 ===
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camRef.current;
      const rect = cvs.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const before = screenToWorld(sx * (window.devicePixelRatio || 1), sy * (window.devicePixelRatio || 1));
      cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      const after = screenToWorld(sx * (window.devicePixelRatio || 1), sy * (window.devicePixelRatio || 1));
      cam.x += before.wx - after.wx;
      cam.y += before.wy - after.wy;
    };

    const onDown = (e: MouseEvent) => {
      dragRef.current = { startX: e.clientX, startY: e.clientY, camX: camRef.current.x, camY: camRef.current.y, moved: false, startT: performance.now() };
    };

    const onMoveMouse = (e: MouseEvent) => {
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
        if (dragRef.current.moved) {
          camRef.current.x = dragRef.current.camX - dx / (camRef.current.zoom * 2 * (window.devicePixelRatio || 1));
          camRef.current.y = dragRef.current.camY - dy / (camRef.current.zoom * 2 * (window.devicePixelRatio || 1));
        }
      }
      // 悬停检测
      const rect = cvs.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (window.devicePixelRatio || 1);
      const sy = (e.clientY - rect.top) * (window.devicePixelRatio || 1);
      const { wx, wy } = screenToWorld(sx, sy);
      const hit = nearest_location_id(locations as any[], wx, wy, HIT_RADIUS);
      hoveredIdRef.current = hit;
      setHoveredId((prev) => (prev === hit ? prev : hit));
    };

    const onUp = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { moved, startT } = dragRef.current;
      const duration = performance.now() - startT;
      dragRef.current = null;
      if (!moved && duration < 300) {
        const rect = cvs.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * (window.devicePixelRatio || 1);
        const sy = (e.clientY - rect.top) * (window.devicePixelRatio || 1);
        const { wx, wy } = screenToWorld(sx, sy);
        // 优先点选单位 token
        const uHit = pickUnitAt(wx, wy, 2.5);
        if (uHit) { setSelUnit(uHit); onUnitPicked?.(uHit); return; }
        setSelUnit(null);
        const hit = nearest_location_id(locations as any[], wx, wy, HIT_RADIUS);
        startTravel(hit, wx, wy);
      }
    };

    cvs.addEventListener("wheel", onWheel, { passive: false });
    cvs.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMoveMouse);
    window.addEventListener("mouseup", onUp);
    return () => {
      cvs.removeEventListener("wheel", onWheel);
      cvs.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMoveMouse);
      window.removeEventListener("mouseup", onUp);
    };
  }, [screenToWorld, locations, startTravel]);

  // === 触摸事件 ===
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, camX: camRef.current.x, camY: camRef.current.y, moved: false, startT: performance.now() };
      } else if (e.touches.length === 2) {
        const t = touchRef.current;
        t.lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        t.lastCx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        t.lastCy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        dragRef.current = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && dragRef.current) {
        const dx = e.touches[0].clientX - dragRef.current.startX;
        const dy = e.touches[0].clientY - dragRef.current.startY;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) dragRef.current.moved = true;
        if (dragRef.current.moved) {
          camRef.current.x = dragRef.current.camX - dx / (camRef.current.zoom * 2 * (window.devicePixelRatio || 1));
          camRef.current.y = dragRef.current.camY - dy / (camRef.current.zoom * 2 * (window.devicePixelRatio || 1));
        }
      } else if (e.touches.length === 2) {
        const t = touchRef.current;
        const newDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const scale = newDist / t.lastDist;
        camRef.current.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camRef.current.zoom * scale));
        t.lastDist = newDist;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (dragRef.current && e.touches.length === 0) {
        const { moved, startT } = dragRef.current;
        const duration = performance.now() - startT;
        dragRef.current = null;
        if (!moved && duration < 300) {
          const rect = cvs.getBoundingClientRect();
          const sx = (touchRef.current.lastTapX - rect.left) * (window.devicePixelRatio || 1);
          const sy = (touchRef.current.lastTapY - rect.top) * (window.devicePixelRatio || 1);
          const { wx, wy } = screenToWorld(sx, sy);
          const uHit = pickUnitAt(wx, wy, 3);
          if (uHit) { setSelUnit(uHit); onUnitPicked?.(uHit); return; }
          setSelUnit(null);
          const hit = nearest_location_id(locations as any[], wx, wy, HIT_RADIUS);
          startTravel(hit, wx, wy);
        }
      }
      if (e.touches.length === 1) {
        touchRef.current.lastTapX = e.touches[0].clientX;
        touchRef.current.lastTapY = e.touches[0].clientY;
        touchRef.current.lastTapT = performance.now();
      }
    };

    cvs.addEventListener("touchstart", onTouchStart, { passive: false });
    cvs.addEventListener("touchmove", onTouchMove, { passive: false });
    cvs.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      cvs.removeEventListener("touchstart", onTouchStart);
      cvs.removeEventListener("touchmove", onTouchMove);
      cvs.removeEventListener("touchend", onTouchEnd);
    };
  }, [screenToWorld, locations, startTravel]);

  // === 键盘 ===
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", "w", "s"].includes(e.key)) {
        keysRef.current[e.key] = true;
        e.preventDefault();
      }
      if (e.key === "Escape") cancelTravel();
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); };
  }, [cancelTravel]);

  // === 小地图（右下角缩略）===
  useEffect(() => {
    const cvs = miniRef.current;
    if (!cvs) return;
    const MW = 120, MH = 120;
    cvs.width = MW; cvs.height = MH;
    const mctx = cvs.getContext("2d")!;
    let tick = 0;
    const id = setInterval(() => {
      tick++;
      if (tick % 6 !== 0) return; // 每 6 帧刷一次小地图
      mctx.clearRect(0, 0, MW, MH);
      mctx.fillStyle = "#0e1420";
      mctx.fillRect(0, 0, MW, MH);
      // 世界 0~100 → 小地图 0~120
      const sx = (wx: number) => (wx / 100) * MW;
      const sy = (wy: number) => (wy / 100) * MH;
      // 地点
      for (const loc of locations as any[]) {
        mctx.fillStyle = "#6b8f4a";
        mctx.fillRect(sx(loc.x) - 1, sy(loc.y) - 1, 2, 2);
      }
      // AI 单位
      for (const u of unitsRef.current) {
        mctx.fillStyle = u.color;
        mctx.beginPath(); mctx.arc(sx(u.x), sy(u.y), 1.5, 0, Math.PI * 2); mctx.fill();
      }
      // 玩家
      const pp = playerPosRef.current;
      mctx.fillStyle = "#d4a843";
      mctx.beginPath(); mctx.arc(sx(pp.x), sy(pp.y), 3, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = "#fff"; mctx.lineWidth = 0.5; mctx.stroke();
      // 视口框
      const cam = camRef.current;
      const halfW = (MW * 0.0); // 简单画相机中心十字
      mctx.strokeStyle = "rgba(255,255,255,0.4)";
      mctx.beginPath(); mctx.moveTo(sx(cam.x) - 6, sy(cam.y)); mctx.lineTo(sx(cam.x) + 6, sy(cam.y));
      mctx.moveTo(sx(cam.x), sy(cam.y) - 6); mctx.lineTo(sx(cam.x), sy(cam.y) + 6); mctx.stroke();
    }, 100);
    return () => clearInterval(id);
  }, [locations, unitsRef.current]);

  // === 缩放按钮 ===
  const zoomIn = useCallback(() => { camRef.current.zoom = Math.min(MAX_ZOOM, camRef.current.zoom * 1.3); }, []);
  const zoomOut = useCallback(() => { camRef.current.zoom = Math.max(MIN_ZOOM, camRef.current.zoom / 1.3); }, []);
  const zoomFit = useCallback(() => {
    const b = compute_content_bounds(locations as any[]);
    const cvs = canvasRef.current;
    if (!cvs) return;
    const zoom = Math.min(cvs.width / ((b.maxX - b.minX) * 2), cvs.height / ((b.maxY - b.minY) * 2));
    camRef.current = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) };
  }, [locations]);

  // === 接近地点的操作 ===
  const nearLoc = nearLocId ? byId(nearLocId) : null;
  const canEnter = nearLoc && (nearLoc as any).type && ["town", "village", "port"].includes((nearLoc as any).type);

  // === 渲染 ===
  return (
    <div className="wmc-container" ref={containerRef}>
      <canvas ref={canvasRef} className="wmc-canvas" />

      {/* 地点信息卡 */}
      {hoveredId && byId(hoveredId) && (
        <div className="wmc-info-card">
          <div className="wmc-info-title">{(byId(hoveredId) as any)?.name}</div>
          <div className="wmc-info-body">
            类型: {LOC_LABEL[(byId(hoveredId) as any)?.type] ?? "?"}
            {(byId(hoveredId) as any)?.terrain_type ? " | 地形: " + ((byId(hoveredId) as any)?.terrain_type) : ""}
            {(byId(hoveredId) as any)?.garrison_power ? " | 守军: " + (byId(hoveredId) as any).garrison_power : ""}
          </div>
        </div>
      )}

      {/* 行程状态 */}
      {traveling && (
        <div className="wmc-travel-bar">
          <span>{travelMode === "free" ? "自由行军" : `官道路径 · ${etaDays} 天`}</span>
          <button className="wmc-btn-sm" onClick={cancelTravel}>取消</button>
        </div>
      )}

      {/* 选中单位交互面板 */}
      {selUnit && (
        <div style={{ position: "absolute", left: 8, bottom: 40, background: "rgba(20,28,40,0.92)", border: "1px solid " + selUnit.color, borderRadius: 8, padding: "8px 12px", color: "#eee", fontSize: 12, maxWidth: 220, zIndex: 20 }}>
          <div style={{ fontWeight: 700, color: selUnit.color, marginBottom: 4 }}>
            {UNIT_LABEL[selUnit.type]} · {selUnit.name}
          </div>
          <div style={{ color: "#aaa", marginBottom: 8, fontSize: 11 }}>
            {selUnit.type === "army" && "各势力驻军/行军"}
            {selUnit.type === "army" && selUnit.troops && (
              <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(0,0,0,0.4)", borderRadius: 6, fontSize: 11, lineHeight: 1.7 }}>
                <div style={{ color: "var(--accent-gold)", marginBottom: 4 }}>兵力构成</div>
                {Object.entries(selUnit.troops).map(([uid, cnt]) => (
                  <div key={uid} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>{selUnit.troops && troopName(uid)}</span>
                    <span>x{cnt}</span>
                  </div>
                ))}
              </div>
            )}
            {selUnit.type === "caravan" && "沿商路运送货物"}
            {selUnit.type === "bandit" && "野外游荡，可遭劫掠"}
            {selUnit.type === "npc" && "游历各地的人物"}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {selUnit.type === "bandit" && (
              <button className="wmc-btn wmc-btn-danger" onClick={() => onUnitCombat?.(10, `遭遇 ${selUnit.name}`)}>交战</button>
            )}
            {selUnit.type === "army" && (
              <>
                <button className="wmc-btn" onClick={() => onUnitCombat?.(15, `与 ${selUnit.name} 交战`)}>交战</button>
                {state.vassal_of && selUnit.factionKey === state.vassal_of && !state.joined_army && (
                  <button className="wmc-btn" onClick={() => onJoinArmy?.(selUnit.id)}>加入军团</button>
                )}
                {state.joined_army === selUnit.id && (
                  <button className="wmc-btn wmc-btn-ghost" onClick={() => onLeaveArmy?.()}>脱离军团</button>
                )}
              </>
            )}
            {(selUnit.type === "caravan" || selUnit.type === "npc") && (
              <button className="wmc-btn" onClick={() => onUnitInteract?.(selUnit)}>
                {selUnit.type === "caravan" ? "交易" : "交谈"}
              </button>
            )}
            <button className="wmc-btn wmc-btn-ghost" onClick={() => setSelUnit(null)}>关闭</button>
          </div>
        </div>
      )}

      {/* 跨天飘字 */}
      {dayToast > 0 && (
        <div className="wmc-day-toast">+{dayToast} 天</div>
      )}
      {/* 军团战斗消息 toast */}
      {clashToast.length > 0 && (
        <div style={{ position: "absolute", top: 90, left: 12, zIndex: 15, display: "flex", flexDirection: "column", gap: 4, maxWidth: 240 }}>
          {clashToast.map((m, i) => (
            <div key={i} style={{ background: "rgba(120,30,20,0.9)", color: "#ffd9a0", border: "1px solid #ff8c00", borderRadius: 6, padding: "4px 8px", fontSize: 11, lineHeight: 1.5 }}>
              ⚔ {m}
            </div>
          ))}
        </div>
      )}

      {/* 模式切换按钮 */}
      <div className="wmc-mode-toggle">
        <button
          className={"wmc-mode-btn" + (travelMode === "free" ? " wmc-mode-active" : "")}
          onClick={() => { setTravelMode("free"); travelModeRef.current = "free"; }}
        >自由</button>
        <button
          className={"wmc-mode-btn" + (travelMode === "road" ? " wmc-mode-active" : "")}
          onClick={() => { setTravelMode("road"); travelModeRef.current = "road"; }}
        >官道</button>
      </div>

      {/* 接近地点操作条 */}
      {!traveling && nearLoc && (
        <div className="wmc-action-bar">
          <span className="wmc-action-label">{(nearLoc as any).name}</span>
          {canEnter && onEnterTown && (
            <button className="wmc-btn" onClick={onEnterTown}>
              进入城镇
            </button>
          )}
          {(nearLoc as any).type === "pass" && (nearLoc as any).garrison_power > 0 && (
            <button className="wmc-btn wmc-btn-danger" onClick={() => onPassBattle?.((nearLoc as any).garrison_power)}>
              战斗 (守军 {(nearLoc as any).garrison_power})
            </button>
          )}
          {state.vassal_of && !state.siege && (
            <button className="wmc-btn wmc-btn-danger" onClick={() => onSiege?.("start", (nearLoc as any).id)}>
              围城
            </button>
          )}
          {state.siege && state.siege.location_id === (nearLoc as any)?.id && (
            <>
              <button className="wmc-btn" onClick={() => onSiege?.("advance")}>推进</button>
              <button className="wmc-btn wmc-btn-danger" onClick={() => onSiege?.("assault")}>强攻</button>
              <button className="wmc-btn wmc-btn-ghost" onClick={() => onSiege?.("retreat")}>撤退</button>
            </>
          )}
          <button className="wmc-btn wmc-btn-ghost" onClick={() => onCamp?.()}>扎营</button>
        </div>
      )}

      {/* 围城进行中状态（常驻右上角） */}
      {state.siege && (
        <div style={{ position: "absolute", top: 30, right: 20, zIndex: 12, background: "rgba(10,8,4,0.88)", border: "1px solid var(--accent-gold-dark)", borderRadius: 8, padding: "8px 12px", fontSize: 11, lineHeight: 1.6, maxWidth: 200 }}>
          <div style={{ color: "var(--accent-gold)", fontWeight: 600, marginBottom: 4 }}>⚔ 围城进行中</div>
          <div>目标: {(byId(state.siege.location_id) as any)?.name ?? state.siege.location_id}</div>
          <div>守军: {state.siege.garrison} 人</div>
          <div>剩余: {state.siege.days_remaining} 天</div>
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            <button className="wmc-btn" style={{ fontSize: 10, padding: "2px 6px" }} onClick={() => onSiege?.("advance")}>推进</button>
            <button className="wmc-btn wmc-btn-danger" style={{ fontSize: 10, padding: "2px 6px" }} onClick={() => onSiege?.("assault")}>强攻</button>
            <button className="wmc-btn wmc-btn-ghost" style={{ fontSize: 10, padding: "2px 6px" }} onClick={() => onSiege?.("retreat")}>撤退</button>
          </div>
        </div>
      )}
      {/* 缩放控件（小地图下方，垂直堆叠） */}
      <div className="wmc-zoom-controls" style={{ position: "absolute", top: 146, right: 20, display: "flex", flexDirection: "column", gap: 4, zIndex: 10 }}>
        <button className="wmc-zoom-btn" onClick={zoomIn} title="放大">+</button>
        <button className="wmc-zoom-btn" onClick={zoomOut} title="缩小">−</button>
        <button className="wmc-zoom-btn" onClick={zoomFit} title="适应">适配</button>
      </div>

      {/* 图例 */}
      <div className="wmc-legend">
        {Object.entries(LOC_LABEL).map(([k, v]) => (
          <span key={k} className="wmc-legend-item">{v}</span>
        ))}
      </div>

      {/* 区域名 */}
      {region && (
        <div className="wmc-region-badge">{region.name}</div>
      )}

      {/* 小地图（右上角，缩放控件在其下） */}
      <div style={{ position: "absolute", top: 16, right: 16, background: "#0e1420", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, padding: 2, zIndex: 10 }}>
        <canvas ref={miniRef} style={{ width: 120, height: 120, display: "block" }} />
      </div>
    </div>
  );
}

export default WorldMapCanvas;