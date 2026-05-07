import { useEffect, useRef } from "react";

/**
 * Hero editorial-bold premium. Lenguaje del landing aplicado a páginas internas.
 *
 * Props:
 *  - eyebrow      string
 *  - title        string (parte normal)
 *  - em           string (parte resaltada en lemon)
 *  - watermark    string (texto gigante de fondo, parallax sutil)
 *  - meta         array de strings/nodos
 *  - actions      ReactNode
 *  - live         bool (dot verde "EN VIVO")
 *  - accent       "lemon" | "orange" (color del eyebrow)
 *  - kpis         array de { label, value, fmt? } — animated numbers en strip
 *  - compact      bool — versión más pequeña para headers de tools
 */
export default function EditorialHero({
  eyebrow,
  title,
  em,
  watermark,
  meta = [],
  actions,
  live = false,
  accent = "orange",
  kpis,
  compact = false,
}) {
  const titleRef = useRef(null);
  const wmRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.classList.add("eh-in"), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!wmRef.current || !rootRef.current) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = rootRef.current?.getBoundingClientRect();
        if (!r || !wmRef.current) return;
        const dy = window.innerHeight / 2 - (r.top + r.height / 2);
        wmRef.current.style.transform = `translate3d(0,${dy * 0.06}px,0)`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // Magnetic action buttons (works on any element with .eh-mag inside actions)
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    const els = root.querySelectorAll(".eh-mag, .eh-actions button, .eh-actions a");
    const handlers = [];
    els.forEach(el => {
      let rect;
      const onEnter = () => { rect = el.getBoundingClientRect(); };
      const onMove = (e) => {
        if (!rect) rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        el.style.transform = `translate(${x * 0.14}px, ${y * 0.18}px)`;
      };
      const onLeave = () => { el.style.transform = ""; rect = null; };
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
      handlers.push({ el, onEnter, onMove, onLeave });
    });
    return () => handlers.forEach(h => {
      h.el.removeEventListener("mouseenter", h.onEnter);
      h.el.removeEventListener("mousemove", h.onMove);
      h.el.removeEventListener("mouseleave", h.onLeave);
    });
  }, []);

  const accentColor = accent === "lemon" ? "var(--lemon)" : "var(--orange)";
  const padY = compact ? "20px 26px" : "28px 32px 26px";
  const titleSize = compact ? "clamp(36px,4.5vw,60px)" : "clamp(48px,6.6vw,92px)";

  return (
    <div ref={rootRef} className="eh-root">
      <style>{`
        .eh-root{position:relative;padding:${padY};margin:8px 0 28px;border:1px solid var(--border2);background:linear-gradient(135deg,var(--mid) 0%,var(--deep) 100%);overflow:hidden}
        .eh-root::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--lemon),var(--orange),var(--lemon));background-size:200% 100%;animation:eh-bar 3s linear infinite}
        @keyframes eh-bar{from{background-position:0 0}to{background-position:200% 0}}
        .eh-root::after{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(var(--brand-primary-rgb),.018) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--brand-primary-rgb),.018) 1px,transparent 1px);background-size:48px 48px;pointer-events:none;opacity:.7}
        .eh-watermark{position:absolute;right:-30px;bottom:-50px;font-family:'Bebas Neue',sans-serif;font-size:clamp(140px,18vw,260px);line-height:.78;letter-spacing:-6px;color:transparent;-webkit-text-stroke:1px rgba(var(--brand-primary-rgb),.04);pointer-events:none;user-select:none;will-change:transform}
        .eh-glow{position:absolute;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(var(--brand-primary-rgb),.05) 0%,transparent 70%);top:50%;left:-120px;transform:translateY(-50%);pointer-events:none;z-index:1}
        .eh-row{position:relative;z-index:2;display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap}
        .eh-left{flex:1;min-width:280px}
        .eh-eyebrow{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;display:flex;align-items:center;gap:12px;margin-bottom:14px;color:${accentColor}}
        .eh-eyebrow::before{content:'';width:28px;height:1px;background:${accentColor}}
        .eh-live{display:inline-flex;align-items:center;gap:7px;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:2px;color:#22c55e;padding:3px 10px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);margin-left:6px}
        .eh-live::before{content:'';width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e;animation:eh-pulse 2s ease infinite}
        @keyframes eh-pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes eh-rise{from{transform:translateY(110%)}to{transform:translateY(0)}}
        @keyframes eh-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .eh-title{font-family:'Bebas Neue',sans-serif;font-size:${titleSize};line-height:.84;letter-spacing:-1.5px;color:var(--text);margin:0;overflow:hidden}
        .eh-title em{font-style:normal;color:var(--lemon);position:relative}
        .eh-title em::after{content:'';position:absolute;left:0;right:0;bottom:6%;height:18%;background:rgba(var(--brand-primary-rgb),.12);z-index:-1;transform:scaleX(0);transform-origin:left;animation:eh-hl 1.1s cubic-bezier(.2,.8,.2,1) .8s forwards}
        @keyframes eh-hl{to{transform:scaleX(1)}}
        .eh-title-inner{display:inline-block;transform:translateY(110%)}
        .eh-in .eh-title-inner{animation:eh-rise .9s cubic-bezier(.2,.8,.2,1) forwards}
        .eh-meta{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--muted2);margin-top:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;opacity:0}
        .eh-in + .eh-meta{animation:eh-fade .8s ease .25s forwards}
        .eh-meta-sep{width:1px;height:12px;background:var(--border2);display:inline-block}
        .eh-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;opacity:0;animation:eh-fade .8s ease .35s forwards}
        .eh-actions > button,.eh-actions > a,.eh-actions .eh-mag{transition:transform .25s cubic-bezier(.34,1.56,.64,1)!important}
        .eh-kpis{margin-top:22px;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1px;background:var(--border2);border:1px solid var(--border2);position:relative;z-index:2;opacity:0;animation:eh-fade .8s ease .45s forwards}
        .eh-kpi{padding:14px 18px;background:rgba(11,13,24,.5);transition:background .3s}
        .eh-kpi:hover{background:rgba(var(--brand-primary-rgb),.025)}
        .eh-kpi-l{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted2);margin-bottom:6px}
        .eh-kpi-v{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:1px;color:var(--lemon);line-height:1}
      `}</style>
      {watermark && <div ref={wmRef} className="eh-watermark editorial-watermark" data-staff-watermark>{watermark}</div>}
      <div className="eh-glow" />
      <div className="eh-row">
        <div className="eh-left">
          {eyebrow && (
            <div className="eh-eyebrow">
              {eyebrow}
              {live && <span className="eh-live">EN VIVO</span>}
            </div>
          )}
          <h1 ref={titleRef} className="eh-title">
            <span className="eh-title-inner">
              {title}{em && <> <em>{em}</em></>}
            </span>
          </h1>
          {meta.length > 0 && (
            <div className="eh-meta">
              {meta.map((m, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  {i > 0 && <span className="eh-meta-sep" />}
                  <span>{m}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        {actions && <div className="eh-actions">{actions}</div>}
      </div>
      {Array.isArray(kpis) && kpis.length > 0 && (
        <div className="eh-kpis">
          {kpis.map((k, i) => (
            <div key={i} className="eh-kpi">
              <div className="eh-kpi-l">{k.label}</div>
              <div className="eh-kpi-v"><AnimNum value={k.value} fmt={k.fmt} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Counter animado con easing exponencial. fmt: "raw" | "usd" | "kg" | "compact" */
function AnimNum({ value, fmt = "raw", dur = 1100 }) {
  const ref = useRef(null);
  useEffect(() => {
    const target = Number(value) || 0;
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const v = target * e;
      if (ref.current) ref.current.textContent = format(v, fmt, p === 1 ? target : null);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, fmt, dur]);
  return <span ref={ref}>0</span>;
}

function format(v, fmt, finalVal) {
  const n = finalVal != null ? finalVal : v;
  if (fmt === "usd") return `$${Math.round(n).toLocaleString("es-AR")}`;
  if (fmt === "kg") return `${n.toFixed(1)} kg`;
  if (fmt === "compact") {
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return Math.round(n).toLocaleString("es-AR");
  }
  return Math.round(n).toLocaleString("es-AR");
}
