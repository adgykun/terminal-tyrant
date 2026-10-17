import { useEffect, useRef } from "react";
import { ScrollText } from "lucide-react";

interface LogPanelProps {
  logs: string[];
}

export function LogPanel({ logs }: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div style={{
      padding: "10px 20px 14px",
      background: "linear-gradient(180deg, var(--bg-darkest) 0%, var(--bg-void) 100%)",
      borderTop: "1px solid var(--border-color)",
      flexShrink: 0,
      position: "relative",
    }}>
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: "1px",
        background: "linear-gradient(90deg, transparent, var(--accent-gold-dark) 50%, transparent)",
        opacity: 0.4,
      }} />
      <div className="section-header" style={{ marginBottom: "8px", fontSize: "13px" }}>
        <ScrollText size={16} style={{ color: "var(--accent-gold-dark)" }} />
        事件日志
      </div>
      <div ref={scrollRef} className="log-container">
        {logs.length === 0 ? (
          <div className="text-muted text-sm">暂无日志记录……</div>
        ) : (
          logs.map((entry, idx) => (
            <div
              key={idx}
              className={`log-entry ${idx === logs.length - 1 ? "latest" : ""} ${
                entry.includes("战斗") || entry.includes("遭遇") || entry.includes("伤亡") ? "combat" : ""
              } ${entry.includes("获得") || entry.includes("奖励") || entry.includes("收入") ? "reward" : ""}`}
            >
              {entry}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
