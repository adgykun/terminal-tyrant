/**
 * ModelCache —— 3D 模型加载与缓存（GLTF/GLB）。
 *
 * 职责：
 *  - 预加载所有兵种模型（当前用 Xbot 占位，含 idle/walk/run 动画）；
 *  - 提供 getModel() 返回可复用的 Group 克隆（每次实体独立实例）；
 *  - 提供 getAnimations() 返回该模型的动画 clip 列表；
 *  - 模型加载失败时返回 null（RenderSystem 回退彩色锥体）。
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** 动画名 → 统一语义（模型缺什么动画就回退到最接近的）。 */
export type AnimKind = "idle" | "walk" | "attack" | "death";

export interface ModelInfo {
  /** 模型文件名（不含路径）。 */
  name: string;
  /** 模型 URL（public/models/characters 下）。 */
  url: string;
  /** 语义动画 → GLB 内动画名；缺省时引擎自动回退。 */
  animMap: Record<AnimKind, string>;
}

/** 兵种模型清单。当前共用 Xbot 占位模型（后续可替换为 Quaternius/Mixamo 真实模型）。 */
export const MODEL_LIST: ModelInfo[] = [
  {
    name: "xbot",
    url: "models/characters/xbot.glb",
    animMap: { idle: "idle", walk: "walk", attack: "run", death: "sad_pose" },
  },
];

/** 已加载模型的缓存：name -> { scene, clips }。 */
const cache = new Map<string, { scene: THREE.Group; clips: THREE.AnimationClip[] }>();

/** 加载全部模型；回调 onProgress(loaded/total)。失败项从缓存剔除（回退锥体）。 */
export async function preloadModels(
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const loader = new GLTFLoader();
  let loaded = 0;
  const total = MODEL_LIST.length;
  await Promise.all(
    MODEL_LIST.map(async (info) => {
      try {
        const gltf = await loader.loadAsync(info.url);
        cache.set(info.name, { scene: gltf.scene, clips: gltf.animations.slice() });
      } catch {
        // 加载失败：不缓存，RenderSystem 回退锥体
        console.warn(`[ModelCache] 加载失败: ${info.url}`);
      } finally {
        loaded++;
        onProgress?.(loaded, total);
      }
    })
  );
}

/** 是否已加载指定模型。 */
export function isModelLoaded(name: string): boolean {
  return cache.has(name);
}

/** 获取模型克隆（每个实体独立 Group 实例；返回 null = 未加载）。 */
export function getModelClone(name: string): THREE.Group | null {
  const entry = cache.get(name);
  if (!entry) return null;
  return entry.scene.clone(true);
}

/** 获取模型的动画 clip 列表（供 AnimationMixer 使用）。 */
export function getModelClips(name: string): THREE.AnimationClip[] {
  const entry = cache.get(name);
  return entry ? entry.clips : [];
}

/** 根据模型动画表 + 语义，解析出可用的 clip 名；缺省回退到 idle。 */
export function resolveAnimClip(
  name: string,
  kind: AnimKind,
  fallback: THREE.AnimationClip | null
): THREE.AnimationClip | null {
  const entry = cache.get(name);
  if (!entry) return null;
  const info = MODEL_LIST.find((m) => m.name === name);
  const targetName = info?.animMap[kind];
  if (targetName) {
    const clip = entry.clips.find((c) => c.name === targetName);
    if (clip) return clip;
  }
  return fallback;
}

/** 播放并交叉淡入指定动作（mixer 必须在实体上存在）。 */
export function playAnim(
  mixer: THREE.AnimationMixer,
  clip: THREE.AnimationClip,
  prevAction: THREE.AnimationAction | null,
  fadeTime = 0.2
): THREE.AnimationAction {
  const action = mixer.clipAction(clip);
  action.reset();
  action.setEffectiveWeight(1);
  action.setEffectiveTimeScale(1);
  if (prevAction && prevAction !== action) {
    prevAction.crossFadeTo(action, fadeTime, true);
  } else {
    action.play();
  }
  return action;
}