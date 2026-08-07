// client/src/pages/admin/ProfileItemsTab.jsx
//
// ABM de los items del perfil desde el panel: avatares, marcos, banners,
// títulos e insignias. Antes sólo se podían crear INSIGNIAS (desde el Studio);
// los otros cuatro tipos estaban sembrados en código y había que pedirlos por
// desarrollo. Pedido de 2026-08-06: que el cliente los cargue solo.
//
// Cada tipo tiene sus propios campos y su VISTA PREVIA en vivo, para que el
// que carga vea exactamente lo que va a ver el socio antes de guardar.
import { useEffect, useMemo, useState } from "react";
import { Btn, Card, Field, Badge } from "./ui.jsx";
import { BannerCanvas } from "../ProfileStudio.jsx";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");
const authHdr = () => ({ Authorization: `Bearer ${getToken()}` });
const jsonHdr = () => ({ ...authHdr(), "Content-Type": "application/json" });

const TIPOS = [
  { v: "avatar", label: "🧑 Avatar",   ayuda: "La foto redonda del perfil: un emoji sobre un color." },
  { v: "frame",  label: "🖼 Marco",    ayuda: "El borde de esa foto redonda." },
  { v: "banner", label: "🎬 Banner",   ayuda: "La franja animada de arriba del perfil." },
  { v: "title",  label: "📛 Título",   ayuda: "Una palabra de color debajo del nombre." },
  { v: "badge",  label: "⚡ Insignia", ayuda: "Un emoji chico al lado del nombre. Se llevan hasta 4." },
];
const RAREZAS = [
  { v: "common",    label: "Común",     color: "#94a3b8" },
  { v: "rare",      label: "Rara",      color: "#60a5fa" },
  { v: "epic",      label: "Épica",     color: "#a78bfa" },
  { v: "legendary", label: "Legendaria",color: "#f5c000" },
];
// Los 12 que sabe dibujar BannerCanvas. Los tres marcados pesan: dibujan un
// degradado del tamaño del canvas por partícula (medido el 2026-08-06).
const EFECTOS = [
  { v: "stars",      label: "Estrellas",  peso: "liviano" },
  { v: "snow",       label: "Nieve",      peso: "liviano" },
  { v: "lemon_rain", label: "Hojas",      peso: "liviano" },
  { v: "matrix",     label: "Matrix",     peso: "liviano" },
  { v: "rainbow",    label: "Arcoíris",   peso: "liviano" },
  { v: "lightning",  label: "Rayos",      peso: "medio" },
  { v: "vortex",     label: "Vórtice",    peso: "medio" },
  { v: "fire",       label: "Fuego",      peso: "medio" },
  { v: "cyber",      label: "Cyber",      peso: "medio" },
  { v: "aurora",     label: "Aurora",     peso: "PESADO" },
  { v: "pulse",      label: "Pulso",      peso: "PESADO" },
  { v: "ocean",      label: "Océano",     peso: "PESADO" },
];
const MENTA = "#A7F5C8", VERDE = "#25D366";

const vacio = (tipo) => ({
  key: "", type: tipo, name: "", description: "", emoji: "🌿",
  cost_coins: 0, rarity: "common", active: true,
  data: tipo === "banner" ? { color1: MENTA, color2: VERDE, effect: "stars" }
      : tipo === "frame"  ? { border: `2px solid ${MENTA}`, shadow: `0 0 14px ${MENTA}88`, pulse: false }
      : tipo === "avatar" ? { bg: MENTA, emoji: "🌿" }
      : { color: MENTA },
});

// key sugerida a partir del nombre visible, con las mismas reglas del server.
const sugerirKey = (tipo, nombre) =>
  (tipo + "_" + (nombre || ""))
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

export default function ProfileItemsTab() {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [edit, setEdit] = useState(null);       // item en edición (o null)
  const [msg, setMsg] = useState(null);         // { ok, texto }

  const cargar = () => {
    setCargando(true);
    fetch(`${API}/admin/profile-items`, { headers: authHdr() })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setItems(d.items); else setMsg({ ok: false, texto: d.error || "No se pudo cargar" }); })
      .catch(() => setMsg({ ok: false, texto: "Error de red" }))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  const visibles = useMemo(
    () => (filtro === "todos" ? items : items.filter((i) => i.type === filtro)),
    [items, filtro]
  );

  const guardar = async (item, esNuevo) => {
    const url = esNuevo ? `${API}/admin/profile-items` : `${API}/admin/profile-items/${item.key}`;
    const r = await fetch(url, { method: esNuevo ? "POST" : "PATCH", headers: jsonHdr(), body: JSON.stringify(item) });
    const d = await r.json();
    if (!r.ok) { setMsg({ ok: false, texto: d.error || "No se pudo guardar" }); return false; }
    setMsg({ ok: true, texto: `Guardado: ${d.item.name}${d.aviso ? " — " + d.aviso : ""}` });
    cargar(); return true;
  };

  const alternarActivo = async (item) => {
    const r = await fetch(`${API}/admin/profile-items/${item.key}`, {
      method: "PATCH", headers: jsonHdr(), body: JSON.stringify({ active: !item.active }),
    });
    const d = await r.json();
    if (!r.ok) return setMsg({ ok: false, texto: d.error });
    setMsg({ ok: true, texto: d.aviso || (item.active ? `"${item.name}" ya no se ve en la tienda` : `"${item.name}" visible en la tienda`) });
    cargar();
  };

  // Un item vive en dos lados: la colección del socio y el slot donde lo tiene
  // PUESTO. Por eso borrar uno que alguien tiene no es gratis — se lo saca del
  // perfil. Antes el botón directamente no se dibujaba en ese caso, así que no
  // había forma de saber por qué (reportado por Lemon el 2026-08-07). Ahora se
  // dibuja siempre y lo que cambia es lo que te avisa antes.
  const borrar = async (item) => {
    const n = Number(item.lo_tienen) || 0;
    const aviso = n
      ? `"${item.name}" lo tienen ${n} socio${n > 1 ? "s" : ""}.\n\n` +
        `Si lo borrás se lo saco del perfil y lo pierden. Esto NO se deshace.\n\n` +
        `Si sólo querés que deje de aparecer en la tienda, cancelá y usá "Ocultar".`
      : `¿Borrar "${item.name}"? No se deshace.`;
    if (!confirm(aviso)) return;

    const r = await fetch(`${API}/admin/profile-items/${item.key}${n ? "?forzar=1" : ""}`,
      { method: "DELETE", headers: authHdr() });
    const d = await r.json();
    if (!r.ok) return setMsg({ ok: false, texto: d.error });
    setMsg({ ok: true, texto: d.aviso || `Borrado: ${item.name}` });
    cargar();
  };

  return (
    <div>
      <Card
        title="Items del perfil"
        hint="Lo que los socios pueden conseguir en la tienda y ponerse en su perfil. Un item con costo 0 es gratis: aparece y se obtiene con un clic."
        right={<Btn variant="primary" onClick={() => setEdit({ ...vacio("banner"), _nuevo: true })}>+ Nuevo item</Btn>}
      >
        {msg && (
          <div style={{
            marginBottom: 14, padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: msg.ok ? "rgba(34,197,94,.10)" : "rgba(239,68,68,.10)",
            border: `1px solid ${msg.ok ? "rgba(34,197,94,.35)" : "rgba(239,68,68,.35)"}`,
            color: msg.ok ? "#15803d" : "#b91c1c",
          }}>
            {msg.texto} <span onClick={() => setMsg(null)} style={{ cursor: "pointer", float: "right", opacity: .6 }}>✕</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
          {[{ v: "todos", label: "Todos" }, ...TIPOS].map((t) => (
            <button key={t.v} onClick={() => setFiltro(t.v)} style={{
              padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 700,
              border: filtro === t.v ? "1px solid transparent" : "1px solid var(--border-2)",
              background: filtro === t.v ? "var(--accent)" : "var(--surface)",
              color: filtro === t.v ? "#fff" : "var(--text-2)", fontFamily: "inherit",
            }}>{t.label}</button>
          ))}
        </div>

        {cargando ? <div style={{ color: "var(--text-3)", fontSize: 13 }}>Cargando…</div> : (
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 64 }}>Vista</th>
                  <th>Item</th><th>Tipo</th><th>Costo</th><th>Rareza</th><th>Lo tienen</th><th>En la tienda</th><th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((i) => (
                  <tr key={i.key} style={{ opacity: i.active ? 1 : .55 }}>
                    <td><Vista item={i} chico /></td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{i.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{i.description || "—"}</div>
                      <code style={{ fontSize: 10, color: "var(--text-3)" }}>{i.key}</code>
                    </td>
                    <td>{TIPOS.find((t) => t.v === i.type)?.label || i.type}</td>
                    <td>{Number(i.cost_coins) === 0 ? <Badge tone="success">Gratis</Badge> : `${i.cost_coins} pts`}</td>
                    <td><span style={{ color: RAREZAS.find((r) => r.v === i.rarity)?.color }}>{RAREZAS.find((r) => r.v === i.rarity)?.label || i.rarity}</span></td>
                    <td>{i.lo_tienen || 0}</td>
                    <td>{i.active ? <Badge tone="success">Sí</Badge> : <Badge tone="muted">Oculto</Badge>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Btn size="sm" onClick={() => setEdit({ ...i, data: i.data || {} })}>Editar</Btn>{" "}
                      <Btn size="sm" onClick={() => alternarActivo(i)}>{i.active ? "Ocultar" : "Mostrar"}</Btn>{" "}
                      <Btn size="sm" variant="danger" onClick={() => borrar(i)}
                        title={i.lo_tienen
                          ? `${i.lo_tienen} socio(s) lo tienen. Si lo borrás se lo saco del perfil. Para sacarlo sólo de la tienda, usá Ocultar.`
                          : "Nadie lo tiene todavía: se borra sin afectar a ningún socio."}>
                        {i.lo_tienen ? "Borrar igual" : "Borrar"}
                      </Btn>
                    </td>
                  </tr>
                ))}
                {!visibles.length && (
                  <tr><td colSpan={8} style={{ color: "var(--text-3)", fontSize: 13, padding: 18 }}>No hay items de este tipo todavía.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {edit && <Editor item={edit} onClose={() => setEdit(null)} onSave={guardar} />}
    </div>
  );
}

// ── VISTA PREVIA ─────────────────────────────────────────────────────────────
// Dibuja el item como lo va a ver el socio. El banner reusa el mismo
// BannerCanvas del perfil, así que lo que se ve acá es literalmente lo que se
// va a ver allá.
function Vista({ item, chico }) {
  const d = item.data || {};
  const tam = chico ? 40 : 96;
  if (item.type === "banner" && d.image_url) {
    return <img src={d.image_url} alt="" style={{ width: chico ? 56 : "100%", height: chico ? 34 : 150, objectFit: "cover", borderRadius: 8, display: "block" }} />;
  }
  if (item.type === "banner") {
    return <div style={{ width: chico ? 56 : "100%", borderRadius: 8, overflow: "hidden" }}>
      <BannerCanvas effect={d.effect || "stars"} color1={d.color1 || MENTA} color2={d.color2 || VERDE} height={chico ? 34 : 150} />
    </div>;
  }
  if (item.type === "frame") {
    return <div style={{
      width: tam, height: tam, borderRadius: "50%", display: "grid", placeItems: "center",
      background: "var(--surface-2)", border: d.border || `2px solid ${MENTA}`,
      boxShadow: d.shadow || "none", fontSize: tam * .4,
      animation: d.pulse ? "admPulse 2s ease-in-out infinite" : "none",
    }}>🙂</div>;
  }
  if (item.type === "avatar" && d.image_url) {
    return <img src={d.image_url} alt="" style={{ width: tam, height: tam, borderRadius: "50%", objectFit: d.fit || "cover", background: d.bg || "transparent", padding: d.fit === "contain" ? "14%" : 0, boxSizing: "border-box" }} />;
  }
  if (item.type === "avatar") {
    return <div style={{
      width: tam, height: tam, borderRadius: "50%", display: "grid", placeItems: "center",
      background: d.bg || MENTA, fontSize: tam * .45,
    }}>{d.emoji || item.emoji || "🌿"}</div>;
  }
  if (item.type === "title") {
    return <span style={{ fontWeight: 800, fontSize: chico ? 12 : 20, color: d.color || MENTA }}>{item.name || "Título"}</span>;
  }
  return <span style={{ fontSize: chico ? 20 : 40 }}>{item.emoji || "⚡"}</span>;
}

// ── SUBIR UN DISEÑO PROPIO ───────────────────────────────────────────────────
// El servidor recorta la imagen a la medida exacta del lugar donde se va a ver,
// eligiendo solo qué parte conservar. El cliente sube lo que tenga.
function SubirImagen({ tipo, valor, onSubida }) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);

  const elegir = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setSubiendo(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("imagen", file);
      fd.append("tipo", tipo);
      const r = await fetch(`${API}/admin/profile-items/imagen`, { method: "POST", headers: authHdr(), body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo subir");
      onSubida(d.url);
    } catch (err) { setError(err.message); }
    setSubiendo(false);
    e.target.value = "";
  };

  return (
    <Field label="Diseño propio (opcional)" hint="Subí una imagen y se acomoda sola al lugar donde va. Si cargás una, reemplaza al efecto/emoji.">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface-2)", cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}>
          {subiendo ? "Subiendo…" : valor ? "Cambiar imagen" : "Elegir imagen"}
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={elegir} disabled={subiendo} />
        </label>
        {valor && <>
          <img src={valor} alt="" style={{ height: 44, borderRadius: 7, border: "1px solid var(--border-2)" }} />
          <Btn size="sm" variant="danger" onClick={() => onSubida("")}>Quitar</Btn>
        </>}
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 7 }}>{error}</div>}
    </Field>
  );
}

// ── EDITOR ───────────────────────────────────────────────────────────────────
function Editor({ item, onClose, onSave }) {
  const [f, setF] = useState(item);
  const [guardando, setGuardando] = useState(false);
  const esNuevo = !!item._nuevo;
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setData = (k, v) => setF((p) => ({ ...p, data: { ...(p.data || {}), [k]: v } }));

  // Al cambiar de tipo en un item NUEVO, se reinician los campos propios de ese
  // tipo (un banner no tiene borde, un marco no tiene efecto).
  const cambiarTipo = (tipo) => setF((p) => ({ ...vacio(tipo), key: p.key, name: p.name, description: p.description, cost_coins: p.cost_coins, rarity: p.rarity, active: p.active, _nuevo: p._nuevo }));

  const enviar = async () => {
    setGuardando(true);
    const payload = { ...f };
    if (esNuevo && !payload.key) payload.key = sugerirKey(f.type, f.name);
    if (f.type === "avatar") payload.emoji = f.data?.emoji || f.emoji;
    const ok = await onSave(payload, esNuevo);
    setGuardando(false);
    if (ok) onClose();
  };

  const campo = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
  const color = { width: 44, height: 34, padding: 2, borderRadius: 8, border: "1px solid var(--border-2)", background: "none", cursor: "pointer" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 900, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, width: "min(720px, 100%)", maxHeight: "90vh", overflowY: "auto" }}>
        <style>{`@keyframes admPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.5)}}`}</style>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{esNuevo ? "Nuevo item" : `Editar: ${item.name}`}</div>
        <div style={{ color: "var(--text-3)", fontSize: 12.5, marginBottom: 18 }}>
          {TIPOS.find((t) => t.v === f.type)?.ayuda}
        </div>

        {/* Tipo — sólo al crear: cambiarlo después rompería lo que la gente ya tiene */}
        {esNuevo ? (
          <Field label="Tipo de item">
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {TIPOS.map((t) => (
                <button key={t.v} onClick={() => cambiarTipo(t.v)} style={{
                  padding: "7px 13px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 700,
                  border: f.type === t.v ? "1px solid transparent" : "1px solid var(--border-2)",
                  background: f.type === t.v ? "var(--accent)" : "var(--surface-2)",
                  color: f.type === t.v ? "#fff" : "var(--text-2)", fontFamily: "inherit",
                }}>{t.label}</button>
              ))}
            </div>
          </Field>
        ) : (
          <Field label="Tipo de item" hint="No se puede cambiar: es lo que ata el item a la gente que ya lo tiene.">
            <div style={{ fontSize: 13, fontWeight: 700 }}>{TIPOS.find((t) => t.v === f.type)?.label}</div>
          </Field>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="grid2">
          <Field label="Nombre visible" hint="Lo que lee el socio en la tienda.">
            <input style={campo} value={f.name} maxLength={60}
              onChange={(e) => { set("name", e.target.value); if (esNuevo) set("key", sugerirKey(f.type, e.target.value)); }}
              placeholder="Verde Holistic" />
          </Field>
          <Field label="Costo en puntos" hint="0 = gratis: se obtiene con un clic.">
            <input style={campo} type="number" min={0} value={f.cost_coins}
              onChange={(e) => set("cost_coins", Math.max(0, parseInt(e.target.value) || 0))} />
          </Field>
        </div>

        <Field label="Descripción" hint="Una línea corta.">
          <input style={campo} value={f.description || ""} maxLength={160}
            onChange={(e) => set("description", e.target.value)} placeholder="El banner de la casa" />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="grid2">
          <Field label="Rareza" hint="Sólo cambia el color del cartelito.">
            <select style={campo} value={f.rarity} onChange={(e) => set("rarity", e.target.value)}>
              {RAREZAS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Nombre interno" hint={esNuevo ? "Se arma solo. No se puede cambiar después." : "Permanente."}>
            <input style={{ ...campo, opacity: esNuevo ? 1 : .6 }} value={f.key} disabled={!esNuevo}
              onChange={(e) => set("key", e.target.value)} />
          </Field>
        </div>

        {/* ── Campos propios de cada tipo ── */}
        {f.type === "banner" && (
          <>
            <Field label="Efecto" hint="Los marcados PESADO dibujan un degradado de pantalla completa por partícula: si el banner va a ser el de todos, elegí uno liviano.">
              <select style={campo} value={f.data?.effect || "stars"} onChange={(e) => setData("effect", e.target.value)}>
                {EFECTOS.map((x) => <option key={x.v} value={x.v}>{x.label} — {x.peso}</option>)}
              </select>
            </Field>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <Field label="Color 1"><input type="color" style={color} value={f.data?.color1 || MENTA} onChange={(e) => setData("color1", e.target.value)} /></Field>
              <Field label="Color 2"><input type="color" style={color} value={f.data?.color2 || VERDE} onChange={(e) => setData("color2", e.target.value)} /></Field>
            </div>
            <SubirImagen tipo="banner" valor={f.data?.image_url} onSubida={(url) => setData("image_url", url)} />
          </>
        )}

        {f.type === "frame" && (
          <>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Field label="Color del borde">
                <input type="color" style={color} value={(f.data?.border || "").match(/#[0-9a-f]{6}/i)?.[0] || MENTA}
                  onChange={(e) => { setData("border", `2px solid ${e.target.value}`); setData("shadow", `0 0 14px ${e.target.value}88`); }} />
              </Field>
              <Field label="Brillo alrededor">
                <label style={{ fontSize: 13, display: "flex", gap: 7, alignItems: "center" }}>
                  <input type="checkbox" checked={!!f.data?.shadow} onChange={(e) => setData("shadow", e.target.checked ? `0 0 14px ${MENTA}88` : "")} /> Sí
                </label>
              </Field>
              <Field label="Que lata">
                <label style={{ fontSize: 13, display: "flex", gap: 7, alignItems: "center" }}>
                  <input type="checkbox" checked={!!f.data?.pulse} onChange={(e) => setData("pulse", e.target.checked)} /> Sí
                </label>
              </Field>
            </div>
          </>
        )}

        {f.type === "avatar" && (
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Field label="Emoji" hint="Uno solo.">
              <input style={{ ...campo, width: 90, fontSize: 22, textAlign: "center" }} maxLength={4}
                value={f.data?.emoji || ""} onChange={(e) => setData("emoji", e.target.value)} />
            </Field>
            <Field label="Color de fondo">
              <input type="color" style={color} value={f.data?.bg || MENTA} onChange={(e) => setData("bg", e.target.value)} />
            </Field>
          </div>
        )}
        {f.type === "avatar" && <>
          <SubirImagen tipo="avatar" valor={f.data?.image_url} onSubida={(url) => setData("image_url", url)} />
          {f.data?.image_url && (
            <Field label="Cómo entra la imagen" hint="Recortada llena el círculo. Entera sirve para fotos de producto con fondo transparente.">
              <select style={campo} value={f.data?.fit || "cover"} onChange={(e) => setData("fit", e.target.value)}>
                <option value="cover">Recortada (llena el círculo)</option>
                <option value="contain">Entera (se ve completa)</option>
              </select>
            </Field>
          )}
        </>}

        {f.type === "title" && (
          <Field label="Color del título">
            <input type="color" style={color} value={f.data?.color || MENTA} onChange={(e) => setData("color", e.target.value)} />
          </Field>
        )}

        {f.type === "badge" && (
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Field label="Emoji">
              <input style={{ ...campo, width: 90, fontSize: 22, textAlign: "center" }} maxLength={4}
                value={f.emoji || ""} onChange={(e) => set("emoji", e.target.value)} />
            </Field>
            <Field label="Color">
              <input type="color" style={color} value={f.data?.color || MENTA} onChange={(e) => setData("color", e.target.value)} />
            </Field>
          </div>
        )}

        <Field label="Vista previa" hint="Así lo va a ver el socio.">
          <div style={{ padding: 18, borderRadius: 12, background: "#06070A", display: "grid", placeItems: "center", minHeight: 110 }}>
            <Vista item={f} />
          </div>
        </Field>

        <Field label="¿Se ve en la tienda?">
          <label style={{ fontSize: 13, display: "flex", gap: 7, alignItems: "center" }}>
            <input type="checkbox" checked={f.active !== false} onChange={(e) => set("active", e.target.checked)} />
            Sí, disponible para los socios
          </label>
        </Field>

        <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 18 }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={enviar} disabled={guardando || !f.name}>
            {guardando ? "Guardando…" : esNuevo ? "Crear item" : "Guardar cambios"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
