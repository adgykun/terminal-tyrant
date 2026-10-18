import { useState, useCallback, useRef } from "react";
import { GameState } from "../core/state";
import * as engine from "../core/engine";
import { init_region } from "../core/engine";
import { isTTSEnabled, setTSEnabled, speak, stopSpeaking } from "../utils/tts";

export type GameView =
  | "menu"
  | "map"
  | "town"
  | "character"
  | "party"
  | "inventory"
  | "quests"
  | "kingdom"
  | "logs"
  | "battle";

export interface CombatState {
  enemyPower: number;
  result: any | null;
  description: string;
}

export interface EventPopup {
  title: string;
  description: string;
  type: "combat" | "caravan" | "treasure" | "info" | "dialogue";
}

/** 3D 战斗的敌方部队数据（由 startBattle 暂存，BattleView 读取）。 */
export interface BattleEnemy {
  enemyTroops: Record<string, number>;
  enemyPower: number;
  description: string;
}
const SAVE_KEY = "terminal_tyrant_save";
export function useGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [view, setView] = useState<GameView>("menu");
  const [logs, setLogs] = useState<string[]>([]);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [eventPopup, setEventPopup] = useState<EventPopup | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(isTTSEnabled());
  const [battleEnemy, setBattleEnemy] = useState<BattleEnemy | null>(null);
  const stateRef = useRef<GameState | null>(null);

  const updateState = useCallback((newState: GameState) => {
    stateRef.current = newState;
    setState(newState);
    newState.save(SAVE_KEY);
    setLogs([...newState.logs].slice(-50));
  }, []);

  const showResult = useCallback((result: any) => {
    if (result == null) return;
    if (typeof result === "string") {
      if (result) {
        setResultMessage(result);
        speak(result);
      }
      return;
    }
    const msg = result.message ?? result.msg ?? result.story ?? "";
    if (msg) {
      setResultMessage(msg);
      const personality = result.personality ?? (result.stance === "grudge" ? "angry" : undefined);
      speak(msg, personality);
    }
  }, []);

  const startNewGame = useCallback((str: number, int: number, charm: number) => {
    const gs = new GameState();
    engine.create_character(gs, str, int, charm);
    engine.init_region(gs, "calradia"); // 直接进入卡拉迪亚大陆（骑砍2 单地图）
    gs.add_log("你踏上了成为'终端暴君'的征途……");
    updateState(gs);
    setView("map");
  }, [updateState]);

  const loadGame = useCallback(() => {
    const loaded = GameState.load(SAVE_KEY);
    if (loaded) {
      stateRef.current = loaded;
      setState(loaded);
      setLogs([...loaded.logs].slice(-50));
      setView("map");
      return true;
    }
    return false;
  }, []);

  const hasSave = useCallback(() => {
    return GameState.has_save(SAVE_KEY);
  }, []);

  const performAction = useCallback(
    (action: (...args: any[]) => any, ...args: any[]): any => {
      const gs = stateRef.current;
      if (!gs) return undefined;
      const result = action(gs, ...args);
      const newGs = new GameState(gs.to_dict());
      updateState(newGs);
      showResult(result);
      return result;
    },
    [updateState, showResult]
  );

  const quitToMenu = useCallback(() => {
    stateRef.current = null;
    setState(null);
    setLogs([]);
    setCombat(null);
    setEventPopup(null);
    setResultMessage(null);
    setBattleEnemy(null);
    stopSpeaking();
    setView("menu");
  }, []);

  /** 开启一场 3D 战斗：暂存敌情、清掉文本战斗弹窗并切到战场视图。 */
  const startBattle = useCallback((enemyTroops: Record<string, number>, enemyPower = 0, description = "") => {
    setCombat(null);
    setEventPopup(null);
    setBattleEnemy({ enemyTroops, enemyPower, description });
    setView("battle");
  }, []);

  const toggleVoice = useCallback(() => {
    const newVal = !voiceEnabled;
    setVoiceEnabled(newVal);
    setTSEnabled(newVal);
    if (!newVal) stopSpeaking();
  }, [voiceEnabled]);

  return {
    state,
    view,
    logs,
    combat,
    eventPopup,
    resultMessage,
    voiceEnabled,
    battleEnemy,
    toggleVoice,
    setView,
    setCombat,
    setEventPopup,
    setResultMessage,
    setBattleEnemy,
    startBattle,
    startNewGame,
    loadGame,
    hasSave,
    performAction,
    quitToMenu,
  };
}
