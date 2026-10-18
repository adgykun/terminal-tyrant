/**
 * RenderSystem —— 把 ECS 实体（Position + Team）同步到 Three.js 渲染。
 * 内部维护 entityId -> Mesh 映射，实体销毁时自动移除。
 */
import * as THREE from "three";
import { System } from "../ecs/System";
import { Position } from "./Position";
import { Team } from "./Team";

export class RenderSystem extends System {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly meshes = new Map<number, THREE.Mesh>();
  private readonly container: HTMLElement;

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
  }

  update(_dt: number): void {
    for (const e of this.world.query(Position, Team)) {
      const p = e.getComponent(Position)!;
      const t = e.getComponent(Team)!;
      let mesh = this.meshes.get(e.id);
      if (!mesh) {
        const geo = new THREE.ConeGeometry(0.45, 1.1, 6);
        const mat = new THREE.MeshStandardMaterial({ color: t.color });
        mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = false;
        this.scene.add(mesh);
        this.meshes.set(e.id, mesh);
      }
      mesh.position.set(p.x, p.y, p.z);
    }
    this.renderer.render(this.scene, this.camera);
  }

  onDetach(): void {
    this.world?.forEach((e) => {
      this.meshes.delete(e.id);
    });
    this.meshes.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}