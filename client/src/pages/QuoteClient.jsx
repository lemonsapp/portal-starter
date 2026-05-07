import { useState, useEffect, useMemo } from "react";
import EditorialHero from "../components/EditorialHero.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const WA  = "5491157479346";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

const ORIGINS = [
  { key: "usa",    label: "🇺🇸 USA",    services: ["NORMAL","EXPRESS"] },
  { key: "china",  label: "🇨🇳 China",  services: ["NORMAL","EXPRESS"] },
  { key: "europa", label: "🇪🇺 Europa", services: ["NORMAL"] },
];

const SERVICE_LABELS = {
  NORMAL:   { label: "Normal",  desc: "Envío estándar",      color: "#f5e03a" },
  EXPRESS:  { label: "Express", desc: "Entrega prioritaria", color: "#f97316" },
};

function rateKey(origin, service) {
  return `${origin}_${service.toLowerCase()}`;
}

// Descuento por volumen (igual que backend)
function volumeDiscount(kg) {
  if (kg >= 100) return 7;
  if (kg >= 50)  return 5;
  if (kg >= 10)  return 3;
  return 0;
}

const fmtUsd = v => `$${Number(v||0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtArs = v => `$${Number(v||0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function QuoteClient() {
  const [rates, setRates]               = useState(null);
  const [fx, setFx]                     = useState(null);
  const [personalized, setPersonalized] = useState(false);
  const [origin, setOrigin]             = useState("usa");
  const [service, setService]           = useState("NORMAL");
  const [weight, setWeight]             = useState("");
  const [desc, setDesc]                 = useState("");

  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [submittedCode, setSubmittedCode] = useState("");
  const [error, setError]               = useState("");

  useEffect(() => {
    fetch(`${API}/quote/my-rates`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(d => {
        setRates(d.rates);
        setFx(d.fx_rate);
        setPersonalized(d.personalized || false);
      })
      .catch(() => {});
  }, []);

  const availableServices = useMemo(() =>
    ORIGINS.find(o => o.key === origin)?.services || ["NORMAL"],
  [origin]);

  useEffect(() => {
    if (!availableServices.includes(service)) setService(availableServices[0]);
  }, [origin]); // eslint-disable-line

  const w          = Math.max(parseFloat(weight) || 0, 0);
  const billable   = Math.max(w, 1);
  const baseRate   = rates ? Number(rates[rateKey(origin, service)] || 0) : 0;
  const discount   = volumeDiscount(billable);
  const rate       = Math.max(0, baseRate - discount);
  const totalUsd   = rate * billable;
  const totalArs   = fx ? totalUsd * fx : null;
  const hasResult  = w > 0 && rate > 0;

  async function submitRequest() {
    if (!w || !desc.trim()) return setError("Completá el peso y la descripción del producto.");
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`${API}/quote/request`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          origin, service: service.toUpperCase(),
          weight_kg: w,
          description: desc,
          estimated_usd: totalUsd,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Error al enviar la solicitud.");
      setSubmitted(true);
      setSubmittedCode(data.code || data.shipment?.code || "");
    } catch { setError("Error de red. Intentá de nuevo."); }
    finally { setSubmitting(false); }
  }

  if (submitted) return (
    <div style={{ minHeight: "100vh", background: "#080d1c", fontFamily: "'Inter','Segoe UI',sans-serif", color: "#fff" }}>
      <div style={{ maxWidth: 520, margin: "60px auto", padding: "0 20px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
        <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 10 }}>¡Solicitud enviada!</h2>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 15, marginBottom: 24 }}>
          Tu solicitud fue registrada. Nuestro equipo la va a revisar y te va a contactar pronto.
        </p>
        {submittedCode && (
          <div style={{
            background: "rgba(245,224,58,0.08)", border: "1px solid rgba(245,224,58,0.25)",
            borderRadius: 14, padding: "14px 20px", marginBottom: 24, display: "inline-block",
          }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginBottom: 4 }}>CÓDIGO DE SOLICITUD</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#f5e03a", letterSpacing: 2 }}>{submittedCode}</div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a href="/client/shipments" style={{
            display: "block", background: "linear-gradient(135deg,#f5e03a,#ff5500)",
            color: "#0b1020", fontWeight: 800, fontSize: 15, padding: "14px 24px",
            borderRadius: 14, textDecoration: "none",
          }}>Ver mis envíos →</a>
          <button onClick={() => { setSubmitted(false); setWeight(""); setDesc(""); }}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.65)", fontWeight: 700, fontSize: 14,
              padding: "13px 24px", borderRadius: 14, cursor: "pointer",
            }}>Calcular otro envío</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#080d1c", fontFamily: "'Inter','Segoe UI',sans-serif", color: "#fff" }}>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px 60px" }}>

        <EditorialHero
          eyebrow="Calculadora"
          title="COTIZÁ"
          em="TU ENVÍO"
          watermark="COTIZACIÓN"
          meta={[personalized ? "✨ Tarifas personalizadas activas" : "Tarifas estándar", "USA · China · Europa"]}
        />

        <QuickQuoteByLink />

        <div style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 24, padding: "26px 26px",
        }}>

          {/* Origen */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.40)", letterSpacing: 1, display: "block", marginBottom: 10 }}>
              ORIGEN
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              {ORIGINS.map(o => (
                <button key={o.key} onClick={() => setOrigin(o.key)} style={{
                  flex: 1, padding: "12px 8px", borderRadius: 14, border: "none", cursor: "pointer",
                  fontWeight: 700, fontSize: 13, transition: "all 0.15s",
                  background: origin === o.key ? "linear-gradient(135deg,#f5e03a,#ff5500)" : "rgba(255,255,255,0.06)",
                  color: origin === o.key ? "#0b1020" : "rgba(255,255,255,0.65)",
                  boxShadow: origin === o.key ? "0 4px 16px rgba(245,224,58,0.25)" : "none",
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* Servicio */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.40)", letterSpacing: 1, display: "block", marginBottom: 10 }}>
              TIPO DE SERVICIO
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {availableServices.map(s => {
                const info = SERVICE_LABELS[s];
                const active = service === s;
                return (
                  <button key={s} onClick={() => setService(s)} style={{
                    flex: 1, minWidth: 120, padding: "12px 10px", borderRadius: 14,
                    border: `1.5px solid ${active ? info.color : "rgba(255,255,255,0.08)"}`,
                    cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.15s",
                    background: active ? `${info.color}18` : "rgba(255,255,255,0.03)",
                    color: active ? info.color : "rgba(255,255,255,0.55)",
                  }}>
                    <div>{info.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>{info.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Peso */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.40)", letterSpacing: 1, display: "block", marginBottom: 10 }}>
              PESO ESTIMADO (kg)
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="number" min="0" step="0.1"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="Ej: 2.5"
                style={{
                  width: "100%", background: "rgba(255,255,255,0.06)",
                  border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: 14,
                  color: "#fff", fontSize: 18, fontWeight: 700,
                  padding: "14px 60px 14px 18px", outline: "none", transition: "border 0.15s",
                  boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = "#f5e03a"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
              />
              <span style={{
                position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)",
                fontSize: 14, color: "rgba(255,255,255,0.35)", fontWeight: 700,
              }}>kg</span>
            </div>
            {w > 0 && w < 1 && (
              <div style={{ fontSize: 12, color: "#fbbf24", marginTop: 6 }}>
                ⚠ Peso mínimo facturable: 1 kg
              </div>
            )}
          </div>

          {/* Descripción */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.40)", letterSpacing: 1, display: "block", marginBottom: 10 }}>
              ¿QUÉ ESTÁS IMPORTANDO?
            </label>
            <input
              type="text"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Ej: Auriculares Sony, ropa deportiva..."
              style={{
                width: "100%", background: "rgba(255,255,255,0.06)",
                border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: 14,
                color: "#fff", fontSize: 15, padding: "13px 18px",
                outline: "none", transition: "border 0.15s", boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = "#f5e03a"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
            />
          </div>

          {/* Resultado */}
          {hasResult && (
            <div style={{
              background: "linear-gradient(135deg,rgba(245,224,58,0.08),rgba(255,85,0,0.06))",
              border: "1.5px solid rgba(245,224,58,0.25)",
              borderRadius: 18, padding: "20px 22px", marginBottom: 20,
              animation: "fadeIn 0.3s ease",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.40)", letterSpacing: 1, marginBottom: 14 }}>
                TU PRESUPUESTO
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)" }}>Tarifa / kg</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>
                    {fmtUsd(rate)}
                    {discount > 0 && (
                      <span style={{ fontSize: 11, color: "#4ade80", marginLeft: 6 }}>
                        (-${discount} vol.)
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)" }}>Peso facturable</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{billable.toFixed(2)} kg</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)" }}>Servicio</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: SERVICE_LABELS[service]?.color }}>
                    {SERVICE_LABELS[service]?.label}
                  </div>
                </div>
              </div>

              {/* Descuento por volumen badge */}
              {discount > 0 && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)",
                  borderRadius: 8, padding: "5px 10px", marginBottom: 12, fontSize: 12, color: "#4ade80", fontWeight: 700,
                }}>
                  🎯 Descuento por volumen aplicado: -${discount} USD/kg
                  {billable >= 100 ? " (100kg+)" : billable >= 50 ? " (50kg+)" : " (10kg+)"}
                </div>
              )}

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", marginBottom: 4 }}>TOTAL ESTIMADO</div>
                <div style={{ fontSize: 38, fontWeight: 900, color: "#f5e03a", letterSpacing: "-1px" }}>
                  {fmtUsd(totalUsd)}
                </div>
                {totalArs && (
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.40)", marginTop: 4 }}>
                    ≈ {fmtArs(totalArs)} ARS <span style={{ fontSize: 11 }}>@ ${Number(fx).toLocaleString("es-AR")}</span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", marginTop: 10 }}>
                * Estimado. Puede variar según peso real y tipo de producto.
              </div>
            </div>
          )}

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 12, padding: "10px 14px", marginBottom: 14,
              fontSize: 13, color: "#fca5a5",
            }}>{error}</div>
          )}

          {/* Botones */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={submitRequest}
              disabled={!hasResult || submitting}
              style={{
                background: hasResult ? "linear-gradient(135deg,#f5e03a,#ff5500)" : "rgba(255,255,255,0.08)",
                color: hasResult ? "#0b1020" : "rgba(255,255,255,0.35)",
                fontWeight: 900, fontSize: 15, padding: "15px 24px",
                borderRadius: 14, border: "none", cursor: hasResult ? "pointer" : "not-allowed",
                boxShadow: hasResult ? "0 4px 20px rgba(245,224,58,0.25)" : "none",
                transition: "all 0.15s",
              }}
            >
              {submitting ? "Enviando solicitud…" : "📦 Solicitar este envío"}
            </button>

            <a
              href={`https://wa.me/${WA}?text=${encodeURIComponent(`Hola! Quiero consultar sobre un envío.\nOrigen: ${ORIGINS.find(o=>o.key===origin)?.label}\nServicio: ${SERVICE_LABELS[service]?.label}\nPeso: ${w} kg\nProducto: ${desc || "—"}\nEstimado: ${fmtUsd(totalUsd)} USD`)}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                background: "rgba(37,211,102,0.10)", border: "1px solid rgba(37,211,102,0.25)",
                color: "#4ade80", fontWeight: 700, fontSize: 14,
                padding: "13px 24px", borderRadius: 14, textDecoration: "none",
                transition: "all 0.15s",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Consultar por WhatsApp
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        * { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>
    </div>
  );
}

// ── QuickQuoteByLink ──────────────────────────────────────────────────────────
// Pegás link + peso → te tira costo estimado al toque.
const API_QQL = import.meta.env.VITE_API_URL || "https://api.lemonsarg.com";
const ORIGIN_FLAGS = { USA: "🇺🇸", CHINA: "🇨🇳", EUROPA: "🇪🇺" };
function QuickQuoteByLink() {
  const [url, setUrl]       = useState("");
  const [kg, setKg]         = useState("");
  const [coupon, setCoupon] = useState("");
  const [override, setOverride] = useState({ origin: "", service: "" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState("");

  async function calc() {
    setErr(""); setResult(null);
    if (!url.trim()) return setErr("Pegá un link");
    const w = Number(kg);
    if (!w || w <= 0) return setErr("Ingresá el peso aproximado en kg");
    setLoading(true);
    try {
      const body = { url: url.trim(), weight_kg: w };
      if (override.origin)  body.origin  = override.origin;
      if (override.service) body.service = override.service;
      if (coupon.trim())    body.coupon  = coupon.trim();
      const r = await fetch(`${API_QQL}/api/quote/estimate-link`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error || "Error calculando");
      setResult(d);
    } catch { setErr("Error de red"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ background: "linear-gradient(135deg,rgba(167,139,250,.08),rgba(236,72,153,.04))", border: "1px solid rgba(167,139,250,.25)", borderRadius: 18, padding: "22px 24px", marginBottom: 22, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#a78bfa,#ec4899,#a78bfa,transparent)", backgroundSize: "200% 100%", animation: "fadeIn 1s ease-in" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 24 }}>⚡</span>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2.5px", color: "#a78bfa", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Cotización express</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: "1px", color: "#fff", lineHeight: 1 }}>Pegá link + peso → te tiro el precio</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 12 }}>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://amazon.com/..."
          style={{ background: "rgba(0,0,0,.3)", border: "1px solid rgba(167,139,250,.3)", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit" }}/>
        <input type="number" value={kg} onChange={e => setKg(e.target.value)} placeholder="Peso kg" min={0.1} step={0.1}
          style={{ background: "rgba(0,0,0,.3)", border: "1px solid rgba(167,139,250,.3)", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit" }}/>
        <input value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())} placeholder="Cupón (opcional)" maxLength={40}
          style={{ background: "rgba(0,0,0,.3)", border: "1px solid rgba(167,139,250,.3)", borderRadius: 10, padding: "12px 14px", color: "#a78bfa", fontSize: 13, outline: "none", fontFamily: "'DM Mono',monospace", letterSpacing: "1px", textTransform: "uppercase" }}/>
        <button onClick={calc} disabled={loading}
          style={{ padding: "0 22px", background: "linear-gradient(135deg,#a78bfa,#ec4899)", color: "#000", border: "none", borderRadius: 10, fontWeight: 800, cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: "1.5px", textTransform: "uppercase" }}>
          {loading ? "…" : "Calcular →"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, fontSize: 11, color: "rgba(255,255,255,.4)" }}>
        <span>Detecto país y servicio automáticamente. Forzar:</span>
        <select value={override.origin} onChange={e => setOverride(o => ({ ...o, origin: e.target.value }))}
          style={{ background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.1)", color: "#fff", padding: "2px 6px", fontSize: 11, borderRadius: 4 }}>
          <option value="">auto</option><option value="USA">USA</option><option value="CHINA">China</option><option value="EUROPA">Europa</option>
        </select>
        <select value={override.service} onChange={e => setOverride(o => ({ ...o, service: e.target.value }))}
          style={{ background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.1)", color: "#fff", padding: "2px 6px", fontSize: 11, borderRadius: 4 }}>
          <option value="">auto</option><option value="NORMAL">Normal</option><option value="EXPRESS">Express</option>
        </select>
      </div>

      {err && (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)", color: "#fca5a5", borderRadius: 10, fontSize: 12, fontWeight: 600 }}>{err}</div>
      )}

      {result && (
        <div style={{ padding: "16px 18px", background: "rgba(0,0,0,.4)", border: "1px solid rgba(167,139,250,.4)", borderRadius: 12, animation: "fadeIn .3s ease" }}>
          {/* PRODUCTO (preview del link) */}
          {result.product && (result.product.image || result.product.title) && (
            <div style={{ display: "flex", gap: 14, padding: "12px 14px", background: "rgba(167,139,250,.04)", border: "1px solid rgba(167,139,250,.18)", borderRadius: 10, marginBottom: 14 }}>
              {result.product.image && (
                <img src={result.product.image} alt="" referrerPolicy="no-referrer" loading="lazy"
                  style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, flexShrink: 0, background: "#0a0820", border: "1px solid rgba(255,255,255,.06)" }}
                  onError={e => { e.currentTarget.style.display = "none"; }}/>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {result.product.title && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.4, marginBottom: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {result.product.title}
                  </div>
                )}
                {result.product.description && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", lineHeight: 1.5, marginBottom: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {result.product.description}
                  </div>
                )}
                {result.product.price && (
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: "1px", color: "#a78bfa", fontWeight: 700 }}>
                    Precio en tienda: {result.product.currency || ""} {result.product.price.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ fontSize: 30 }}>{ORIGIN_FLAGS[result.detected.origin]}</div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: "1px", color: "#fff", lineHeight: 1 }}>
                {result.detected.origin} · {result.detected.service}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 4 }}>ETA: {result.eta}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 42, color: "#a78bfa", lineHeight: 1, letterSpacing: "1px" }}>${result.total_usd.toFixed(2)}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "1.5px", color: "rgba(255,255,255,.4)", textTransform: "uppercase", marginTop: 4 }}>USD final</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, fontSize: 11, color: "rgba(255,255,255,.6)", fontFamily: "'DM Mono',monospace", letterSpacing: ".3px" }}>
            <div>Peso facturado: <strong style={{ color: "#fff" }}>{result.input.billable_kg} kg</strong></div>
            <div>Tarifa: <strong style={{ color: "#fff" }}>${result.rate_usd_per_kg}/kg</strong></div>
            <div>Subtotal: <strong style={{ color: "#fff" }}>${result.subtotal_usd.toFixed(2)}</strong></div>
            {result.discount_usd > 0 && <div style={{ color: "#22c55e" }}>Descuento: <strong>-${result.discount_usd.toFixed(2)}</strong></div>}
          </div>
          {result.coupon && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.3)", borderRadius: 8, fontSize: 11, color: "#22c55e", fontFamily: "'DM Mono',monospace" }}>
              ✓ Cupón <strong>{result.coupon.code}</strong> aplicado · {result.coupon.description || ""}
            </div>
          )}
          {result.warning && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(255,140,42,.08)", border: "1px solid rgba(255,140,42,.3)", borderRadius: 8, fontSize: 11, color: "#ff8c2a" }}>
              ⚠ {result.warning}
            </div>
          )}
        </div>
      )}
    </div>
  );
}