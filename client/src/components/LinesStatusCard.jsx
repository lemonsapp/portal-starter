import useOpStatus, { LINE_META, COUNTRY_LINES } from "../hooks/useOpStatus.js";

/**
 * Card grande del estado de líneas para el dashboard cliente.
 * Muestra cada línea (Normal/Express por país) con dot pulsante.
 */
export default function LinesStatusCard() {
  const { lines, notes, onLines, totalLines, updatedAt } = useOpStatus();

  const anyDelayed = Object.entries(notes || {}).some(([k, v]) => lines[k] && (v || "").trim());
  const overall = onLines === 0 ? "off" : (onLines === totalLines && !anyDelayed) ? "ok" : "warn";
  const overallColor = overall === "ok" ? "#22c55e" : overall === "off" ? "#ef4444" : "#fbbf24";
  const overallLabel = overall === "ok"
    ? "Todo en marcha"
    : overall === "off"
      ? "Todo pausado"
      : (onLines < totalLines && anyDelayed)
        ? "Parcial · con demoras"
        : anyDelayed
          ? "Con demoras"
          : "Parcial";

  return (
    <div style={{ background: "rgba(8,9,16,.85)", border: "1px solid rgba(245,224,58,.14)", borderRadius: 18, overflow: "hidden", position: "relative" }}>
      <style>{`
        @keyframes lscPulseG{0%,100%{box-shadow:0 0 8px #22c55e,0 0 16px rgba(34,197,94,.5)}50%{box-shadow:0 0 14px #22c55e,0 0 26px rgba(34,197,94,.7)}}
        @keyframes lscPulseR{0%,100%{box-shadow:0 0 8px #ef4444,0 0 16px rgba(239,68,68,.5)}50%{box-shadow:0 0 14px #ef4444,0 0 26px rgba(239,68,68,.7)}}
        @keyframes lscPulseW{0%,100%{box-shadow:0 0 8px #fbbf24,0 0 16px rgba(251,191,36,.5)}50%{box-shadow:0 0 14px #fbbf24,0 0 26px rgba(251,191,36,.7)}}
        @keyframes lscBar{from{background-position:0 0}to{background-position:200% 0}}
        .lsc-dot{width:11px;height:11px;border-radius:50%;flex-shrink:0;transition:all .3s}
        .lsc-dot.on{background:#22c55e;animation:lscPulseG 2s ease-in-out infinite}
        .lsc-dot.off{background:#ef4444;animation:lscPulseR 2s ease-in-out infinite}
        .lsc-dot.warn{background:#fbbf24;animation:lscPulseW 2s ease-in-out infinite}
        .lsc-svc{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-top:1px solid rgba(255,255,255,.025);transition:background .25s}
        .lsc-svc:hover{background:rgba(255,255,255,.02)}
      `}</style>

      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#f5e03a,#ff5500,#f5e03a,transparent)", backgroundSize: "200% 100%", animation: "lscBar 3s linear infinite" }} />

      {/* Header */}
      <div style={{ padding: "18px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid rgba(255,255,255,.05)" }}>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", color: "#f5e03a", fontWeight: 600, marginBottom: 6 }}>
            ⚡ Estado en vivo
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 1.2, color: "#fff", lineHeight: 1 }}>
            Líneas operativas
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", background: `${overallColor}1a`, border: `1px solid ${overallColor}55`, borderRadius: 999 }}>
            <span className={`lsc-dot ${overall === "ok" ? "on" : overall === "off" ? "off" : "warn"}`} style={{ width: 8, height: 8 }} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1.5, fontWeight: 700, color: overallColor, textTransform: "uppercase" }}>
              {overallLabel}
            </span>
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "#fff", lineHeight: 1, letterSpacing: 1 }}>
            {onLines}<span style={{ color: "rgba(255,255,255,.3)" }}>/{totalLines}</span>
          </div>
        </div>
      </div>

      {/* Países */}
      {Object.entries(COUNTRY_LINES).map(([country, keys], idx) => {
        const anyOn = keys.some(k => lines[k]);
        const allOff = keys.every(k => !lines[k]);
        return (
          <div key={country} style={{ borderBottom: idx < 2 ? "1px solid rgba(255,255,255,.04)" : "none", background: allOff ? "rgba(239,68,68,.025)" : "transparent" }}>
            <div style={{ padding: "14px 20px 6px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 26, lineHeight: 1, filter: "drop-shadow(0 1px 4px rgba(0,0,0,.5))" }}>{LINE_META[keys[0]].flag}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1.2, color: "#fff", lineHeight: 1 }}>{LINE_META[keys[0]].countryName}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1.5, color: "rgba(255,255,255,.35)", marginTop: 4 }}>
                  {keys.filter(k => lines[k]).length}/{keys.length} líneas activas
                </div>
              </div>
              <span className={`lsc-dot ${anyOn ? "on" : "off"}`} />
            </div>
            <div>
              {keys.map(k => {
                const meta = LINE_META[k];
                const on = !!lines[k];
                const note = (notes?.[k] || "").trim();
                const stateColor = on ? (note ? "#fbbf24" : "#22c55e") : "#f87171";
                return (
                  <div key={k} className="lsc-svc">
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: 1.4, padding: "3px 9px", color: meta.express ? "#ff8c2a" : "#f5e03a", background: meta.express ? "rgba(255,140,42,.08)" : "rgba(245,224,58,.08)", border: `1px solid ${meta.express ? "rgba(255,140,42,.22)" : "rgba(245,224,58,.22)"}`, borderRadius: 4, textTransform: "uppercase", flexShrink: 0 }}>
                        {meta.svc}{meta.express ? " ⚡" : ""}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, flexShrink: 0 }}>{meta.eta}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0, minWidth: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: stateColor, fontFamily: "'DM Mono', monospace", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {on && note ? `⏱ ${note}` : (on ? "Operando" : "Pausado")}
                      </span>
                      <span className={`lsc-dot ${on ? (note ? "warn" : "on") : "off"}`} style={{ width: 9, height: 9 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 9, fontFamily: "'DM Mono', monospace", letterSpacing: 1.4, color: "rgba(255,255,255,.3)", borderTop: "1px solid rgba(255,255,255,.05)" }}>
        <span>{updatedAt ? `Actualizado · ${new Date(updatedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : "Cargando…"}</span>
        <a href="https://wa.me/5491157479346?text=Hola!%20Quiero%20consultar%20estado%20de%20l%C3%ADneas" target="_blank" rel="noreferrer"
          style={{ color: "#f5e03a", textDecoration: "none", fontWeight: 700, letterSpacing: 1.5 }}>
          Consultar →
        </a>
      </div>
    </div>
  );
}
