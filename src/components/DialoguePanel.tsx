/**
 * DialoguePanel —— 与领主/同伴对话的弹窗。
 *
 * 显示 NPC 对玩家的反应（取决于身份/声望/关系），
 * 并提供按当前态度解锁的选项。
 */
import { greet, type PlayerIdentity } from "../core/dialogue";
import { LORDS_BANNERLORD, PERSONALITY_TRAIT } from "../core/lords_bannerlord";
import { COMPANIONS } from "../core/data";
import { releaseLord, ransomLord, executeLord } from "../core/lords_system";

interface Props {
  npcId: string;
  npcKind: "lord" | "companion";
  state: any;
  identity: PlayerIdentity;
  relation: number;
  onClose: () => void;
  performAction: (fn: (...a: any[]) => any, ...a: any[]) => any;
}

const TONE_COLOR: Record<string, string> = {
  friendly: "#7ec87e",
  neutral: "#c9c2b4",
  wary: "#d9a441",
  hostile: "#d9534f",
};

export function DialoguePanel({ npcId, npcKind, state, identity, relation, onClose, performAction }: Props) {
  const turn = greet(npcId, npcKind, identity, relation);
  const npcName = npcKind === "lord"
    ? `${LORDS_BANNERLORD[npcId]?.name ?? npcId}`
    : `${(COMPANIONS as any)[npcId]?.name ?? npcId}`;
  const npcTitle = npcKind === "lord" ? LORDS_BANNERLORD[npcId]?.title ?? "" : "";
  const personality = npcKind === "lord"
    ? PERSONALITY_TRAIT[LORDS_BANNERLORD[npcId]?.personality ?? "honorable"].label
    : (COMPANIONS as any)[npcId]?.personality ?? "";

  const isCaptive = npcKind === "lord" && state.lords_runtime?.[npcId]?.captive;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 210,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-panel, #1c1a17)", border: `1px solid ${TONE_COLOR[turn.tone]}`,
          borderRadius: 10, padding: 18, width: "min(560px, 94vw)", color: "#ddd",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <h3 style={{ margin: 0, color: "var(--accent-gold)" }}>
            {npcName}{npcTitle && <span style={{ color: "#888", fontSize: 13, marginLeft: 8 }}>{npcTitle}</span>}
          </h3>
          <span style={{ fontSize: 12, color: TONE_COLOR[turn.tone] }}>
            {turn.tone === "friendly" ? "友善" : turn.tone === "wary" ? "警惕" : turn.tone === "hostile" ? "敌对" : "平静"}
          </span>
        </div>
        {personality && <div style={{ fontSize: 11, color: "#778", marginBottom: 10 }}>性格：{personality}</div>}

        <div style={{
          padding: "12px 14px", borderRadius: 8, marginBottom: 14, lineHeight: 1.8, fontSize: 13,
          background: "rgba(255,255,255,0.04)", borderLeft: `3px solid ${TONE_COLOR[turn.tone]}`,
        }}>
          {turn.text}
        </div>

        {/* 俘虏处置 */}
        {isCaptive ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="wmc-btn" onClick={() => { performAction((s: any) => releaseLord(s, npcId)); onClose(); }}>释放</button>
            <button className="wmc-btn" onClick={() => { performAction((s: any) => ransomLord(s, npcId, 300)); onClose(); }}>索要赎金 300</button>
            <button className="wmc-btn wmc-btn-danger" onClick={() => { performAction((s: any) => executeLord(s, npcId)); onClose(); }}>处决</button>
          </div>
        ) : turn.tone === "hostile" ? (
          <div style={{ fontSize: 12, color: "#a88" }}>
            对方不愿与你多谈。改善关系需要放还俘虏、或提升声望。
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {turn.special === "errand" && (
              <button className="wmc-btn" onClick={() => {
                performAction((s: any) => {
                  s.add_log?.(`你接受了 ${npcName} 的委托。`);
                  return { message: `接受了 ${npcName} 的委托（任务系统接入中）` };
                });
              }}>接受差事</button>
            )}
            {turn.special === "discount" && (
              <button className="wmc-btn" onClick={() => {
                performAction((s: any) => {
                  const bonus = 50;
                  s.gold = (s.gold ?? 0) + bonus;
                  s.add_log?.(`${npcName} 赠给你 ${bonus} 金作为谢礼。`);
                  return { message: `${npcName} 赠给你 ${bonus} 金` };
                });
              }}>接受赠礼</button>
            )}
            <button className="wmc-btn wmc-btn-ghost" onClick={onClose}>告辞</button>
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 11, color: "#667" }}>
          你的身份：{identity.isKing ? "一国之君" : identity.kingdom ? "王国封臣" : "自由冒险者"} ·
          声望 {identity.renown} · 与对方好感 {relation > 0 ? `+${relation}` : relation}
        </div>
      </div>
    </div>
  );
}
