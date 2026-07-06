// client/src/lib/useCart.js
//
// Cart hook — Sprint 14 F2 (2026-05-23). Estado del carrito persistido en
// localStorage. Funciona anónimo (no requiere login) hasta el checkout.
//
// API:
//   const { items, addItem, updateQty, removeItem, clear, subtotalCents, itemCount } = useCart();
//
// Items shape:
//   { id, slug, name, price_cents, primary_image, quantity, max_stock|null }
//
// Subscriber pattern: cuando un componente muta el carrito, todos los demás
// que usaron useCart se re-renderizan. Implementado con un EventTarget global
// para evitar prop drilling y librerías extra.

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "holistic.cart.v1";
const EVENT_NAME  = "holistic-cart-changed";

function readCart() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { items } }));
  } catch {
    // localStorage lleno o bloqueado — falla silenciosa, el cart sigue en
    // memoria pero no persiste.
  }
}

export function useCart() {
  const [items, setItems] = useState(() => readCart());

  useEffect(() => {
    const onChange = (e) => setItems(e.detail?.items || readCart());
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setItems(readCart());
    };
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const addItem = useCallback((product, quantity = 1) => {
    const cur = readCart();
    const idx = cur.findIndex((i) => i.id === product.id);
    const productLineLimit = product.stock == null ? Infinity : product.stock;
    if (idx >= 0) {
      const newQty = Math.min(productLineLimit, cur[idx].quantity + quantity);
      cur[idx] = { ...cur[idx], quantity: newQty };
    } else {
      cur.push({
        id: product.id,
        // Para líneas de kit (pack por medida) el `id` es compuesto
        // (`${kitId}::kit::${formato}`) para no pisar otras medidas del mismo
        // kit. `product_id` guarda el id numérico real que el checkout necesita,
        // y `kit_formato` le dice al server qué precio a medida cobrar.
        product_id: product.product_id ?? product.id,
        kit_formato: product.kit_formato ?? null,
        slug: product.slug,
        name: product.name,
        price_cents: product.price_cents,
        // Packs de puntos no traen foto → moneda HOLISTIC oficial como imagen.
        primary_image: product.primary_image || (product.images?.[0]?.url)
          || ((product.meta?.points_pack || product.meta?.points_custom) ? "/imagenes-web/coins/moneda-holistic.webp" : null),
        quantity: Math.min(productLineLimit, quantity),
        max_stock: product.stock ?? null,
      });
    }
    writeCart(cur);
  }, []);

  const updateQty = useCallback((id, quantity) => {
    const cur = readCart();
    const idx = cur.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const max = cur[idx].max_stock == null ? Infinity : cur[idx].max_stock;
    const q = Math.max(0, Math.min(max, quantity));
    if (q <= 0) cur.splice(idx, 1);
    else cur[idx] = { ...cur[idx], quantity: q };
    writeCart(cur);
  }, []);

  const removeItem = useCallback((id) => {
    const cur = readCart().filter((i) => i.id !== id);
    writeCart(cur);
  }, []);

  const clear = useCallback(() => writeCart([]), []);

  const subtotalCents = items.reduce((acc, i) => acc + i.price_cents * i.quantity, 0);
  const itemCount     = items.reduce((acc, i) => acc + i.quantity, 0);

  return { items, addItem, updateQty, removeItem, clear, subtotalCents, itemCount };
}

export function formatARS(cents) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
