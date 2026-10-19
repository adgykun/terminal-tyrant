/**
 * CaravanTradePanel —— 大地图商队交易界面。
 *
 * 展示该商队当日现货与买卖价，玩家可就地低买高卖。
 * 价格每天变动，不同商队价格不同 —— 这就是跑商套利的来源。
 */
import { useMemo, useState } from "react";
import { caravanOffer, caravanTrade } from "../core/caravan";
import { GOODS } from "../core/data";

interface Props {
  unitId: string;
  unitName: string;
  state: any;
  onClose: () => void;
  onDone: () => void;
}

export function CaravanTradePanel({ unitId, unitName, state, onClose, onDone }: Props) {
  const day = state.day ?? 1;
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [, force] = useState(0);

  const offers = useMemo(() => caravanOffer(unitId, day), [unitId, day]);
  const gold = state.gold ?? 0;
  const inv: Record<string, number> = state.inventory ?? {};

  const doTrade = (action: "buy" | "sell", goodsId: string) => {
    const r = caravanTrade(state, unitId, action, goodsId, qty);
    setMsg(r.message);
    force((x) => x + 1);
    onDone();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-panel, #1c1a17)", border: "1px solid #4a4034",
          borderRadius: 10, padding: 18, width: "min(620px, 94vw)",
          maxHeight: "86vh", overflowY: "auto", color: "#ddd",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <h3 style={{ margin: 0, color: "var(--accent-gold)" }}>与{unitName}交易</h3>
          <span style={{ fontSize: 12, color: "#999" }}>第 {day} 天 · 随身 {gold} 金</span>
        </div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
          商队价格每日浮动，与城镇行情不同。低价买入、异地卖出即可获利。
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 12 }}>交易数量</span>
          {[1, 5, 10, 25].map((n) => (
            <button
              key={n}
              className={qty === n ? "wmc-btn" : "wmc-btn wmc-btn-ghost"}
              onClick={() => setQty(n)}
            >
              {n}
            </button>
          ))}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "#888", borderBottom: "1px solid #3a3329", textAlign: "left" }}>
              <th style={{ padding: "5px 3px" }}>货物</th>
              <th style={{ textAlign: "right" }}>商队存货</th>
              <th style={{ textAlign: "right" }}>买价</th>
              <th style={{ textAlign: "right" }}>卖价</th>
              <th style={{ textAlign: "right" }}>你持有</th>
              <th style={{ textAlign: "center" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.goodsId} style={{ borderBottom: "1px solid #2a251e" }}>
                <td style={{ padding: "5px 3px" }}>{o.name}</td>
                <td style={{ textAlign: "right", color: "#9ab" }}>{o.count}</td>
                <td style={{ textAlign: "right", color: "#d9534f" }}>{o.buy}</td>
                <td style={{ textAlign: "right", color: "#5cb85c" }}>{o.sell}</td>
                <td style={{ textAlign: "right" }}>{inv[o.goodsId] ?? 0}</td>
                <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                  <button
                    className="wmc-btn"
                    disabled={gold < o.buy}
                    onClick={() => doTrade("buy", o.goodsId)}
                  >买入</button>
                  <button
                    className="wmc-btn wmc-btn-ghost"
                    disabled={(inv[o.goodsId] ?? 0) <= 0}
                    onClick={() => doTrade("sell", o.goodsId)}
                  >卖出</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {msg && (
          <div style={{
            marginTop: 12, padding: "8px 10px", borderRadius: 6, fontSize: 12,
            background: "rgba(90,140,90,0.15)", border: "1px solid rgba(110,170,110,0.35)",
          }}>{msg}</div>
        )}

        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="wmc-btn wmc-btn-ghost" onClick={onClose}>离开</button>
        </div>
      </div>
    </div>
  );
}
