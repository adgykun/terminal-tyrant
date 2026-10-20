import type { GameState } from "../core/state";
import { LOCATIONS } from "../core/data";
import { generate_quests, accept_quest, complete_quest } from "../core/engine";
import { chainProgressSummary } from "../core/quest_chains";
import { ScrollText, CheckCircle, Circle, Coins, Star, BookOpen } from "lucide-react";

interface QuestPanelProps {
  state: GameState;
  performAction: (action: (...args: any[]) => any, ...args: any[]) => any;
}

export function QuestPanel({ state, performAction }: QuestPanelProps) {
  const loc = LOCATIONS[state.location] as any;
  const locationQuests = (loc?.active_quests ?? []) as any[];
  const activeQuests = state.active_quests ?? [];
  const completedQuests = state.completed_quests ?? [];
  const chains = chainProgressSummary(state);

  return (
    <div>
      {/* 故事线进度（任务链） */}
      <div className="panel">
        <div className="panel-title"><BookOpen size={22} /> 故事线</div>
        <div className="text-sm text-muted mb-8">
          任务彼此关联：完成一步才会解锁下一步。
        </div>
        {chains.map((c) => (
          <div key={c.name} className="list-item">
            <div className="flex-col gap-4" style={{ flex: 1 }}>
              <span className="text-bold" style={{ color: c.finished ? "#7ec87e" : undefined }}>
                {c.name}
                {c.finished && <CheckCircle size={13} style={{ display: "inline", marginLeft: 6, verticalAlign: "-2px" }} />}
              </span>
              <span className="text-sm text-muted">
                进度 {c.done} / {c.total}
                {c.finished ? " · 已完成" : c.done > 0 ? " · 进行中" : " · 未开启"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-title"><ScrollText size={22} /> 当前地点任务</div>
        <div className="flex-row gap-8 mb-12">
          <button onClick={() => performAction(generate_quests, state.location, state)}>
            刷新任务列表
          </button>
        </div>
        {locationQuests.length === 0 ? (
          <div className="text-muted text-sm">
            {loc?.type === "town" ? "此城镇暂无可用任务，点击刷新生成" : "只有城镇才有任务可接"}
          </div>
        ) : (
          locationQuests.map((quest: any) => (
            <div key={quest.id} className="list-item" style={quest.is_chain ? { borderLeft: "3px solid var(--accent-gold)", paddingLeft: 10 } : undefined}>
              <div className="flex-col gap-4">
                <span className="text-bold">{quest.desc}</span>
                {quest.is_chain && (
                  <span className="text-sm" style={{ color: "var(--accent-gold)" }}>故事线任务</span>
                )}
                <div className="flex-row gap-8">
                  <span className="text-sm text-gold flex-row gap-4">
                    <Coins size={14} /> {quest.reward_cash}金
                  </span>
                  <span className="text-sm text-gold flex-row gap-4">
                    <Star size={14} /> {quest.reward_renown}声望
                  </span>
                </div>
              </div>
              <button onClick={() => performAction(accept_quest, quest.id)}>
                接取任务
              </button>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <div className="panel-title"><Circle size={22} /> 进行中任务</div>
        {activeQuests.length === 0 ? (
          <div className="text-muted text-sm">没有进行中的任务</div>
        ) : (
          activeQuests.map((quest: any) => (
            <div key={quest.id} className="list-item">
              <div className="flex-col gap-4">
                <span className="text-bold">{quest.desc}</span>
                {quest.is_chain && (
                  <span className="text-sm" style={{ color: "var(--accent-gold)" }}>故事线任务</span>
                )}
                <div className="flex-row gap-8">
                  {quest.target_count && (
                    <span className="text-sm text-muted">
                      进度: {quest.current_count ?? 0} / {quest.target_count}
                    </span>
                  )}
                  <span className="text-sm text-gold">{quest.reward_cash}金 + {quest.reward_renown}声望</span>
                </div>
              </div>
              <button className="primary" onClick={() => performAction(complete_quest, quest.id)}>
                完成任务
              </button>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <div className="panel-title"><CheckCircle size={22} /> 已完成任务</div>
        {completedQuests.length === 0 ? (
          <div className="text-muted text-sm">尚未完成任何任务</div>
        ) : (
          <div className="text-sm text-muted">
            已完成 {completedQuests.length} 个任务
          </div>
        )}
      </div>
    </div>
  );
}
