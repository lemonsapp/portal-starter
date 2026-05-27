// client/src/pages/ShopCheckout.jsx
//
// Checkout — Sprint 14 F2 (2026-05-23). Form de datos del cliente +
// dirección de envío, resumen del carrito, botón "Pagar con MercadoPago".
// El submit pega a POST /api/shop/checkout que crea la orden y devuelve
// init_point (URL de MercadoPago Checkout Pro) o un fallback de "orden
// pendiente" si MP no está configurado.

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart, formatARS } from "../lib/useCart.js";
import { useBranding } from "../lib/branding.js";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

const PROVINCIAS_AR = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones",
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
  "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

const styles = {
  shell: {
    minHeight: "100vh",
    background: "var(--brand-bg, var(--c-bg))",
    color: "var(--brand-text, var(--c-text))",
    fontFamily: "var(--brand-font, 'Gotham', system-ui, sans-serif)",
    padding: "32px 20px 80px",
  },
  container: { maxWidth: 1140, margin: "0 auto" },
  back: {
    display: "inline-flex", alignItems: "center", gap: 8,
    color: "rgba(var(--c-text-rgb),.7)", textDecoration: "none",
    fontSize: 13, fontWeight: 600, marginBottom: 24,
  },
  h1: {
    fontFamily: "'Gotham', sans-serif",
    fontSize: "clamp(2rem, 4vw, 2.6rem)", fontWeight: 900,
    margin: "0 0 8px", letterSpacing: "-0.02em", textTransform: "uppercase",
  },
  sub: { color: "rgba(var(--c-text-rgb),.65)", marginBottom: 28, fontSize: 14 },
  layout: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr",
    gap: "clamp(24px, 4vw, 48px)",
    alignItems: "start",
  },
  card: {
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 14,
    padding: "clamp(20px, 3vw, 28px)",
    marginBottom: 18,
  },
  sectionH: {
    fontSize: 12, fontWeight: 800, letterSpacing: ".24em",
    textTransform: "uppercase", color: "var(--brand-primary, var(--c-accent))",
    margin: "0 0 14px",
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  grid3: { display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 },
  label: { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(var(--c-text-rgb),.55)", marginBottom: 6 },
  input: {
    width: "100%", padding: "11px 13px", fontSize: 14,
    background: "rgba(255,255,255,.04)",
    border: "1px solid var(--c-border-2)",
    borderRadius: 8, color: "inherit", fontFamily: "inherit",
    boxSizing: "border-box",
  },
  row: { marginBottom: 12 },
  err: {
    padding: 10, marginBottom: 14, borderRadius: 8,
    background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.35)",
    color: "var(--c-danger)", fontSize: 13,
  },
  summaryHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  summaryRow: {
    display: "grid", gridTemplateColumns: "48px 1fr auto",
    gap: 10, padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,.05)",
    alignItems: "center",
  },
  summaryImg: { width: 48, height: 48, objectFit: "contain", borderRadius: 6, background: "rgba(255,255,255,.04)", padding: 4 },
  totals: { marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.12)" },
  totalLine: { display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 },
  totalGrand: { fontSize: 22, fontWeight: 900, color: "var(--brand-primary, var(--c-accent))" },
  cta: {
    width: "100%", padding: "16px 22px", marginTop: 18,
    borderRadius: 999, border: "none",
    background: "linear-gradient(135deg, var(--c-accent-2) 0%, #2E8F6E 100%)",
    color: "#fff", fontFamily: "inherit",
    fontWeight: 900, fontSize: 14, letterSpacing: ".06em", textTransform: "uppercase",
    cursor: "pointer",
    boxShadow: "0 14px 30px -8px rgba(46,143,110,.55)",
  },
  ctaDisabled: {
    background: "var(--c-border)", color: "rgba(var(--c-text-rgb),.4)",
    cursor: "not-allowed", boxShadow: "none",
  },
};

export default function ShopCheckout() {
  useBranding();
  const navigate = useNavigate();
  const { items, subtotalCents, clear } = useCart();

  const [form, setForm] = useState({
    email: "", firstName: "", lastName: "", phone: "",
    street: "", number: "", apartment: "",
    city: "", province: "Buenos Aires", postalCode: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  // ── Promo code state (F5) ───────────────────────────────────────────────
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState(null);  // { code, discount_cents, ... } | null
  const [promoMsg, setPromoMsg] = useState(null);          // {type:'ok'|'err', text}
  const [promoChecking, setPromoChecking] = useState(false);

  async function applyPromoCode() {
    const code = promoInput.trim();
    if (!code) return;
    setPromoChecking(true);
    setPromoMsg(null);
    try {
      const r = await fetch(`${API}/api/shop/checkout/validate-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal_cents: subtotalCents }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setPromoApplied(null);
        setPromoMsg({ type: "err", text: d.error || "Código inválido" });
      } else {
        setPromoApplied(d);
        setPromoMsg({ type: "ok", text: `Descuento aplicado: ${d.discount_formatted}` });
      }
    } catch (e) {
      setPromoMsg({ type: "err", text: "Error al validar código" });
    }
    setPromoChecking(false);
  }
  function clearPromo() {
    setPromoApplied(null);
    setPromoInput("");
    setPromoMsg(null);
  }

  // Redirect a /shop si el carrito está vacío.
  useEffect(() => {
    if (items.length === 0) {
      // Pequeño delay para no chocar con re-renders post mutación; si sigue
      // vacío después de mounted, redirigimos.
      const t = setTimeout(() => {
        if (items.length === 0) navigate("/shop", { replace: true });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [items, navigate]);

  const discountCents = promoApplied?.discount_cents || 0;
  const totalCents = Math.max(0, subtotalCents - discountCents);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  const isValid = useMemo(() => {
    return form.email.trim() && form.firstName.trim() &&
           form.phone.trim() && form.street.trim() && form.number.trim() &&
           form.city.trim() && form.postalCode.trim() && form.province.trim() &&
           items.length > 0;
  }, [form, items]);

  async function submit() {
    setErr("");
    if (!isValid) {
      setErr("Completá todos los campos requeridos para procesar tu compra.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/shop/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            email: form.email.trim().toLowerCase(),
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim() || null,
            phone: form.phone.trim(),
          },
          shipping_address: {
            street: form.street.trim(),
            number: form.number.trim(),
            apartment: form.apartment.trim() || null,
            city: form.city.trim(),
            province: form.province,
            postal_code: form.postalCode.trim(),
            country: "AR",
            notes: form.notes.trim() || null,
          },
          items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
          promo_code: promoApplied?.code || null,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error || "No se pudo crear la orden. Intentá de nuevo.");
        setSubmitting(false);
        return;
      }

      // El backend nos devuelve:
      //   • free: true → orden 100% off (paid directo, skip MP)
      //   • init_point → URL de MP Checkout Pro → redirect
      //   • ninguno → fallback manual (MP no configurado)
      // En todos los casos guardamos el public_id en sessionStorage para
      // que la success page pueda recuperarlo + clear cart al montarse.
      if (data.public_id) {
        sessionStorage.setItem("holistic.lastOrder", data.public_id);
        if (data.free) sessionStorage.setItem("holistic.lastOrderFree", "1");
      }
      if (data.init_point) {
        // MercadoPago redirect (Checkout Pro)
        window.location.href = data.init_point;
        return;
      }
      // Free purchase OR manual fallback → success page directo
      clear();
      navigate(`/shop/checkout/success?order=${encodeURIComponent(data.public_id || "")}${data.free ? "&free=1" : ""}`, { replace: true });
    } catch (e) {
      console.error("checkout error", e);
      setErr("Error de conexión. Revisá tu internet e intentá de nuevo.");
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.shell}>
      <div style={styles.container}>
        <Link to="/shop" style={styles.back}>← Seguir comprando</Link>
        <h1 style={styles.h1}>Finalizar compra</h1>
        <p style={styles.sub}>Completá tus datos de contacto y envío. El pago se procesa por MercadoPago — aceptamos tarjetas y efectivo.</p>

        {err && <div style={styles.err}>{err}</div>}

        <div style={{ ...styles.layout, gridTemplateColumns: window.innerWidth < 900 ? "1fr" : styles.layout.gridTemplateColumns }}>
          {/* ── Form datos ── */}
          <div>
            <div style={styles.card}>
              <h3 style={styles.sectionH}>Contacto</h3>
              <div style={styles.row}>
                <label style={styles.label}>Email *</label>
                <input style={styles.input} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="tunombre@correo.com" autoComplete="email" />
              </div>
              <div style={styles.grid2}>
                <div>
                  <label style={styles.label}>Nombre *</label>
                  <input style={styles.input} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" />
                </div>
                <div>
                  <label style={styles.label}>Apellido</label>
                  <input style={styles.input} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" />
                </div>
              </div>
              <div style={styles.row}>
                <label style={styles.label}>Teléfono / WhatsApp *</label>
                <input style={styles.input} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+54 9 11 1234 5678" autoComplete="tel" />
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.sectionH}>Dirección de envío</h3>
              <div style={styles.grid3}>
                <div>
                  <label style={styles.label}>Calle *</label>
                  <input style={styles.input} value={form.street} onChange={(e) => set("street", e.target.value)} autoComplete="street-address" />
                </div>
                <div>
                  <label style={styles.label}>Número *</label>
                  <input style={styles.input} value={form.number} onChange={(e) => set("number", e.target.value)} />
                </div>
                <div>
                  <label style={styles.label}>Depto / piso</label>
                  <input style={styles.input} value={form.apartment} onChange={(e) => set("apartment", e.target.value)} placeholder="3B" />
                </div>
              </div>
              <div style={styles.grid3}>
                <div>
                  <label style={styles.label}>Ciudad *</label>
                  <input style={styles.input} value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />
                </div>
                <div>
                  <label style={styles.label}>Provincia *</label>
                  <select style={styles.input} value={form.province} onChange={(e) => set("province", e.target.value)} autoComplete="address-level1">
                    {PROVINCIAS_AR.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Código postal *</label>
                  <input style={styles.input} value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} autoComplete="postal-code" />
                </div>
              </div>
              <div style={styles.row}>
                <label style={styles.label}>Notas para el envío</label>
                <textarea style={{ ...styles.input, minHeight: 70, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Entre tal y cual calle / dejar con el portero / etc." />
              </div>
            </div>
          </div>

          {/* ── Resumen del pedido ── */}
          <div style={{ position: window.innerWidth < 900 ? "static" : "sticky", top: 24 }}>
            <div style={styles.card}>
              <div style={styles.summaryHead}>
                <h3 style={styles.sectionH}>Tu pedido</h3>
                <Link to="/shop" style={{ fontSize: 11, color: "rgba(var(--c-text-rgb),.6)" }}>Editar</Link>
              </div>

              {items.map((i) => (
                <div key={i.id} style={styles.summaryRow}>
                  {i.primary_image
                    ? <img src={i.primary_image} alt="" style={styles.summaryImg} />
                    : <div style={{ ...styles.summaryImg, background: "var(--c-border)" }} />
                  }
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{i.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(var(--c-text-rgb),.55)" }}>Cantidad: {i.quantity}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-primary, var(--c-accent))" }}>
                    {formatARS(i.price_cents * i.quantity)}
                  </div>
                </div>
              ))}

              <div style={styles.totals}>
                <div style={styles.totalLine}>
                  <span style={{ color: "rgba(var(--c-text-rgb),.65)" }}>Subtotal</span>
                  <span style={{ fontWeight: 600 }}>{formatARS(subtotalCents)}</span>
                </div>
                <div style={styles.totalLine}>
                  <span style={{ color: "rgba(var(--c-text-rgb),.65)" }}>Envío</span>
                  <span style={{ fontWeight: 600 }}>A coordinar</span>
                </div>
                {promoApplied && (
                  <div style={styles.totalLine}>
                    <span style={{ color: "var(--brand-primary, var(--c-accent))" }}>
                      🎟️ {promoApplied.code}
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--brand-primary, var(--c-accent))" }}>
                      −{promoApplied.discount_formatted}
                    </span>
                  </div>
                )}
                <div style={{ ...styles.totalLine, marginTop: 10 }}>
                  <span style={{ fontWeight: 700 }}>Total</span>
                  <span style={styles.totalGrand}>{formatARS(totalCents)}</span>
                </div>
              </div>

              {/* ── Campo de código promocional ── */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--c-border)" }}>
                {!promoApplied ? (
                  <>
                    <label style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(var(--c-text-rgb),.55)", marginBottom: 6, display: "block" }}>
                      🎟️ Código promocional
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromoCode(); } }}
                        placeholder="TEST10"
                        style={{
                          flex: 1, padding: "10px 12px", fontSize: 13,
                          background: "rgba(255,255,255,.04)",
                          border: "1px solid var(--c-border-2)",
                          borderRadius: 8, color: "inherit", fontFamily: "inherit",
                          letterSpacing: ".06em", textTransform: "uppercase",
                        }}
                      />
                      <button
                        type="button"
                        onClick={applyPromoCode}
                        disabled={promoChecking || !promoInput.trim()}
                        style={{
                          padding: "10px 16px", borderRadius: 8, border: "none",
                          background: "rgba(var(--c-accent-rgb),.12)",
                          color: "var(--brand-primary, var(--c-accent))",
                          fontFamily: "inherit", fontWeight: 700, fontSize: 12,
                          letterSpacing: ".08em", textTransform: "uppercase",
                          cursor: promoChecking || !promoInput.trim() ? "not-allowed" : "pointer",
                          opacity: promoChecking || !promoInput.trim() ? 0.5 : 1,
                        }}
                      >
                        {promoChecking ? "..." : "Aplicar"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--brand-primary, var(--c-accent))", fontWeight: 700 }}>
                      ✓ {promoApplied.code} aplicado
                    </span>
                    <button
                      type="button"
                      onClick={clearPromo}
                      style={{ background: "transparent", border: "none", color: "rgba(var(--c-text-rgb),.55)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Quitar
                    </button>
                  </div>
                )}
                {promoMsg && (
                  <div style={{
                    marginTop: 8, fontSize: 11,
                    color: promoMsg.type === "ok" ? "var(--brand-primary, var(--c-accent))" : "var(--c-danger)",
                  }}>
                    {promoMsg.text}
                  </div>
                )}
              </div>

              <button
                onClick={submit}
                disabled={!isValid || submitting}
                style={{ ...styles.cta, ...((!isValid || submitting) ? styles.ctaDisabled : {}) }}
              >
                {submitting ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,.3)",
                      borderTopColor: "#fff",
                      animation: "holistic-spin .8s linear infinite",
                      display: "inline-block",
                    }} />
                    Procesando tu compra…
                  </span>
                ) : totalCents === 0 ? (
                  "Finalizar compra GRATIS →"
                ) : (
                  "Pagar con MercadoPago →"
                )}
              </button>
              {/* Keyframes inline para el spinner — no afecta otros componentes */}
              <style>{`@keyframes holistic-spin { to { transform: rotate(360deg); } }`}</style>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14, fontSize: 11, color: "rgba(var(--c-text-rgb),.55)" }}>
                <span>🔒 Pago seguro</span>
                <span>💳 Tarjetas + efectivo</span>
                <span>📦 Envío 48 hs</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
