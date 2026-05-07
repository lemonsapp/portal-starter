import { useEffect, useRef, useState } from "react";
import useOpStatus, { LINE_META, COUNTRY_LINES } from "../hooks/useOpStatus.js";

/**
 * Botón ícono integrado al Topbar (mismo formato que la campana de notificaciones).
 * Globo SVG centrado + corner dot con el estado general. Click abre popover detallado.
 */
export default function LinesStatusWidget() {
  const { lines, notes, onLines, totalLines, updatedAt } = useOpStatus();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);

  const anyDelayed = Object.entries(notes || {}).some(([k, v]) => lines[k] && (v || "").trim());
  const overall = onLines === 0 ? "off" : (onLines === totalLines && !anyDelayed) ? "ok" : "warn";
  const overallColor = overall === "ok" ? "#22c55e" : overall === "off" ? "#ef4444" : "#fbbf24";
  const overallLabel = overall === "ok"
    ? "Todo en marcha"
    : overall === "off"
      ? "Todo pausado"
      : (onLines < totalLines && anyDelayed)
        ? "Parcial · demoras"
        : anyDelayed
          ? "Con demoras"
          : "Parcial";

  return (
    <div ref={ref} style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <style>{`
        @keyframes lwPulseG{0%,100%{box-shadow:0 0 6px #22c55e,0 0 12px rgba(34,197,94,.55)}50%{box-shadow:0 0 10px #22c55e,0 0 18px rgba(34,197,94,.85)}}
        @keyframes lwPulseR{0%,100%{box-shadow:0 0 6px #ef4444,0 0 12px rgba(239,68,68,.55)}50%{box-shadow:0 0 10px #ef4444,0 0 18px rgba(239,68,68,.85)}}
        @keyframes lwPulseW{0%,100%{box-shadow:0 0 6px #fbbf24,0 0 12px rgba(251,191,36,.55)}50%{box-shadow:0 0 10px #fbbf24,0 0 18px rgba(251,191,36,.85)}}
        @keyframes lwBar{from{background-position:0 0}to{background-position:200% 0}}
        @keyframes lwPopIn{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes lwSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}

        .lw-btn{
          position:relative;
          width:40px;height:40px;
          border-radius:12px;
          background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.08);
          cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          transition:all .25s ease;
          padding:0;
          color:rgba(237,233,224,.78);
        }
        .lw-btn::after{
          content:'';position:absolute;inset:-1px;border-radius:12px;pointer-events:none;
          border:1px solid var(--ring,transparent);
          opacity:.55;transition:opacity .3s;
        }
        .lw-btn:hover{
          background:rgba(245,224,58,.06);
          border-color:rgba(245,224,58,.22);
          color:#f5e03a;
        }
        .lw-btn:hover .lw-globe{animation:lwSpin 8s linear infinite}
        .lw-btn.is-open{
          background:rgba(245,224,58,.08);
          border-color:rgba(245,224,58,.4);
          color:#f5e03a;
        }
        .lw-globe{display:block}

        .lw-corner{
          position:absolute;bottom:-2px;right:-2px;
          width:12px;height:12px;border-radius:50%;
          border:2px solid var(--tb-bg, #020307);
        }
        .lw-corner.on{background:#22c55e;animation:lwPulseG 2s ease-in-out infinite}
        .lw-corner.off{background:#ef4444;animation:lwPulseR 2s ease-in-out infinite}
        .lw-corner.warn{background:#fbbf24;animation:lwPulseW 2s ease-in-out infinite}

        .lw-tip{
          position:absolute;top:calc(100% + 6px);right:0;
          background:rgba(8,9,16,.96);border:1px solid rgba(245,224,58,.18);
          padding:6px 10px;border-radius:6px;
          font-family:'DM Mono',monospace;font-size:9.5px;letter-spacing:1.2px;
          color:rgba(255,255,255,.85);white-space:nowrap;font-weight:600;
          opacity:0;pointer-events:none;transition:opacity .2s;
          box-shadow:0 8px 22px rgba(0,0,0,.5);
        }
        .lw-btn:hover ~ .lw-tip{opacity:1}

        .lw-pop{
          position:absolute;right:0;top:calc(100% + 10px);
          width:320px;
          background:rgba(8,9,16,.98);
          backdrop-filter:blur(22px) saturate(1.3);
          -webkit-backdrop-filter:blur(22px) saturate(1.3);
          border:1px solid rgba(245,224,58,.18);
          border-radius:14px;overflow:hidden;
          z-index:9999;
          box-shadow:0 24px 64px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.02) inset;
          animation:lwPopIn .3s cubic-bezier(.34,1.56,.64,1);
        }
        .lw-pop::before{
          content:'';position:absolute;top:0;left:0;right:0;height:2px;
          background:linear-gradient(90deg,transparent,#f5e03a,#ff5500,#f5e03a,transparent);
          background-size:200% 100%;animation:lwBar 3s linear infinite;
        }

        .lw-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;transition:all .3s}
        .lw-dot.on{background:#22c55e;animation:lwPulseG 2s ease-in-out infinite}
        .lw-dot.off{background:#ef4444;animation:lwPulseR 2s ease-in-out infinite}
        .lw-dot.warn{background:#fbbf24;animation:lwPulseW 2s ease-in-out infinite}

        .lw-country{
          padding:11px 16px;
          border-bottom:1px solid rgba(255,255,255,.04);
        }
        .lw-country.off-all{background:rgba(239,68,68,.025)}

        @media (max-width:768px){
          .lw-btn{width:36px;height:36px;border-radius:10px}
        }
      `}</style>

      <button
        className={`lw-btn ${open ? "is-open" : ""}`}
        style={{ "--ring": overall === "ok" ? "rgba(34,197,94,.0)" : overall === "off" ? "rgba(239,68,68,.32)" : "rgba(251,191,36,.28)" }}
        onClick={() => setOpen(o => !o)}
        title={`${overallLabel} · ${onLines}/${totalLines}`}
        aria-label={`Estado de líneas: ${overallLabel}`}
        aria-expanded={open}
      >
        <svg className="lw-globe" viewBox="0 0 24 24" width="19" height="19" fill="none">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.4" />
          <ellipse cx="12" cy="12" rx="8.5" ry="3.4" stroke="currentColor" strokeWidth="1.1" opacity=".55" />
          <path d="M12 3.5 C 9 8 9 16 12 20.5" stroke="currentColor" strokeWidth="1.1" opacity=".55" fill="none" />
          <path d="M12 3.5 C 15 8 15 16 12 20.5" stroke="currentColor" strokeWidth="1.1" opacity=".55" fill="none" />
        </svg>
        <span className={`lw-corner ${overall === "ok" ? "on" : overall === "off" ? "off" : "warn"}`} />
      </button>

      {open && (
        <div className="lw-pop">
          {/* Header */}
          <div style={{ padding: "13px 16px 12px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.2, color: "#fff", lineHeight: 1 }}>
                Líneas operativas
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1.5, color: "rgba(255,255,255,.4)", marginTop: 5, fontWeight: 500 }}>
                {updatedAt ? `Actualizado · ${new Date(updatedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : "En vivo"}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", background: `${overallColor}1a`, border: `1px solid ${overallColor}55`, borderRadius: 999 }}>
                <span className={`lw-dot ${overall === "ok" ? "on" : overall === "off" ? "off" : "warn"}`} style={{ width: 6, height: 6 }} />
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8.5, letterSpacing: 1.4, fontWeight: 700, color: overallColor, textTransform: "uppercase" }}>
                  {overallLabel}
                </span>
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "#fff", letterSpacing: 1, lineHeight: 1 }}>
                {onLines}<span style={{ color: "rgba(255,255,255,.3)" }}>/{totalLines}</span>
              </div>
            </div>
          </div>

          {/* Países */}
          {Object.entries(COUNTRY_LINES).map(([country, keys]) => {
            const anyOn = keys.some(k => lines[k]);
            const allOff = keys.every(k => !lines[k]);
            return (
              <div key={country} className={`lw-country ${allOff ? "off-all" : ""}`}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 18, lineHeight: 1, filter: "drop-shadow(0 1px 4px rgba(0,0,0,.4))" }}>{LINE_META[keys[0]].flag}</span>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1, color: "#fff", flex: 1, lineHeight: 1 }}>
                    {LINE_META[keys[0]].countryName}
                  </span>
                  <span className={`lw-dot ${anyOn ? "on" : "off"}`} style={{ width: 9, height: 9 }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 28 }}>
                  {keys.map(k => {
                    const meta = LINE_META[k];
                    const on = !!lines[k];
                    const note = (notes?.[k] || "").trim();
                    const stateColor = on ? (note ? "#fbbf24" : "#22c55e") : "#f87171";
                    const stateLabel = on ? (note || "Operando") : "Pausado";
                    return (
                      <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: 1.2, padding: "2px 7px", color: meta.express ? "#ff8c2a" : "#f5e03a", background: meta.express ? "rgba(255,140,42,.08)" : "rgba(245,224,58,.08)", border: `1px solid ${meta.express ? "rgba(255,140,42,.22)" : "rgba(245,224,58,.22)"}`, borderRadius: 3, flexShrink: 0 }}>
                            {meta.svc}
                          </span>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,.4)", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                            {meta.eta}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, minWidth: 0 }}>
                          <span title={stateLabel} style={{ fontSize: 10, fontWeight: 700, color: stateColor, fontFamily: "'DM Mono', monospace", lineHeight: 1.2, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {on && note ? `⏱ ${stateLabel}` : stateLabel}
                          </span>
                          <span className={`lw-dot ${on ? (note ? "warn" : "on") : "off"}`} style={{ width: 7, height: 7 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={{ padding: "9px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 9, fontFamily: "'DM Mono', monospace", letterSpacing: 1.3 }}>
            <span style={{ color: "rgba(255,255,255,.3)" }}>Estado en tiempo real</span>
            <a href="https://wa.me/5491157479346?text=Hola!%20Quiero%20consultar%20estado%20de%20l%C3%ADneas"
              target="_blank" rel="noreferrer"
              style={{ color: "#f5e03a", textDecoration: "none", fontWeight: 700, letterSpacing: 1.5 }}>
              Consultar →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
