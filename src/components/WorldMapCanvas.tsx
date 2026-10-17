import { useRef, useEffect, useState, useCallback } from "react";
import {
  get_map_locations, plan_travel_path, travel_eta_days,
  get_current_location, compute_content_bounds, nearest_location_id,
  FREE_MOVE_SPEED, FREE_MOVE_DAY_DISTANCE,
} from "../core/engine";
import { TERRAIN_COLORS, get_region } from "../core/world_regions";
import type { GameState } from "../core/state";

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
}

// === 工具 ===
function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lerpPt(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// === 主组件 ===
export function WorldMapCanvas({ state, onMove, onEnterTown, onFreeMove }: WorldMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  // 相机
  const camRef = useRef<Camera>({ x: 45, y: 40, zoom: 1.5 });
  // 玩家视觉位置
  const playerPosRef = useRef<{ x: number; y: number }>({ x: 45, y: 40 });
  // 行程
  const travelRef = useRef<TravelState>({ path: [], legIndex: 0, legT: 0, active: false });
  // 目标标记
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  // 拖拽
  const dragRef = useRef<{ startX: number; startY: number; camX: number; camY: number; moved: boolean; startT: number } | null>(null);
  // 触摸
  const touchRef = useRef<{ lastDist: number; lastCx: number; lastCy: number; lastTapT: number; lastTapX: number; lastTapY: number }>({ lastDist: 0, lastCx: 0, lastCy: 0, lastTapT: 0, lastTapX: 0, lastTapY: 0 });
  // 键盘
  const keysRef = useRef<Record<string, boolean>>({});

  // React 状态（只存 UI 层）
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [traveling, setTraveling] = useState(false);
  const [etaDays, setEtaDays] = useState(0);
  const [nearLocId, setNearLocId] = useState<string | null>(null);
  // 自由位移（B 方案）
  const [travelMode, setTravelMode] = useState<"free" | "road">("free");
  const travelModeRef = useRef<"free" | "road">("free");
  const freeRef = useRef<{ active: boolean; tx: number; ty: number; distAcc: number }>({ active: false, tx: 0, ty: 0, distAcc: 0 });
  const [dayToast, setDayToast] = useState(0);

  // 地点缓存
  const locations = get_map_locations(state);
  const byId = useCallback((id: string) => {
    for (const l of locations) { if ((l as any).id === id) return l; }
    return null;
  }, [locations]);

  // 当前所在地
  const curLoc = get_current_location(state);
  const region = state.selected_region ? get_region(state.selected_region) : null;

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
    const cvs = canvasRef.current;
    if (!cvs) return;
    const W = cvs.width, H = cvs.height;
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
  }, [locations.length]);

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

      // 清除 + blit 地形
      ctx.clearRect(0, 0, W, H);
      if (offscreenRef.current) ctx.drawImage(offscreenRef.current, 0, 0);

      // 动态层
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(cam.zoom * 2, cam.zoom * 2);
      ctx.translate(-cam.x, -cam.y);

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

      // 地点图标
      for (const loc of locations as any[]) {
        const lx = (loc as any).x, ly = (loc as any).y;
        const isCur = (loc as any).id === state.location;
        const isHover = (loc as any).id === hoveredId;
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
  }, [locations, state.location, onMove, byId, hoveredId]);

  // === Canvas 尺寸自适应 ===
  useEffect(() => {
    const cvs = canvasRef.current;
    const container = containerRef.current;
    if (!cvs || !container) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      cvs.width = container.clientWidth * dpr;
      cvs.height = container.clientHeight * dpr;
      cvs.style.width = container.clientWidth + "px";
      cvs.style.height = container.clientHeight + "px";
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
      setHoveredId(hit);
    };

    const onUp = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { moved, startT } = dragRef.current;
      const duration = performance.now() - startT;
      dragRef.current = null;
      if (!moved && duration < 300) {
        // 单击 → 设目标
        const rect = cvs.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * (window.devicePixelRatio || 1);
        const sy = (e.clientY - rect.top) * (window.devicePixelRatio || 1);
        const { wx, wy } = screenToWorld(sx, sy);
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
          // 轻点 → 选目标
          const rect = cvs.getBoundingClientRect();
          const sx = (touchRef.current.lastTapX - rect.left) * (window.devicePixelRatio || 1);
          const sy = (touchRef.current.lastTapY - rect.top) * (window.devicePixelRatio || 1);
          const { wx, wy } = screenToWorld(sx, sy);
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

      {/* 跨天飘字 */}
      {dayToast > 0 && (
        <div className="wmc-day-toast">+{dayToast} 天</div>
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
            <button className="wmc-btn wmc-btn-danger">
              战斗 (守军 {(nearLoc as any).garrison_power})
            </button>
          )}
          <button className="wmc-btn wmc-btn-ghost">扎营</button>
        </div>
      )}

      {/* 缩放控件 */}
      <div className="wmc-zoom-controls">
        <button className="wmc-zoom-btn" onClick={zoomIn} title="放大">+</button>
        <button className="wmc-zoom-btn" onClick={zoomOut} title="缩小">2212</button>
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
    </div>
  );
}

export default WorldMapCanvas;