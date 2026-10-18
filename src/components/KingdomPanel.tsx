import { useState } from "react";
import type { GameState } from "../core/state";
import { LOCATIONS, FACTIONS, POLICIES, COMPANIONS } from "../core/data";
import { declare_kingdom, assign_lord, set_policy, conquer_location, swear_fealty, renounce_fealty, declare_war, make_peace, respond_to_call } from "../core/engine";
import { Crown, Castle, Flag, Settings } from "lucide-react";

interface KingdomPanelProps {
  state: GameState;
  performAction: (action: (...args: any[]) => any, ...args: any[]) => any;
}

export function KingdomPanel({ state, performAction }: KingdomPanelProps) {
  const [kingdomName, setKingdomName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  if (!state.is_king && !showCreate) {
    const canDeclare = state.renown >= 500 && state.fiefs.length >= 1;
    const KINGDOM_IDS = ["empire_n", "empire_w", "empire_s", "sturgia", "aserai", "vlandia", "battania", "khuzait"];
    const vassalInfo = state.vassal_of ? FACTIONS[state.vassal_of] : null;
    return (
      <div>
        <div className="panel">
          <div className="panel-title"><Flag size={22} /> 效忠王国</div>
          {vassalInfo ? (
            <div className="flex-col gap-8">
              <div className="text-sm">
                当前效忠: <span className="text-gold text-bold">{vassalInfo.name}</span>
              </div>
              <div className="text-sm text-secondary">
                作为封臣攻击该国敌国部队将获得声望，攻击友军则会关系下降。
              </div>
              <div className="text-sm mt-12 mb-8">
                <span className="text-gold text-bold">⚔ 响应号召</span>
                <span className="text-muted"> 与己方王国敌对的国家，可响应号召打一场</span>
              </div>
              {Object.values(FACTIONS).filter((f: any) => {
                if (!state.vassal_of) return false;
                const rel = FACTIONS[state.vassal_of]?.relations?.[f.id] ?? 0;
                return f.id !== state.vassal_of && rel < 0;
              }).map((f: any) => (
                <div key={f.id} className="list-item">
                  <span className="text-bold" style={{ color: f.color === "blue" ? "var(--faction-blue)" : f.color === "green" ? "var(--faction-green)" : f.color === "red" ? "var(--faction-red)" : f.color === "brown" ? "var(--faction-brown)" : "var(--faction-purple)" }}>{f.name}</span>
                  <span className="text-sm text-muted">敌国</span>
                  <button onClick={() => performAction(respond_to_call, f.id)}>迎战</button>
                </div>
              ))}
              <button className="danger mt-12" onClick={() => performAction(renounce_fealty)}>
                叛变脱离
              </button>
            </div>
          ) : (
            <div className="flex-col gap-8">
              <p className="text-sm text-secondary mb-8">
                向八王国之一宣誓效忠，成为其封臣，参与王国战争。
              </p>
              {KINGDOM_IDS.map(kid => {
                const f = FACTIONS[kid];
                if (!f) return null;
                const rel = state.faction_relations?.[kid] ?? 0;
                return (
                  <div key={kid} className="list-item">
                    <span className="text-bold" style={{ color: f.color === "blue" ? "var(--faction-blue)" : f.color === "green" ? "var(--faction-green)" : f.color === "red" ? "var(--faction-red)" : f.color === "brown" ? "var(--faction-brown)" : "var(--faction-purple)" }}>{f.name}</span>
                    <span className="text-sm text-muted">好感 {rel > 0 ? `+${rel}` : rel}</span>
                    <button
                      className={rel >= 100 ? "primary" : ""}
                      disabled={state.renown < 100}
                      onClick={() => performAction(swear_fealty, kid)}
                    >
                      效忠
                    </button>
                  </div>
                );
              })}
              {state.renown < 100 && (
                <div className="text-sm text-red">声望达到 100 方可效忠，当前 {state.renown}</div>
              )}
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel-title"><Crown size={22} /> 建国</div>
          <p className="text-sm text-secondary mb-12">
            声望达到 500 且拥有至少 1 块封地方可宣告建国。
          </p>
          <div className="text-sm mb-8">
            当前声望: <span className={state.renown >= 500 ? "text-green" : "text-red"}>{state.renown} / 500</span><br />
            当前封地: <span className={state.fiefs.length >= 1 ? "text-green" : "text-red"}>{state.fiefs.length} / 1</span>
          </div>
          <button
            className="primary"
            disabled={!canDeclare || !!state.vassal_of}
            onClick={() => setShowCreate(true)}
          >
            宣告建国
          </button>
          {state.vassal_of && <div className="text-sm text-muted mt-8">已效忠王国，需先叛变才能建国。</div>}
        </div>
      </div>
    );
  }

  if (!state.is_king && showCreate) {
    return (
      <div className="panel">
        <div className="panel-title"><Crown size={22} /> 命名你的王国</div>
        <div className="flex-col gap-8 mb-12">
          <input
            type="text"
            placeholder="输入王国名称"
            value={kingdomName}
            onChange={e => setKingdomName(e.target.value)}
            style={{ width: "100%" }}
          />
          <div className="flex-row gap-8">
            <button onClick={() => setShowCreate(false)}>取消</button>
            <button
              className="primary"
              disabled={!kingdomName.trim()}
              onClick={() => performAction(declare_kingdom, kingdomName.trim())}
            >
              确认建国
            </button>
          </div>
        </div>
      </div>
    );
  }

  const ownedFiefs = state.fiefs.map((fId: string) => LOCATIONS[fId]).filter(Boolean);
  const unassignedFiefs = ownedFiefs.filter((l: any) => !state.lords?.some((lord: any) => lord.location === l.id));
  const companions = state.companions.map((cId: string) => COMPANIONS[cId]).filter(Boolean);

  return (
    <div>
      <div className="panel">
        <div className="panel-title"><Crown size={22} /> {state.kingdom_name}</div>
        <div className="text-sm text-secondary">
          国王: 你<br />
          封地: {state.fiefs.length}<br />
          封臣: {state.lords?.length ?? 0}<br />
          当前政策: {state.current_policy ? POLICIES[state.current_policy]?.name ?? state.current_policy : "无"}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title"><Flag size={22} /> 外交（宣战/停战）</div>
        <p className="text-sm text-muted mb-12">对八王国宣战或停战，宣战后该国成为敌国（好感 -50），可率军攻打其领地</p>
        {Object.values(FACTIONS).map((f: any) => {
          if (!f.id.startsWith("empire_") && !["sturgia", "aserai", "vlandia", "battania", "khuzait"].includes(f.id)) return null;
          const rel = state.faction_relations?.[f.id] ?? 0;
          const atWar = rel < 0;
          return (
            <div key={f.id} className="list-item">
              <span className="text-bold" style={{ color: f.color === "blue" ? "var(--faction-blue)" : f.color === "green" ? "var(--faction-green)" : f.color === "red" ? "var(--faction-red)" : f.color === "brown" ? "var(--faction-brown)" : "var(--faction-purple)" }}>{f.name}</span>
              <span className={"text-sm " + (atWar ? "text-red" : "text-muted")}>{atWar ? `⚔ 交战 (${rel})` : `和平 (${rel > 0 ? `+${rel}` : rel})`}</span>
              <button
                className={atWar ? "" : "danger"}
                onClick={() => performAction(atWar ? make_peace : declare_war, f.id)}
              >
                {atWar ? "停战" : "宣战"}
              </button>
            </div>
          );
        })}
      </div>
      <div className="panel">
        <div className="panel-title"><Settings size={22} /> 政策设置</div>
        {Object.values(POLICIES).map((policy: any) => (
          <div key={policy.id} className="list-item">
            <div className="flex-col gap-4">
              <span className="text-bold">{policy.name}</span>
              <span className="text-sm text-muted">{policy.effect}</span>
            </div>
            <button
              className={state.current_policy === policy.id ? "primary" : ""}
              onClick={() => performAction(set_policy, policy.id)}
            >
              {state.current_policy === policy.id ? "当前" : "实施"}
            </button>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-title"><Castle size={22} /> 封地管理</div>
        {ownedFiefs.length === 0 ? (
          <div className="text-muted text-sm">尚无封地</div>
        ) : (
          ownedFiefs.map((fief: any) => {
            const assignedLord = state.lords?.find((l: any) => l.location === fief.id);
            return (
              <div key={fief.id} className="list-item">
                <div className="flex-col gap-4">
                  <span className="text-bold">{fief.name}</span>
                  <span className="text-sm text-muted">
                    税收: {fief.tax_income}金/天 | 阵营: {FACTIONS[fief.faction_id]?.name}
                  </span>
                  {assignedLord && <span className="text-sm text-gold">封臣: {assignedLord.name}</span>}
                </div>
                {!assignedLord && companions.length > 0 && (
                  <select
                    style={{ background: "var(--bg-darkest)", color: "var(--text-primary)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)" }}
                    onChange={e => {
                      if (e.target.value) performAction(assign_lord, e.target.value, fief.id);
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>任命封臣</option>
                    {companions.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="panel">
        <div className="panel-title"><Flag size={22} /> 征服领土</div>
        <p className="text-sm text-muted mb-12">对邻近的敌对城镇发动征服</p>
        {Object.values(LOCATIONS).filter((l: any) => {
          const currentLoc = LOCATIONS[state.location];
          return currentLoc?.neighbors?.includes(l.id) && l.owner !== "player" && l.type === "town";
        }).map((target: any) => (
          <div key={target.id} className="list-item">
            <div className="flex-col gap-4">
              <span className="text-bold">{target.name}</span>
              <span className="text-sm text-muted">阵营: {FACTIONS[target.faction_id]?.name}</span>
            </div>
            <div className="flex-row gap-4">
              <button onClick={() => performAction(conquer_location, target.id, "attack")}>攻打</button>
              <button onClick={() => performAction(conquer_location, target.id, "negotiate")}>谈判</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
