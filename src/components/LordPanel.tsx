/**
 * LordPanel —— 领主名录与处置界面。
 *
 * 展示八王国全部具名领主：所在国、性格、当前兵力、与你的好感、是否被俘。
 * 对俘虏可释放 / 索要赎金 / 处决（影响该国全体领主好感）。
 */
import { useMemo } from "react";
import { FACTIONS } from "../core/data";
import { LORDS_BANNERLORD, PERSONALITY_TRAIT } from "../core/lords_bannerlord";
import {
  ensureLords,
  lordTroopCount,
  lordPower,
  releaseLord,
  executeLord,
  ransomLord,
} from "../core/lords_system";
import type { GameState } from "../core/state";

interface LordPanelProps {
  state: GameState;
  performAction: (fn: (...args: any[]) => any, ...args: any[]) => any;
  /** 点击某位领主 → 打开对话面板。 */
  onTalk?: (lordId: string) => void;
}

export function LordPanel({ state, performAction, onTalk }: LordPanelProps) {
  const rt = ensureLords(state);

  const rows = useMemo(() => {
    return Object.values(LORDS_BANNERLORD)
      .map((lord) => ({ lord, ls: rt[lord.id] }))
      .filter((x) => x.ls && !x.ls.dead)
      .sort((a, b) => {
        // 俘虏置顶，其次按王国
        if (a.ls!.captive !== b.ls!.captive) return a.ls!.captive ? -1 : 1;
        return a.lord.kingdom.localeCompare(b.lord.kingdom);
      });
  }, [rt]);

  const captives = rows.filter((r) => r.ls!.captive);

  return (
    <div style={{ padding: 16, overflowY: "auto", height: "100%" }}>
      <h2 style={{ marginBottom: 4 }}>领主名录</h2>
      <div style={{ color: "#999", fontSize: 12, marginBottom: 14 }}>
        共 {rows.length} 位在世领主{captives.length > 0 && `，其中 ${captives.length} 位被俘`}
      </div>

      {captives.length > 0 && (
        <div style={{
          marginBottom: 16, padding: 12, borderRadius: 8,
          background: "rgba(180,120,40,0.12)", border: "1px solid rgba(200,150,60,0.35)",
        }}>
          <div style={{ color: "var(--accent-gold)", marginBottom: 8, fontSize: 13 }}>你的俘虏</div>
          {captives.map(({ lord, ls }) => (
            <div key={lord.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 200px" }}>{lord.name} · {lord.title}</span>
              <button className="wmc-btn" onClick={() => performAction((s: any) => releaseLord(s, lord.id))}>释放</button>
              <button className="wmc-btn" onClick={() => performAction((s: any) => ransomLord(s, lord.id, 300))}>赎金 300</button>
              <button className="wmc-btn wmc-btn-danger" onClick={() => performAction((s: any) => executeLord(s, lord.id))}>处决</button>
            </div>
          ))}
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ color: "#888", textAlign: "left", borderBottom: "1px solid #333" }}>
            <th style={{ padding: "6px 4px" }}>领主</th>
            <th>王国</th>
            <th>性格</th>
            <th style={{ textAlign: "right" }}>兵力</th>
            <th style={{ textAlign: "right" }}>战力</th>
            <th style={{ textAlign: "right" }}>好感</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ lord, ls }) => {
            const f = FACTIONS[lord.kingdom];
            const rel = ls!.relationWithPlayer;
            const relColor = rel > 20 ? "#5cb85c" : rel < -20 ? "#d9534f" : "#aaa";
            return (
              <tr key={lord.id} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "6px 4px" }}>
                  {lord.isRuler && <span style={{ color: "#d9a441", marginRight: 4 }}>♛</span>}
                  {onTalk ? (
                    <span
                      onClick={() => onTalk(lord.id)}
                      style={{ cursor: "pointer", borderBottom: "1px dotted #888" }}
                      title="交谈"
                    >
                      {lord.name}
                    </span>
                  ) : lord.name}
                </td>
                <td style={{ color: "#9ab" }}>{f?.name ?? lord.kingdom}</td>
                <td>{PERSONALITY_TRAIT[lord.personality].label}</td>
                <td style={{ textAlign: "right" }}>{lordTroopCount(ls)}</td>
                <td style={{ textAlign: "right" }}>{lordPower(ls)}</td>
                <td style={{ textAlign: "right", color: relColor }}>{rel > 0 ? `+${rel}` : rel}</td>
                <td style={{ color: ls!.captive ? "#d9a441" : "#666" }}>{ls!.captive ? "俘虏" : "自由"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 18, color: "#777", fontSize: 11, lineHeight: 1.7 }}>
        · 击败领主会降低其对你的好感，并有一定概率将其俘获。<br />
        · 释放俘虏可提升好感；处决会让其所在王国的所有领主永远憎恨你。<br />
        · 领主部队会随时间缓慢补充，被俘期间不会。
      </div>
    </div>
  );
}
