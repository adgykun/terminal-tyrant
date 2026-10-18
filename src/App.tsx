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
import { KingdomPanel } from "./components/KingdomPanel";
import { CombatModal } from "./components/CombatModal";
import { move, resolve_combat_simple, move_region, advance_free_move, start_siege, siege_daily_progress, assault_siege, retreat_siege } from "./core/engine";

export default function App() {
  const game = useGame();

  if (!game.state) {
    return <StartMenu onStart={game.startNewGame} onStartWithRegion={game.startNewGameWithRegion} onLoad={game.loadGame} hasSave={game.hasSave} />;
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
                    game.setCombat({ enemyPower: evt.enemy_power ?? 10, result: null, description: evt.description ?? "" });
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
                    game.setCombat({ enemyPower: evt.enemy_power ?? 10, result: null, description: evt.description ?? "" });
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
              return result;
            }}
            onFreeMove={(dist, onRoad) => {
              game.performAction((s: any) => {
                const { events, daysPassed } = advance_free_move(s, dist, onRoad);
                for (const ev of events) {
                  if (ev.type === "combat") {
                    game.setCombat({ enemyPower: ev.enemy_power ?? 10, result: null, description: ev.description ?? "" });
                  } else if (ev.type === "caravan" || ev.type === "treasure") {
                    game.setEventPopup({
                      title: ev.type === "caravan" ? "遭遇商队" : "发现宝藏",
                      description: ev.description ?? "",
                      type: ev.type,
                    });
                  }
                }
                return { ok: true, daysPassed };
              });
            }}
            onEnterTown={() => game.setView("town")}
            onUnitCombat={(ep, desc) => {
              game.setCombat({ enemyPower: ep, result: null, description: desc });
            }}
            onUnitInteract={(u) => {
              const txt = u.type === "caravan" ? "商队表示可以与你交易货物（尚未实现跑商）。" : "旅人向你打听附近的情报（尚未实现 NPC 对话）。";
              game.setEventPopup({ title: u.type === "caravan" ? "遇到商队" : "遇到旅人", description: txt, type: "info" });
            }}
            onPassBattle={(garrison) => {
              game.setCombat({ enemyPower: garrison, result: null, description: "攻克关隘" });
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
              const fn =
                action === "start" ? (s: any, id: string) => start_siege(s, id)
                : action === "advance" ? (s: any) => siege_daily_progress(s)
                : action === "assault" ? (s: any) => assault_siege(s)
                : (s: any) => retreat_siege(s);
              game.performAction(fn as any, locId as any);
            }}
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
      case "kingdom":
        return <KingdomPanel state={gs} performAction={game.performAction} />;
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