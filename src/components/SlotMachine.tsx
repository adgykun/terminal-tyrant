import { useEffect, useRef, useState } from "react";
import { Bell, Cherry, Star } from "lucide-react";
import {
  spin_slots,
  SLOT_PAYOUTS,
  SLOT_NAMES,
} from "../core/engine";
import type { SlotSpinResult, SlotSymbol } from "../core/engine";
import { GAMBLER_MIN_BET } from "../core/data";

// 与 useGame 的 performAction 对齐（它会自动注入 state 作首参）
type PerformAction = (action: (state: any, ...args: any[]) => any, ...args: any[]) => any;

// 旋转动画用的装饰符号带
const DECOR: SlotSymbol[] = ["seven", "cherry", "bell", "star", "bar", "seven", "cherry", "bell", "star", "bar"];
// 三轴逐轴停的延迟（ms）
const STOP_DELAYS = [600, 950, 1300];
const QUICK_BETS = [GAMBLER_MIN_BET, 50, 100];
const PAYTABLE_ORDER: SlotSymbol[] = ["seven", "bar", "star", "bell", "cherry"];

function SymbolFace({ sym, active }: { sym: SlotSymbol; active?: boolean }) {
  const extra = active ? " slot-hit" : "";
  switch (sym) {
    case "seven": return <span className={"slot-face slot-seven" + extra}>7</span>;
    case "bar": return <span className={"slot-face slot-bar" + extra}>BAR</span>;
    case "cherry": return <Cherry size={38} className={"slot-icon slot-icon-cherry" + extra} />;
    case "bell": return <Bell size={38} className={"slot-icon slot-icon-bell" + extra} />;
    case "star": return <Star size={38} className={"slot-icon slot-icon-star" + extra} />;
  }
}

export default function SlotMachine({ cash, performAction }: { cash: number; performAction: PerformAction }) {
  const [bet, setBet] = useState<number>(QUICK_BETS[0]);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<SlotSymbol[]>(["cherry", "cherry", "cherry"]);
  const [lastResult, setLastResult] = useState<SlotSpinResult | null>(null);
  const [hitTick, setHitTick] = useState(false);
  const timers = useRef<number[]>([]);

  // 卸载时清理定时器，避免 setState 到已卸载组件
  useEffect(() => () => { timers.current.forEach((t) => clearTimeout(t)); }, []);

  const wager = Math.min(bet, cash);
  const canSpin = !spinning && wager >= GAMBLER_MIN_BET;

  const spin = () => {
    if (!canSpin) return;
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    setSpinning(true);
    setLastResult(null);
    setHitTick(false);
    // 先打乱显示
    setReels([
      DECOR[Math.floor(Math.random() * DECOR.length)],
      DECOR[Math.floor(Math.random() * DECOR.length)],
      DECOR[Math.floor(Math.random() * DECOR.length)],
    ]);
    // 同步拿到结果（spin_slots 立即返回），动画纯装饰
    const result = performAction(spin_slots, wager) as SlotSpinResult;
    if (!result || !result.symbols) {
      setSpinning(false);
      return;
    }
    const finalSym = result.symbols;
    finalSym.forEach((sym, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setReels((prev) => { const n = [...prev]; n[i] = sym; return n; });
          if (i === finalSym.length - 1) {
            setSpinning(false);
            setLastResult(result);
            if (result.result === "jackpot" || result.result === "win") {
              setHitTick(true);
              timers.current.push(window.setTimeout(() => setHitTick(false), 1800));
            }
          }
        }, STOP_DELAYS[i])
      );
    });
  };

  const isWin = !spinning && lastResult && (lastResult.result === "jackpot" || lastResult.result === "win");
  const maxBetVal = Math.max(GAMBLER_MIN_BET, cash);

  return (
    <div className={"slot-machine" + (isWin ? " slot-win" : "")}>
      <div className="slot-title">
        🎰 老虎机
        <span className="slot-sub">押 {wager} 金 · 庄家优势 ~9%</span>
      </div>

      <div className="slot-window">
        {reels.map((sym, i) => (
          <div key={i} className={"slot-reel" + (spinning ? " slot-spinning" : "")}>
            {spinning ? (
              <div className="slot-strip">
                {DECOR.map((s, k) => <SymbolFace key={k} sym={s} />)}
              </div>
            ) : (
              <div className="slot-center">
                <SymbolFace sym={sym} active={hitTick} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="slot-msg">
        {spinning ? "转轴中…" : lastResult ? lastResult.message : "拉杆试试手气？"}
      </div>

      <div className="slot-bets">
        {QUICK_BETS.map((b) => (
          <button key={b} className={"slot-bet" + (bet === b ? " active" : "")} onClick={() => setBet(b)} disabled={spinning}>
            {b}
          </button>
        ))}
        <button
          className={"slot-bet slot-max" + (bet === maxBetVal && cash > 0 ? " active" : "")}
          onClick={() => setBet(maxBetVal)}
          disabled={spinning || cash < GAMBLER_MIN_BET}
        >
          MAX {cash}
        </button>
      </div>

      <div className="slot-pull">
        <button className="primary slot-pull-btn" onClick={spin} disabled={!canSpin}>
          拉杆（-{wager} 金）
        </button>
      </div>

      <div className="slot-paytable">
        {PAYTABLE_ORDER.map((s) => (
          <span key={s} className="slot-pay">
            <span>{SLOT_NAMES[s]}×3 <b>{SLOT_PAYOUTS[s].triple}x</b></span>
            <span>两同 <b>{SLOT_PAYOUTS[s].pair > 0 ? SLOT_PAYOUTS[s].pair + "x" : "—"}</b></span>
          </span>
        ))}
      </div>
    </div>
  );
}