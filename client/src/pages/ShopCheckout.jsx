// client/src/pages/ShopCheckout.jsx
//
// Checkout — REWRITE editorial botánico (2026-06-03). Form de datos +
// dirección de envío, resumen sticky del carrito, código promocional y
// botón "Pagar con MercadoPago". Estilos en styles/shop-checkout.css
// (clases reales con media queries e inputs con focus ring — reemplaza el
// style-object inline y los window.innerWidth que no reaccionaban al resize).
//
// El submit pega a POST /api/shop/checkout que crea la orden y devuelve
// init_point (MercadoPago Checkout Pro) o un fallback de "orden pendiente".

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart, formatARS } from "../lib/useCart.js";
import { useBranding } from "../lib/branding.js";
import "../styles/shop-checkout.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

const PROVINCIAS_AR = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones",
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
  "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

export default function ShopCheckout() {
  useBranding();
  const navigate = useNavigate();
  const { items, subtotalCents, clear } = useCart();
  // Guest checkout: comprar sin loguear. Si no hay sesión, recomendamos registro.
  const isGuest = typeof window !== "undefined" && !localStorage.getItem("token") && !sessionStorage.getItem("token");

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
      if (data.public_id) {
        sessionStorage.setItem("holistic.lastOrder", data.public_id);
        if (data.free) sessionStorage.setItem("holistic.lastOrderFree", "1");
      }
      if (data.init_point) {
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
    <div className="co-page theme-light">
      <div className="co-container">
        <Link to="/shop" className="co-back">
          <span className="co-arrow">←</span> Seguir comprando
        </Link>
        <h1 className="co-title">Finalizar <span className="co-em">compra</span></h1>
        <p className="co-sub">
          Completá tus datos de contacto y envío. El pago se procesa por MercadoPago — aceptamos tarjetas y efectivo.
        </p>

        {isGuest && (
          <div className="co-guest">
            <span className="co-guest-ico" aria-hidden="true">💚</span>
            <div className="co-guest-body">
              <div className="co-guest-title">Comprás como invitado — recibís todo por email igual</div>
              <div className="co-guest-text">Te recomendamos crear tu cuenta: seguís tus pedidos, sumás puntos y la próxima comprás más rápido.</div>
            </div>
            <Link to="/register" className="co-guest-cta">Registrarme →</Link>
          </div>
        )}

        {err && <div className="co-error">{err}</div>}

        <div className="co-layout">
          {/* ── Form datos ── */}
          <div className="co-reveal">
            <div className="co-card">
              <h3 className="co-section-h">Contacto</h3>
              <div className="co-row">
                <label className="co-label">Email *</label>
                <input className="co-input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="tunombre@correo.com" autoComplete="email" />
              </div>
              <div className="co-grid2">
                <div>
                  <label className="co-label">Nombre *</label>
                  <input className="co-input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" />
                </div>
                <div>
                  <label className="co-label">Apellido</label>
                  <input className="co-input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" />
                </div>
              </div>
              <div className="co-row" style={{ marginTop: 14 }}>
                <label className="co-label">Teléfono / WhatsApp *</label>
                <input className="co-input" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+54 9 11 1234 5678" autoComplete="tel" />
              </div>
            </div>

            <div className="co-card">
              <h3 className="co-section-h">Dirección de envío</h3>
              <div className="co-grid3">
                <div>
                  <label className="co-label">Calle *</label>
                  <input className="co-input" value={form.street} onChange={(e) => set("street", e.target.value)} autoComplete="street-address" />
                </div>
                <div>
                  <label className="co-label">Número *</label>
                  <input className="co-input" value={form.number} onChange={(e) => set("number", e.target.value)} />
                </div>
                <div>
                  <label className="co-label">Depto / piso</label>
                  <input className="co-input" value={form.apartment} onChange={(e) => set("apartment", e.target.value)} placeholder="3B" />
                </div>
              </div>
              <div className="co-grid3" style={{ marginTop: 14 }}>
                <div>
                  <label className="co-label">Ciudad *</label>
                  <input className="co-input" value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />
                </div>
                <div>
                  <label className="co-label">Provincia *</label>
                  <select className="co-input" value={form.province} onChange={(e) => set("province", e.target.value)} autoComplete="address-level1">
                    {PROVINCIAS_AR.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="co-label">Código postal *</label>
                  <input className="co-input" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} autoComplete="postal-code" />
                </div>
              </div>
              <div className="co-row" style={{ marginTop: 14 }}>
                <label className="co-label">Notas para el envío</label>
                <textarea className="co-input" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Entre tal y cual calle / dejar con el portero / etc." />
              </div>
            </div>
          </div>

          {/* ── Resumen del pedido ── */}
          <div className="co-summary-wrap co-reveal">
            <div className="co-card">
              <div className="co-summary-head">
                <h3 className="co-section-h">Tu pedido</h3>
                <Link to="/shop" className="co-summary-edit">Editar</Link>
              </div>

              {items.map((i) => (
                <div key={i.id} className="co-item">
                  {i.primary_image
                    ? <img src={i.primary_image} alt="" className="co-item-img" />
                    : <div className="co-item-img" />
                  }
                  <div>
                    <div className="co-item-name">{i.name}</div>
                    <div className="co-item-qty">Cantidad: {i.quantity}</div>
                  </div>
                  <div className="co-item-price">{formatARS(i.price_cents * i.quantity)}</div>
                </div>
              ))}

              <div className="co-totals">
                <div className="co-total-line">
                  <span className="co-muted">Subtotal</span>
                  <span>{formatARS(subtotalCents)}</span>
                </div>
                <div className="co-total-line">
                  <span className="co-muted">Envío</span>
                  <span>A coordinar</span>
                </div>
                {promoApplied && (
                  <div className="co-total-line">
                    <span className="co-accent">🎟️ {promoApplied.code}</span>
                    <span className="co-accent">−{promoApplied.discount_formatted}</span>
                  </div>
                )}
                <div className="co-total-grand-row">
                  <span className="co-total-grand-label">Total</span>
                  <span className="co-total-grand">{formatARS(totalCents)}</span>
                </div>
              </div>

              {/* ── Código promocional ── */}
              <div className="co-promo">
                {!promoApplied ? (
                  <>
                    <label className="co-promo-label">🎟️ Código promocional</label>
                    <div className="co-promo-row">
                      <input
                        type="text"
                        className="co-promo-input"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromoCode(); } }}
                        placeholder="TEST10"
                      />
                      <button
                        type="button"
                        className="co-promo-btn"
                        onClick={applyPromoCode}
                        disabled={promoChecking || !promoInput.trim()}
                      >
                        {promoChecking ? "..." : "Aplicar"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="co-promo-applied">
                    <span className="co-promo-applied-tag">✓ {promoApplied.code} aplicado</span>
                    <button type="button" className="co-promo-remove" onClick={clearPromo}>Quitar</button>
                  </div>
                )}
                {promoMsg && (
                  <div className={`co-promo-msg ${promoMsg.type === "ok" ? "is-ok" : "is-err"}`}>
                    {promoMsg.text}
                  </div>
                )}
              </div>

              <button
                onClick={submit}
                disabled={!isValid || submitting}
                className="co-cta"
              >
                {submitting ? (
                  <span className="co-spinner-row">
                    <span className="co-spinner" />
                    Procesando tu compra…
                  </span>
                ) : totalCents === 0 ? (
                  "Finalizar compra GRATIS →"
                ) : (
                  "Pagar con MercadoPago →"
                )}
              </button>

              <div className="co-trust">
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
