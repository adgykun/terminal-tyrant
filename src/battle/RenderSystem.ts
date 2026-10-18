/**
 * RenderSystem —— 把 ECS 实体（Position + Team）同步到 Three.js 渲染。
 * 内部维护 entityId -> Mesh 映射，实体销毁时自动移除。
 */
import * as THREE from "three";
import { System } from "../ecs/System";
import { Position } from "./Position";
import { Team } from "./Team";
import { Visual } from "./Visual";

export class RenderSystem extends System {
  private readonly scene: THREE.Scene;
  /** 摄像机（BattleView 可通过它实现轨道控制/跟随）。 */
  readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly meshes = new Map<number, THREE.Mesh>();
  private readonly container: HTMLElement;

  // ===== 轨道控制 =====
  private theta = 0;            // 水平角
  private phi = 1.1;            // 俯仰角（clamp 0.25..1.45）
  private radius = 32;          // 到焦点距离
  private readonly target = new THREE.Vector3(0, 0, 0); // 观察焦点
  private readonly tmp = new THREE.Vector3();
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private pinchDist = 0;

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

  update(dt: number): void {
    this.updateFocus(dt);
    const alive = new Set<number>();
    for (const e of this.world.query(Position, Team, Visual)) {
      alive.add(e.id);
      const p = e.getComponent(Position)!;
      const t = e.getComponent(Team)!;
      const vis = e.getComponent(Visual)!;
      let mesh = this.meshes.get(e.id);
      if (!mesh) {
        const geo = new THREE.ConeGeometry(vis.radius, vis.height, 6);
        const mat = new THREE.MeshStandardMaterial({ color: t.color });
        mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = false;
        this.scene.add(mesh);
        this.meshes.set(e.id, mesh);
      }
      mesh.position.set(p.x, p.y, p.z);
    }
    // 实体被销毁 → 同步移除对应 Mesh
    for (const [id, mesh] of this.meshes) {
      if (!alive.has(id)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.meshes.delete(id);
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
      this.meshes.delete(e.id);
    });
    this.meshes.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ===== 轨道控制实现 =====

  /** 平滑跟随战场质心（仅当无人拖拽时）。 */
  private updateFocus(dt: number): void {
    if (this.dragging) return;
    // 计算当前存活单位的平均位置作为焦点
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
      const targetX = cx / n;
      const targetZ = cz / n;
      // 平滑移动
      const lerp = Math.min(1, dt * 2.5);
      this.target.x += (targetX - this.target.x) * lerp;
      this.target.z += (targetZ - this.target.z) * lerp;
    }
  }

  /** 依据轨道参数摆位相机。 */
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
    // 拖拽旋转
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