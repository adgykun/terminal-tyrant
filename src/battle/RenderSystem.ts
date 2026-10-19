/**
 * RenderSystem —— 把 ECS 实体（Position + Team）同步到 Three.js 渲染。
 *
 * 渲染对象：
 *  - 优先使用 GLTF 模型（ModelCache 预加载的 Xbot，带动画）；
 *  - 模型未加载 / 加载失败时回退彩色锥体（保持原有行为）。
 *
 * 动画状态机：
 *  - idle / walk / attack / death 按实体状态切换（移动→walk、锁定目标→attack、死亡→death）；
 *  - AnimationMixer + crossFade 淡入淡出；
 *  - 距相机超过 DISTANCE_CULL 的单位不更新动画（静态姿势），远处只同步位置。
 *
 * 外观：
 *  - Team 决定染色（蓝方 / 红方 / 玩家淡蓝）；
 *  - TroopType 决定缩放（步兵略大、弓手略小，玩家 1.5x）；
 *  - 玩家实体（PlayerControl）用特殊高亮材质 + 更大体积。
 */
import * as THREE from "three";
import { System } from "../ecs/System";
import { Position } from "./Position";
import { Team } from "./Team";
import { Visual } from "./Visual";
import { PlayerControl } from "./PlayerControl";
import { TroopType } from "./TroopType";
import { Health } from "./Health";
import { Target } from "./Target";
import { Velocity } from "./Velocity";
import {
  getModelClone,
  getModelClips,
  resolveAnimClip,
  playAnim,
  isModelLoaded,
  type AnimKind,
} from "./ModelCache";

/** 单个实体的渲染状态（模型实例 or 锥体回退）。 */
interface RenderUnit {
  /** 根节点（模型 Group 或锥体 Mesh）。 */
  root: THREE.Object3D;
  /** 是否为 GLTF 模型（否则为锥体）。 */
  isModel: boolean;
  /** 动画混合器（仅模型）。 */
  mixer: THREE.AnimationMixer | null;
  /** 当前动画 clip（null = 未开始）。 */
  currentClip: THREE.AnimationClip | null;
  /** 当前 AnimationAction。 */
  action: THREE.AnimationAction | null;
  /** 上次动画语义（避免每帧重复切换）。 */
  lastKind: AnimKind | null;
  /** 模型名字（回退锥体时为 null）。 */
  modelName: string | null;
}

export class RenderSystem extends System {
  private readonly scene: THREE.Scene;
  /** 摄像机（BattleView 可通过它实现轨道控制/跟随）。 */
  readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly units = new Map<number, RenderUnit>();
  private readonly container: HTMLElement;
  // ===== 轨道控制 =====
  private theta = 0;            // 水平角
  private phi = 1.1;            // 俯仰角（clamp 0.25..1.45）
  private radius = 32;          // 到焦点距离
  private readonly target = new THREE.Vector3(0, 0, 0); // 观察焦点
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private pinchDist = 0;
  // ===== 镜头震动（玩家攻击命中时触发） =====
  private shakeTime = 0;  private static readonly SHAKE_DURATION = 0.25;
  private static readonly SHAKE_AMPLITUDE = 0.35;
  // ===== 攻城战场景 =====
  private siegeGate: THREE.Mesh | null = null;
  private siegeGateOpen = false;
  private siegeGateOpenT = 0;
  private siegeGateMat: THREE.MeshBasicMaterial | null = null;
  // ===== 模型 / 动画配置 =====
  /** 超过此距离（世界单位）的单位不再更新动画，用静态姿势。 */
  private static readonly DISTANCE_CULL = 50;
  /** 默认兵种模型。 */
  private static readonly DEFAULT_MODEL = "xbot";
  /** 兵种 → 模型名（当前全部用 Xbot；后续可替换为 Quaternius 各兵种模型）。 */
  private static readonly TROOP_MODEL: Record<string, string> = {
    default: "xbot",
  };
  /** 兵种 → 缩放（相对基准 1.6m 身高的比例）。 */
  private static readonly TROOP_SCALE: Record<string, number> = {
    peasant: 0.9,
    infantry: 1.05,
    archer: 0.95,
    cavalry: 1.15,
  };
  /** 玩家模型（英雄）。 */
  private static readonly PLAYER_MODEL = "xbot";

  constructor(container: HTMLElement) {
    super("RenderSystem");
    this.container = container;
    const w = Math.max(container.clientWidth, 320);
    const h = Math.max(container.clientHeight, 240);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500);
    this.camera.position.set(0, 26, 30);
    this.camera.lookAt(0, 0, 0);
  }

  onAttach(): void {
    this.container.appendChild(this.renderer.domElement);
    // 地面
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshBasicMaterial({ color: 0x2a3a2a, side: THREE.DoubleSide })
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    // 环境光 + 平行光
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(10, 20, 8);
    this.scene.add(dir);

    // 轨道控制事件
    const el = this.renderer.domElement;
    el.style.touchAction = "none";
    el.style.cursor = "grab";
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointercancel", this.onPointerUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    this.container.addEventListener("touchstart", this.onTouchStart, { passive: false });
    this.container.addEventListener("touchmove", this.onTouchMove, { passive: false });
    this.container.addEventListener("touchend", this.onTouchEnd);
  }

  /**
   * 搭建攻城战场：左右两段城墙 + 两座塔楼 + 中间可破坏的城门。
   * 只应在战斗初始化时调用一次。
   */
  enableSiege(cfg: { gateX: number; gateZ: number; gateHalfWidth: number; wallHalfWidth: number }): void {
    const { gateX, gateZ, gateHalfWidth, wallHalfWidth } = cfg;
    const wallH = 6.5;
    const wallD = 1.6;
    const wallMat = new THREE.MeshBasicMaterial({ color: 0x6b6257 });

    // 左右两段城墙（门洞两侧）
    const segW = wallHalfWidth - gateHalfWidth;
    for (const sign of [-1, 1]) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallD), wallMat);
      seg.position.set(gateX + sign * (gateHalfWidth + segW / 2), wallH / 2, gateZ);
      this.scene.add(seg);
      // 墙顶垛口（视觉提示：这是可守的墙）
      const crenel = new THREE.Mesh(
        new THREE.BoxGeometry(segW, 0.7, wallD + 0.5),
        new THREE.MeshBasicMaterial({ color: 0x585047 }),
      );
      crenel.position.set(seg.position.x, wallH + 0.35, gateZ);
      this.scene.add(crenel);
      // 塔楼
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, wallH + 2.4, 3.2),
        new THREE.MeshBasicMaterial({ color: 0x7a7065 }),
      );
      tower.position.set(gateX + sign * wallHalfWidth, (wallH + 2.4) / 2, gateZ);
      this.scene.add(tower);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 2.2, 4),
        new THREE.MeshBasicMaterial({ color: 0x8a4a3a }),
      );
      roof.position.set(tower.position.x, wallH + 2.4 + 1.1, gateZ);
      roof.rotation.y = Math.PI / 4;
      this.scene.add(roof);
    }

    // 门楣（门洞上方的墙体）
    const lintelH = wallH - 4.2;
    if (lintelH > 0) {
      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(gateHalfWidth * 2, lintelH, wallD),
        wallMat,
      );
      lintel.position.set(gateX, 4.2 + lintelH / 2, gateZ);
      this.scene.add(lintel);
    }

    // 城门本体（可破坏：破门后下沉）
    const gateMat = new THREE.MeshBasicMaterial({ color: 0x6b4a2a });
    const gate = new THREE.Mesh(new THREE.BoxGeometry(gateHalfWidth * 2, 4.2, 0.9), gateMat);
    gate.position.set(gateX, 2.1, gateZ);
    this.scene.add(gate);
    this.siegeGate = gate;
    this.siegeGateMat = gateMat;
    this.siegeGateOpen = false;
    this.siegeGateOpenT = 0;

    // 门前空地色块：标出进攻方集结区
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(gateHalfWidth * 2 + 6, 9),
      new THREE.MeshBasicMaterial({ color: 0x3a3228, side: THREE.DoubleSide }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(gateX, 0.02, gateZ + 5.5);
    this.scene.add(apron);
  }

  /** 城门耐久变化（0..1）：颜色由木色渐变为焦黑。 */
  setGateDamage(frac: number): void {
    if (!this.siegeGateMat) return;
    const f = Math.max(0, Math.min(1, frac));
    // 完好 = 0x6b4a2a；受损 = 深褐 → 焦黑
    const r = Math.round(0x6b * (0.35 + f * 0.65));
    const g = Math.round(0x4a * (0.3 + f * 0.7));
    const b = Math.round(0x2a * (0.25 + f * 0.75));
    this.siegeGateMat.color.setRGB(r / 255, g / 255, b / 255);
  }

  /** 破门：城门开始下沉。 */
  openGate(): void {
    this.siegeGateOpen = true;
  }

  /** 城门开启动画（每帧）。 */
  private updateSiegeVisual(dt: number): void {
    if (!this.siegeGate || !this.siegeGateOpen) return;
    if (this.siegeGateOpenT >= 1) return;
    this.siegeGateOpenT = Math.min(1, this.siegeGateOpenT + dt * 0.8);
    // 下沉 + 后倒，模拟被砸塌
    this.siegeGate.position.y = 2.1 - this.siegeGateOpenT * 4.0;
    this.siegeGate.rotation.x = -this.siegeGateOpenT * (Math.PI / 2.2);
  }

  update(dt: number): void {
    this.updateFocus(dt);    if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - dt);
    this.updateSiegeVisual(dt);
    const alive = new Set<number>();
    const camPos = this.camera.position;
    for (const e of this.world.query(Position, Team, Visual)) {
      alive.add(e.id);
      const p = e.getComponent(Position)!;
      const t = e.getComponent(Team)!;
      const vis = e.getComponent(Visual)!;
      let unit = this.units.get(e.id);
      if (!unit) {
        unit = this.createUnit(e, t, vis);
        this.scene.add(unit.root);
        this.units.set(e.id, unit);
      }
      const pos = unit.root.position;
      pos.set(p.x, p.y, p.z);
      // 模型朝向：面向最近敌人（或默认朝 -x 方向，即敌方所在侧）
      this.faceEnemy(e, unit.root);
      // 动画更新（远距离跳过）
      const dist = pos.distanceTo(camPos);
      if (unit.mixer && dist < RenderSystem.DISTANCE_CULL) {
        this.updateAnim(e, unit, dt);
      }
    }
    // 实体被销毁 → 同步移除渲染单位
    for (const [id, unit] of this.units) {
      if (!alive.has(id)) {
        this.scene.remove(unit.root);
        this.disposeUnit(unit);
        this.units.delete(id);
      }
    }
    this.applyCamera();
    this.renderer.render(this.scene, this.camera);
  }

  onDetach(): void {
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerUp);
    el.removeEventListener("wheel", this.onWheel);
    this.container.removeEventListener("touchstart", this.onTouchStart);
    this.container.removeEventListener("touchmove", this.onTouchMove);
    this.container.removeEventListener("touchend", this.onTouchEnd);
    this.world?.forEach((e) => {
      this.units.delete(e.id);
    });
    for (const unit of this.units.values()) this.disposeUnit(unit);
    this.units.clear();
    // 清理攻城场景网格
    this.siegeGate = null;
    this.siegeGateMat = null;
    this.siegeGateOpen = false;
    this.siegeGateOpenT = 0;
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ===== 渲染单位创建 / 销毁 =====
  /** 为实体创建渲染单位：优先 GLTF 模型，回退锥体。 */
  private createUnit(
    e: import("../ecs/Entity").Entity,
    team: Team,
    vis: Visual
  ): RenderUnit {
    const isPlayer = e.hasComponent(PlayerControl);
    const troop = e.getComponent(TroopType)?.id ?? "default";
    const modelName = isPlayer
      ? RenderSystem.PLAYER_MODEL
      : RenderSystem.TROOP_MODEL[troop] ?? RenderSystem.TROOP_MODEL.default;
    if (isModelLoaded(modelName)) {
      const group = getModelClone(modelName);
      if (group) {
        // 染色：递归遍历模型材质，按 team 染色；玩家高亮金色
        this.tintModel(group, isPlayer ? 0xffdd66 : team.color, isPlayer);
        // 缩放：玩家 1.5x，兵种差异化
        const base = RenderSystem.TROOP_SCALE[troop] ?? 1;
        const scale = isPlayer ? base * 1.5 : base;
        group.scale.setScalar(scale);
        // Xbot 模型正面朝向本地 +Z；游戏坐标系中 x 轴是左右、z 轴是纵深。
        // 不预先旋转 Group（faceEnemy 每帧统一用 yaw 计算朝向）。
        // 动画混合器
        const mixer = new THREE.AnimationMixer(group);
        return {
          root: group,
          isModel: true,
          mixer,
          currentClip: null,
          action: null,
          lastKind: null,
          modelName,
        };
      }
    }
    // 回退：彩色锥体
    const geo = new THREE.ConeGeometry(vis.radius, vis.height, 6);
    const mat = new THREE.MeshStandardMaterial({ color: team.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;
    return {
      root: mesh,
      isModel: false,
      mixer: null,
      currentClip: null,
      action: null,
      lastKind: null,
      modelName: null,
    };
  }

  /** 递归染色模型材质（按 team 色；玩家额外加金色 emissive）。 */
  private tintModel(root: THREE.Object3D, color: number, isPlayer: boolean): void {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.isMaterial) {
          const tint = mat.clone();
          tint.color.setHex(color);
          if (isPlayer) {
            tint.emissive = new THREE.Color(0x332200);
            tint.emissiveIntensity = 0.4;
          }
          mesh.material = tint;
        }
      }
    });
  }

  /** 朝向：玩家用 PlayerControl 的朝向；AI 用最近敌人（或默认朝敌方）。 */
  private faceEnemy(e: import("../ecs/Entity").Entity, root: THREE.Object3D): void {
    const p = e.getComponent(Position)!;
    let dx = 0;
    let dz = 0;
    // 玩家：跟随输入朝向
    const pc = e.getComponent(PlayerControl);
    if (pc && (pc.dirX !== 0 || pc.dirZ !== 0)) {
      dx = pc.dirX;
      dz = pc.dirZ;
    } else {
      const targetId = e.getComponent(Target)?.targetId;
      if (targetId != null) {
        const target = this.world.getEntity(targetId);
        const tp = target?.getComponent(Position);
        if (tp) {
          dx = tp.x - p.x;
          dz = tp.z - p.z;
        }
      }
      // 无目标：默认朝敌方（x 负方向）
      if (dx === 0 && dz === 0) {
        dx = -1;
      }
    }
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      // 模型本地正面为 +Z：rotation.y = atan2(dirX, dirZ) 使 +Z 指向 (dx, dz)
      root.rotation.y = Math.atan2(dx, dz);
    }
  }

  /** 更新动画状态机（idle/walk/attack/death + crossFade）。 */
  private updateAnim(
    e: import("../ecs/Entity").Entity,
    unit: RenderUnit,
    dt: number
  ): void {
    const mixer = unit.mixer!;
    if (!unit.action) {
      // 首次：先播 idle
      const idle = resolveAnimClip(unit.modelName!, "idle", getModelClips(unit.modelName!)[0] ?? null);
      if (idle) {
        unit.action = playAnim(mixer, idle, null);
        unit.currentClip = idle;
        unit.lastKind = "idle";
      }
    }
    // 推进混合器（含 crossFade 过程）
    mixer.update(dt);
    // 计算应播放的动画
    const kind = this.resolveAnimKind(e);
    if (kind === unit.lastKind) return;
    const fallback = unit.currentClip ?? getModelClips(unit.modelName!)[0] ?? null;
    const next = resolveAnimClip(unit.modelName!, kind, fallback);
    if (!next || next === unit.currentClip) {
      unit.lastKind = kind;
      return;
    }
    unit.action = playAnim(mixer, next, unit.action, 0.25);
    unit.currentClip = next;
    unit.lastKind = kind;
  }

  /** 根据实体状态决定动画语义。 */
  private resolveAnimKind(e: import("../ecs/Entity").Entity): AnimKind {
    const hp = e.getComponent(Health);
    if (!hp?.alive) return "death";
    const vel = e.getComponent(Velocity);
    const speed = vel ? Math.hypot(vel.vx, vel.vz) : 0;
    const hasTarget = e.getComponent(Target)?.targetId != null;
    if (hasTarget && speed < 0.2) return "attack"; // 在攻击距离内站定 → 攻击
    if (speed > 0.2) return "walk";
    return "idle";
  }

  /** 释放渲染单位资源。 */
  private disposeUnit(unit: RenderUnit): void {
    if (unit.mixer) {
      unit.mixer.stopAllAction();
      unit.mixer.uncacheRoot(unit.root);
    }
    unit.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });
  }

  // ===== 轨道控制实现 =====
  /** 触发一次镜头震动（玩家攻击命中时由 BattleView 调用）。 */
  addShake(): void {
    this.shakeTime = RenderSystem.SHAKE_DURATION;
  }
  /** 平滑跟随焦点：玩家存活时跟随玩家，否则跟随战场质心（仅当无人拖拽时）。 */
  private updateFocus(dt: number): void {
    if (this.dragging) return;
    let targetX: number | null = null;
    let targetZ: number | null = null;
    // 优先跟随玩家实体（PlayerControl）
    this.world.forEach((e) => {
      if (targetX != null) return;
      if (!e.hasComponent(PlayerControl)) return;
      const pos = e.getComponent(Position);
      if (pos) {
        targetX = pos.x;
        targetZ = pos.z;
      }
    });
    if (targetX == null) {
      // 玩家阵亡 / 不存在 → 跟随战场质心
      let cx = 0;
      let cz = 0;
      let n = 0;
      this.world.forEach((e) => {
        const pos = e.getComponent(Position);
        if (pos) {
          cx += pos.x;
          cz += pos.z;
          n++;
        }
      });
      if (n > 0) {
        targetX = cx / n;
        targetZ = cz / n;
      }
    }
    if (targetX == null || targetZ == null) return;
    const lerp = Math.min(1, dt * 2.5);
    this.target.x += (targetX - this.target.x) * lerp;
    this.target.z += (targetZ - this.target.z) * lerp;
  }
  /** 依据轨道参数摆位相机（叠加镜头震动偏移）。 */
  private applyCamera(): void {
    const t = this.target;
    const cosPhi = Math.cos(this.phi);
    const sinPhi = Math.sin(this.phi);
    const sinTheta = Math.sin(this.theta);
    const cosTheta = Math.cos(this.theta);
    this.camera.position.set(
      t.x + this.radius * sinPhi * sinTheta,
      t.y + this.radius * cosPhi,
      t.z + this.radius * sinPhi * cosTheta
    );
    if (this.shakeTime > 0) {
      const k = (this.shakeTime / RenderSystem.SHAKE_DURATION) * RenderSystem.SHAKE_AMPLITUDE;
      this.camera.position.x += (Math.random() - 0.5) * 2 * k;
      this.camera.position.y += (Math.random() - 0.5) * 2 * k;
      this.camera.position.z += (Math.random() - 0.5) * 2 * k;
    }
    this.camera.lookAt(t.x, t.y, t.z);
  }

  // ----- 指针/滚轮/触摸 -----
  private onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    const el = this.renderer.domElement;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = "grabbing";
  };
  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.theta -= dx * 0.006;
    this.phi = Math.max(0.25, Math.min(1.45, this.phi - dy * 0.004));
  };
  private onPointerUp = (e: PointerEvent): void => {
    this.dragging = false;
    const el = this.renderer.domElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    el.style.cursor = "grab";
  };
  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.radius = Math.max(10, Math.min(70, this.radius + e.deltaY * 0.03));
  };
  private onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      this.pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  };
  private onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (this.pinchDist > 0) {
        this.radius = Math.max(10, Math.min(70, this.radius * (this.pinchDist / d)));
      }
      this.pinchDist = d;
    }
  };
  private onTouchEnd = (): void => {
    this.pinchDist = 0;
  };
}