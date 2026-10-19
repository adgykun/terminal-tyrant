import { useState } from "react";
import { useGame } from "./hooks/useGame";
import { StatusBar } from "./components/StatusBar";
import { Sidebar } from "./components/Sidebar";
import { LogPanel } from "./components/LogPanel";
import { StartMenu } from "./components/StartMenu";
import { WorldMapCanvas } from "./components/WorldMapCanvas";
import { TownScene } from "./components/TownScene";
import { CharacterPanel } from "./components/CharacterPanel";
import { PartyPanel } from "./components/PartyPanel";
import { InventoryPanel } from "./components/InventoryPanel";
import { QuestPanel } from "./components/QuestPanel";
import { LordPanel } from "./components/LordPanel";
import { KingdomPanel } from "./components/KingdomPanel";
import { CombatModal } from "./components/CombatModal";
import { CaravanTradePanel } from "./components/CaravanTradePanel";
import { DialoguePanel } from "./components/DialoguePanel";
import { BattleView } from "./battle/BattleView";
import { move, resolve_combat_simple, move_region, advance_free_move, start_siege, siege_daily_progress, assault_siege, retreat_siege, join_army, leave_army, trigger_battle, power_to_enemy_troops, siege_defender_troops, siege_assault_victory, siege_assault_defeat } from "./core/engine";
import { reportBattle } from "./core/battle_bridge";
import { defeatLord } from "./core/lords_system";
import { LOCATIONS, FACTIONS } from "./core/data";

export default function App() {
  const game = useGame();
  const [tradeCaravan, setTradeCaravan] = useState<{ id: string; name: string } | null>(null);
  const [talkLordId, setTalkLordId] = useState<string | null>(null);

  if (!game.state) {
    return <StartMenu onStart={game.startNewGame} onLoad={game.loadGame} hasSave={game.hasSave} />;
  }

  const gs = game.state;

  const renderView = () => {
    switch (game.view) {
      case "map":
        return (
          <WorldMapCanvas
            state={gs}
            onMove={(targetId: string) => {
              const isRegionMode = gs.selected_region && gs.region_locations;
              const result = game.performAction((s: any, tid: string) => {
                if (s.selected_region && s.region_locations) {
                  const [ok, msg, evt] = move_region(s, tid);
                  if (ok && evt && evt.type === "combat") {
                    // 3D 战斗：生成敌军并挂标记，App 依据标记切视图
                    const battle = trigger_battle(s, power_to_enemy_troops(evt.enemy_power ?? 10), evt.description ?? "");
                    return { ok, msg, evt, battle };
                  } else if (ok && evt && (evt.type === "caravan" || evt.type === "treasure")) {
                    game.setEventPopup({
                      title: evt.type === "caravan" ? "遭遇商队" : "发现宝藏",
                      description: evt.description ?? msg,
                      type: evt.type,
                    });
                  }
                  return { ok, msg, evt };
                } else {
                  const [ok, msg, evt] = move(s, tid);
                  if (ok && evt && evt.type === "combat") {
                    // 3D 战斗：生成敌军并挂标记，App 依据标记切视图
                    const battle = trigger_battle(s, power_to_enemy_troops(evt.enemy_power ?? 10), evt.description ?? "");
                    return { ok, msg, evt, battle };
                  } else if (ok && evt && (evt.type === "caravan" || evt.type === "treasure")) {
                    game.setEventPopup({
                      title: evt.type === "caravan" ? "遭遇商队" : "发现宝藏",
                      description: evt.description ?? msg,
                      type: evt.type,
                    });
                  }
                  return { ok, msg, evt };
                }
              }, targetId);
              // 处理 3D 战斗标记：切到 battle 视图并带上敌方部队
              if (result && result.battle) {
                game.startBattle(result.battle.enemy_troops, result.battle.enemy_power, result.battle.description);
              }
              return result;
            }}
            onFreeMove={(dist, onRoad) => {
              const res = game.performAction((s: any) => {
                const { events, daysPassed } = advance_free_move(s, dist, onRoad);
                let pendingBattle: any = null;
                for (const ev of events) {
                  if (ev.type === "combat") {
                    // 3D 战斗：生成敌军并挂标记
                    pendingBattle = trigger_battle(s, power_to_enemy_troops(ev.enemy_power ?? 10), ev.description ?? "");
                  } else if (ev.type === "caravan" || ev.type === "treasure") {
                    game.setEventPopup({
                      title: ev.type === "caravan" ? "遭遇商队" : "发现宝藏",
                      description: ev.description ?? "",
                      type: ev.type,
                    });
                  }
                }
                return { ok: true, daysPassed, pendingBattle };
              });
              if (res && res.pendingBattle) {
                game.startBattle(res.pendingBattle.enemy_troops, res.pendingBattle.enemy_power, res.pendingBattle.description);
              }
            }}
            onEnterTown={() => game.setView("town")}
            onUnitCombat={(ep, desc) => {
              // 地图单位交战 → 3D 战斗
              const res = game.performAction((s: any) => {
                const battle = trigger_battle(s, power_to_enemy_troops(ep), desc);
                return { battle };
              });
              if (res && res.battle) {
                game.startBattle(res.battle.enemy_troops, res.battle.enemy_power, res.battle.description);
              }
            }}
            onStartBattle={(enemyTroops, desc) => {
              // 3D 战斗入口（WorldMapCanvas 已折算好敌军）
              const res = game.performAction((s: any) => {
                const battle = trigger_battle(s, enemyTroops, desc);
                return { battle };
              });
              if (res && res.battle) {
                game.startBattle(res.battle.enemy_troops, res.battle.enemy_power, res.battle.description);
              }
            }}
            onBattleTarget={(unitId, enemyTroops, lordId) => {
              // 记录正在与哪支大地图军团交战，战后把伤亡写回该军团
              game.setBattleTarget?.(unitId, enemyTroops, lordId);
            }}
            onUnitInteract={(u) => {
              if (u.type === "caravan") {
                // 真实流动贸易：该商队有当日现货与价格
                setTradeCaravan({ id: u.id, name: u.name || "商队" });
                return;
              }
              // 旅人：给出真实的地区情报（不是占位文本）
              const locs = Object.values(LOCATIONS) as any[];
              const pick = locs[Math.floor(Math.random() * locs.length)];
              const hints = [
                `旅人压低声音：「${pick?.name ?? "附近"}这几日商队频繁，粮价怕是要跌。」`,
                `旅人摊开皱巴巴的地图：「${pick?.name ?? "前面的镇子"}守军不多，夜里换防。」`,
                `旅人打量你的队伍：「你这点人马，要去${pick?.name ?? "前线"}？劝你三思。」`,
                `旅人递来一口水：「听说${FACTIONS[Object.keys(FACTIONS)[Math.floor(Math.random() * Object.keys(FACTIONS).length)]]?.name ?? "某国"}又在调兵了。」`,
              ];
              game.setEventPopup({
                title: "遇到旅人",
                description: hints[Math.floor(Math.random() * hints.length)],
                type: "dialogue",
              });
            }}
            onPassBattle={(garrison) => {
              // 关隘守军 → 3D 战斗
              const res = game.performAction((s: any) => {
                const battle = trigger_battle(s, power_to_enemy_troops(garrison), "攻克关隘");
                return { battle };
              });
              if (res && res.battle) {
                game.startBattle(res.battle.enemy_troops, res.battle.enemy_power, res.battle.description);
              }
            }}
            onCamp={() => {
              game.performAction((s: any) => {
                s.morale = Math.min(100, (s.morale ?? 0) + 20);
                s.food = Math.max(0, (s.food ?? 0) - 5);
                s.add_log?.("你在野外扎营休整，士气 +20，粮食 -5。");
                return { ok: true };
              });
            }}
            onSiege={(action, locId) => {
              if (action === "assault") {
                // 强攻 → 进入 3D 攻城战（城墙隔开两军，先破门）
                const info = game.performAction((s: any) => {
                  if (!s.siege) return null;
                  const loc = (LOCATIONS as any)[s.siege.location_id]
                    ?? Object.values(LOCATIONS).find((l: any) => l.id === s.siege.location_id);
                  return {
                    defenders: siege_defender_troops(s),
                    name: (loc as any)?.name ?? "敌城",
                    garrison: s.siege.garrison ?? 40,
                  };
                });
                if (info) {
                  game.startSiegeBattle(info.defenders, info.name, info.garrison);
                }
                return;
              }
              const fn =
                action === "start" ? (s: any, id: string) => start_siege(s, id)
                : action === "advance" ? (s: any) => siege_daily_progress(s)
                : (s: any) => retreat_siege(s);
              game.performAction(fn as any, locId as any);
            }}
            onJoinArmy={(armyId) => game.performAction((s: any) => join_army(s, armyId))}
            onLeaveArmy={() => game.performAction((s: any) => leave_army(s))}
          />
        );
      case "town":
        return <TownScene state={gs} performAction={game.performAction} setView={game.setView} />;
      case "character":
        return <CharacterPanel state={gs} performAction={game.performAction} />;
      case "party":
        return <PartyPanel state={gs} performAction={game.performAction} />;
      case "inventory":
        return <InventoryPanel state={gs} performAction={game.performAction} />;
      case "quests":
        return <QuestPanel state={gs} performAction={game.performAction} />;
      case "lords":
        return (
          <LordPanel
            state={gs}
            performAction={game.performAction}
            onTalk={(lordId) => setTalkLordId(lordId)}
          />
        );
      case "kingdom":
        return <KingdomPanel state={gs} performAction={game.performAction} />;
      case "battle":
        return (
          <BattleView
            playerTroops={gs.troops}
            enemyTroops={game.battleEnemy?.enemyTroops}
            siege={game.battleEnemy?.siege}
            onBattleEnd={(result) => {
              const targetUnitId = game.battleEnemy?.sourceUnitId;
              const targetLordId = game.battleEnemy?.sourceLordId;
              const siegeInfo = game.battleEnemy?.siege;
              // 战斗结束：把按兵种伤亡精确写回 state.troops
              game.performAction((s: any) => {
                const t = s.troops ?? {};
                for (const [id, cnt] of Object.entries(result.casualties)) {
                  if (cnt > 0 && t[id] != null) t[id] = Math.max(0, t[id] - cnt);
                }
                const lost = Object.values(result.casualties as Record<string, number>)
                  .reduce((a: number, b) => a + b, 0);
                if (siegeInfo) {
                  // ── 攻城战结算：破城则易主，失败则溃退 ──
                  const msg = result.won
                    ? siege_assault_victory(s)
                    : siege_assault_defeat(s);
                  s.add_log?.(result.won
                    ? `攻城成功！阵亡 ${lost} 人。`
                    : `攻城失利，阵亡 ${lost} 人。`);
                  return msg;
                }
                s.add_log?.(
                  result.won
                    ? `3D 战场大捷！阵亡 ${lost} 人，余部 ${Object.values(result.survivors as Record<string, number>).reduce((a: number, b) => a + b, 0)} 人凯旋。`
                    : `3D 战场失利…部队全灭，伤亡 ${lost} 人。`
                );
                // ── 闭环：把胜负写回大地图上的那支军团 ──
                if (targetUnitId) {
                  reportBattle(targetUnitId, result.won);
                }
                // ── 闭环：战胜具名领主 → 触发其部队减员与俘获判定 ──
                if (result.won && targetLordId) {
                  const dr = defeatLord(s, targetLordId);
                  if (dr) {
                    s.add_log?.(dr.message);
                    if (dr.captured) {
                      s.add_log?.(`你可以前往「领主」面板处置这位俘虏。`);
                    }
                  }
                }
                return { message: result.won ? "胜利！伤亡已记入部队。" : "溃败…伤亡已记入部队。" };
              });
              // 战斗结束：清敌情、回到地图
              game.setView("map");
              game.setBattleEnemy?.(null);
            }}
          />
        );
      default:
        return <WorldMapCanvas state={gs} onMove={() => {}} />;
    }
  };

  return (
    <div className="app-layout">
      <StatusBar state={gs} />
      <div className="main-area">
        <Sidebar view={game.view} setView={game.setView} state={gs} onQuit={game.quitToMenu} voiceEnabled={game.voiceEnabled} onToggleVoice={game.toggleVoice} />
        <div className="content-area">
          {renderView()}
        </div>
      </div>
      <LogPanel logs={game.logs} />

      {talkLordId && (
        <DialoguePanel
          npcId={talkLordId}
          npcKind="lord"
          state={gs}
          identity={{
            kingdom: (gs as any).vassal_of ?? null,
            isKing: !!gs.is_king,
            renown: gs.renown ?? 0,
            fiefCount: gs.fiefs?.length ?? 0,
          }}
          relation={gs.lords_runtime?.[talkLordId]?.relationWithPlayer ?? 0}
          onClose={() => setTalkLordId(null)}
          performAction={game.performAction}
        />
      )}

      {tradeCaravan && (
        <CaravanTradePanel
          unitId={tradeCaravan.id}
          unitName={tradeCaravan.name}
          state={gs}
          onClose={() => setTradeCaravan(null)}
          onDone={() => game.performAction((s: any) => s.to_dict())}
        />
      )}

      {game.combat && (
        <CombatModal
          combat={game.combat}
          state={gs}
          onResolve={(choice: string) => {
            const engineChoice = choice === "fight" ? "attack" : choice === "flee" ? "retreat" : choice;
            const result = game.performAction(
              (s: any, ep: number, ch: string) => resolve_combat_simple(s, ep, ch),
              game.combat!.enemyPower,
              engineChoice
            );
            game.setCombat({ ...game.combat!, result });
          }}
          onClose={() => game.setCombat(null)}
        />
      )}

      {game.eventPopup && (
        <div className="modal-overlay" onClick={() => game.setEventPopup(null)}>
          <div className="modal fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg mb-12 text-gold">{game.eventPopup.title}</h2>
            <p className="text-sm text-secondary mb-12">{game.eventPopup.description}</p>
            <button className="primary" onClick={() => game.setEventPopup(null)}>继续</button>
          </div>
        </div>
      )}

      {game.resultMessage && !game.combat && (
        <div className="result-toast" onClick={() => game.setResultMessage(null)}>
          {game.resultMessage}
        </div>
      )}
    </div>
  );
}