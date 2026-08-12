// client/src/pages/admin/ui.jsx
//
// Kit de UI del panel admin — tema CLARO estilo Tiendanube/Shopify.
// Todo scopeado bajo `.adm` para no filtrar al portal (oscuro) ni a las
// pestañas del admin todavía no migradas. Se instala como design-system
// reutilizable: tokens (CSS vars) + primitivos (Card, Field, Btn, Switch…).
//
// Uso: envolver la superficie en <div className="adm"> y llamar useAdmCss()
// una vez (los componentes de acá ya lo hacen). Acento = verde Holistic.

import { useEffect } from "react";

const CHEVRON =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235a6675' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")";

const CSS = `
.adm, .adm *, .adm *::before, .adm *::after { box-sizing: border-box; }
.adm {
  --bg:#f3f5f7; --surface:#ffffff; --surface-2:#f8fafb; --surface-3:#eef2f5;
  --border:#e6eaef; --border-2:#d7dee6;
  --text:#18212e; --text-2:#5a6675; --text-3:#8a94a2;
  --accent:#2b9e6c; --accent-hover:#22855a; --accent-soft:#e8f6ef; --accent-border:#bfe6d2;
  --danger:#e5484d; --danger-ink:#b42318; --danger-soft:#fdecec; --danger-border:#f6cbcc;
  --warn:#b7791f; --warn-soft:#fbf1dd; --warn-border:#efdcb0;
  --r:14px; --r-sm:9px; --r-xs:6px;
  --sh-sm:0 1px 2px rgba(16,24,40,.05);
  --sh:0 6px 20px rgba(16,24,40,.08);
  --sh-lg:0 24px 60px rgba(16,24,40,.20);
  color:var(--text);
  font-family:'Gotham', system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
}

/* ---- typography helpers ---- */
.adm-h1 { font-size:22px; font-weight:800; letter-spacing:-.02em; margin:0; color:var(--text); }
.adm-sub { font-size:13px; color:var(--text-2); margin-top:3px; }
.adm-hint { font-size:12.5px; color:var(--text-2); line-height:1.5; }
.adm-mono { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; }

/* ---- card ---- */
.adm-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--r); box-shadow:var(--sh-sm); }
.adm-card__hd { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:15px 18px; border-bottom:1px solid var(--border); }
.adm-card__t { font-size:14px; font-weight:800; letter-spacing:-.01em; display:flex; align-items:center; gap:8px; }
.adm-card__h { font-size:12px; color:var(--text-2); margin-top:4px; line-height:1.5; max-width:60ch; }
.adm-card__bd { padding:18px; }

/* ---- field / label ---- */
.adm-field { margin-bottom:15px; }
.adm-field:last-child { margin-bottom:0; }
.adm-label { display:block; font-size:12.5px; font-weight:700; color:var(--text); margin-bottom:6px; }
.adm-help { font-size:11.5px; color:var(--text-3); margin-top:5px; line-height:1.5; }
.adm-row { display:grid; gap:12px; }

/* ---- inputs ---- */
.adm-input, .adm-textarea, .adm-select {
  width:100%; padding:10px 12px; font-size:13.5px; font-family:inherit; line-height:1.4;
  background:var(--surface); color:var(--text);
  border:1px solid var(--border-2); border-radius:var(--r-sm);
  outline:none; transition:border-color .15s, box-shadow .15s;
}
.adm-input::placeholder, .adm-textarea::placeholder { color:#aab2bd; }
.adm-input:focus, .adm-textarea:focus, .adm-select:focus {
  border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft);
}
.adm-input:disabled, .adm-textarea:disabled { background:var(--surface-3); color:var(--text-3); }
.adm-textarea { resize:vertical; min-height:88px; line-height:1.55; }
.adm-select { appearance:none; -webkit-appearance:none; background-image:${CHEVRON}; background-repeat:no-repeat; background-position:right 11px center; padding-right:34px; cursor:pointer; }

/* prefix group (precio $) */
.adm-ig { position:relative; }
.adm-ig__pre { position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:13.5px; color:var(--text-3); pointer-events:none; }
.adm-ig .adm-input { padding-left:24px; }

/* ---- buttons ---- */
.adm-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:9px 15px; font-size:13px; font-weight:700; font-family:inherit; border-radius:var(--r-sm); border:1px solid transparent; cursor:pointer; transition:background .15s, border-color .15s, color .15s, box-shadow .15s, transform .05s; white-space:nowrap; text-decoration:none; }
.adm-btn:active:not(:disabled) { transform:translateY(.5px); }
.adm-btn:disabled { opacity:.5; cursor:not-allowed; }
.adm-btn--primary { background:var(--accent); color:#fff; box-shadow:var(--sh-sm); }
.adm-btn--primary:hover:not(:disabled) { background:var(--accent-hover); }
.adm-btn--default { background:var(--surface); color:var(--text); border-color:var(--border-2); }
.adm-btn--default:hover:not(:disabled) { background:var(--surface-2); border-color:var(--text-3); }
.adm-btn--ghost { background:transparent; color:var(--text-2); }
.adm-btn--ghost:hover:not(:disabled) { background:var(--surface-3); color:var(--text); }
.adm-btn--danger { background:var(--surface); color:var(--danger); border-color:var(--danger-border); }
.adm-btn--danger:hover:not(:disabled) { background:var(--danger-soft); }
.adm-btn--sm { padding:6px 11px; font-size:12px; border-radius:var(--r-xs); }
.adm-btn--icon { padding:0; width:34px; height:34px; }

/* ---- badge ---- */
.adm-badge { display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700; padding:3px 9px; border-radius:999px; border:1px solid transparent; line-height:1.5; white-space:nowrap; }
.adm-badge--ok { background:var(--accent-soft); color:var(--accent-hover); border-color:var(--accent-border); }
.adm-badge--muted { background:var(--surface-3); color:var(--text-2); border-color:var(--border-2); }
.adm-badge--warn { background:var(--warn-soft); color:var(--warn); border-color:var(--warn-border); }
.adm-badge--danger { background:var(--danger-soft); color:var(--danger); border-color:var(--danger-border); }
.adm-dot { width:7px; height:7px; border-radius:50%; background:currentColor; display:inline-block; }

/* ---- switch ---- */
.adm-switch { display:inline-flex; align-items:center; gap:11px; cursor:pointer; }
.adm-switch > input { position:absolute; opacity:0; width:0; height:0; }
.adm-switch__track { width:38px; height:22px; border-radius:999px; background:var(--border-2); position:relative; transition:background .18s; flex:0 0 auto; }
.adm-switch__track::after { content:""; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(16,24,40,.35); transition:transform .18s; }
.adm-switch > input:checked + .adm-switch__track { background:var(--accent); }
.adm-switch > input:checked + .adm-switch__track::after { transform:translateX(16px); }
.adm-switch > input:focus-visible + .adm-switch__track { box-shadow:0 0 0 3px var(--accent-soft); }
.adm-switch__lab { display:block; }
.adm-switch__t { display:block; font-size:13px; font-weight:700; color:var(--text); }
.adm-switch__h { display:block; font-size:11.5px; color:var(--text-3); margin-top:2px; line-height:1.45; }

/* ---- table ---- */
.adm-tablewrap { overflow-x:auto; }
.adm-table { width:100%; border-collapse:collapse; font-size:13.5px; }
.adm-table th { text-align:left; padding:11px 14px; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--text-3); border-bottom:1px solid var(--border); background:var(--surface-2); white-space:nowrap; }
.adm-table td { padding:11px 14px; border-bottom:1px solid var(--border); vertical-align:middle; }
.adm-table tbody tr { transition:background .12s; }
.adm-table tbody tr:hover { background:var(--surface-2); }
.adm-table tbody tr:last-child td { border-bottom:none; }

/* ---- thumbs ---- */
.adm-thumb { width:44px; height:44px; border-radius:9px; object-fit:contain; background:var(--surface-3); border:1px solid var(--border); flex:0 0 auto; }
.adm-thumb--ph { display:flex; align-items:center; justify-content:center; color:var(--text-3); font-size:16px; }

/* ---- image gallery tiles ---- */
.adm-gal { display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:12px; }
.adm-tile { position:relative; aspect-ratio:1; border-radius:var(--r-sm); border:1px solid var(--border-2); background:var(--surface-2); overflow:hidden; display:flex; align-items:center; justify-content:center; }
.adm-tile > img { width:100%; height:100%; object-fit:contain; }
.adm-tile--primary { border-color:var(--accent); box-shadow:0 0 0 2px var(--accent-soft); }
.adm-tile__flag { position:absolute; top:6px; left:6px; font-size:10px; font-weight:800; letter-spacing:.03em; text-transform:uppercase; color:#fff; background:var(--accent); padding:2px 7px; border-radius:999px; }
.adm-tile__acts { position:absolute; top:6px; right:6px; display:flex; gap:4px; opacity:0; transition:opacity .15s; }
.adm-tile:hover .adm-tile__acts { opacity:1; }
.adm-tile__btn { width:26px; height:26px; border-radius:7px; border:none; background:rgba(255,255,255,.94); box-shadow:var(--sh-sm); color:var(--text-2); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:13px; }
.adm-tile__btn:hover { color:var(--text); }
.adm-tile__btn--star.is-on { color:#e8a020; }
.adm-tile__btn--del:hover { color:var(--danger); background:#fff; }
.adm-tile--add { border:1.5px dashed var(--border-2); background:var(--surface); color:var(--text-2); cursor:pointer; flex-direction:column; gap:6px; font-size:12px; font-weight:700; transition:border-color .15s, color .15s, background .15s; }
.adm-tile--add:hover { border-color:var(--accent); color:var(--accent-hover); background:var(--accent-soft); }
.adm-tile--add svg { width:20px; height:20px; }

/* ---- repeat rows (editorial) ---- */
.adm-rep { display:flex; flex-direction:column; gap:10px; }
.adm-rep__row { display:flex; gap:8px; align-items:flex-start; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--r-sm); padding:10px; }
.adm-rep__fields { flex:1; display:grid; gap:8px; min-width:0; }

/* ---- chips (product picker) ---- */
.adm-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:9px; }
.adm-chip { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; background:var(--accent-soft); color:var(--accent-hover); border:1px solid var(--accent-border); border-radius:999px; padding:4px 10px; }
.adm-chip > button { background:none; border:none; color:inherit; cursor:pointer; font-size:14px; line-height:1; padding:0; }
.adm-picklist { max-height:220px; overflow-y:auto; margin-top:9px; border:1px solid var(--border); border-radius:var(--r-sm); }
.adm-pickrow { display:flex; align-items:center; gap:10px; padding:8px 11px; cursor:pointer; border-bottom:1px solid var(--border); transition:background .12s; }
.adm-pickrow:last-child { border-bottom:none; }
.adm-pickrow:hover { background:var(--surface-2); }
.adm-pickrow.is-on { background:var(--accent-soft); }

/* ---- fotos por medida (kit): tarjeta por medida = header + tira ---- */
/* minmax(0,1fr): sin esto la columna del grid crece al contenido y la
   tarjeta se desborda por abajo del sidebar del editor. */
.adm-fpm { display:grid; gap:10px; grid-template-columns:minmax(0,1fr); }
.adm-fpm__row { border:1px solid var(--border); border-radius:var(--r-sm); background:var(--surface-2); padding:8px 12px 2px; min-width:0; }
.adm-fpm__head { display:flex; align-items:center; gap:8px; }
.adm-fpm__up { margin-left:auto; flex:0 0 auto; }
.adm-fpm__medida { font-size:12px; font-weight:800; min-width:46px; color:var(--accent-hover); flex:0 0 auto; }
.adm-fpm__strip { display:flex; align-items:flex-start; gap:14px; overflow-x:auto; padding:12px 2px 10px; min-width:0; -webkit-overflow-scrolling:touch; }
.adm-fpm__empty { font-size:12px; color:var(--text-3); flex:0 0 auto; align-self:center; }
.adm-fpm__tile { position:relative; flex:0 0 auto; display:grid; justify-items:center; gap:4px; }
.adm-fpm__imgbtn { position:relative; padding:2px; border-radius:8px; cursor:pointer; background:var(--surface); border:2px solid var(--border-2); display:block; }
.adm-fpm__imgbtn.is-portada { border-color:var(--accent); }
.adm-fpm__imgbtn.is-pote:not(.is-portada) { opacity:.6; }
/* La imagen no cargó (url muerta/vieja): se marca para que el admin la vea. */
.adm-fpm__imgbtn.is-broken { border-style:dashed; border-color:var(--warn); background:var(--warn-soft); }
.adm-fpm__imgbtn.is-broken::after { content:"⚠"; position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:16px; color:var(--warn); }
.adm-fpm__imgbtn.is-broken > img { visibility:hidden; }
.adm-fpm__img { width:48px; height:48px; object-fit:contain; display:block; border-radius:4px; background:var(--surface-3); }
.adm-fpm__flag { position:absolute; bottom:-2px; left:50%; transform:translateX(-50%); font-size:8.5px; font-weight:900; letter-spacing:.03em; color:#fff; background:var(--accent); border-radius:4px; padding:1px 5px; white-space:nowrap; }
.adm-fpm__ord { display:flex; align-items:center; gap:2px; }
.adm-fpm__ordbtn { width:18px; height:18px; padding:0; line-height:1; font-size:10px; border-radius:4px; cursor:pointer; background:var(--surface-3); color:var(--text-2); border:1px solid var(--border-2); }
.adm-fpm__ordbtn:disabled { opacity:.3; cursor:default; }
.adm-fpm__pos { font-size:10px; font-weight:800; min-width:18px; text-align:center; color:var(--accent-hover); }
.adm-fpm__del { position:absolute; top:-7px; right:-7px; width:18px; height:18px; line-height:16px; text-align:center; padding:0; border-radius:50%; cursor:pointer; background:var(--danger,#e5484d); color:#fff; border:1.5px solid var(--surface); font-size:12px; font-weight:900; }
/* Toggle de la paleta de potes (plegada por defecto: evita ver cada foto
   dos veces — la copia subida al kit + la original del pote). */
.adm-fpm__potes { flex:0 0 auto; align-self:center; display:inline-flex; align-items:center; gap:5px; height:26px; padding:0 10px; margin-left:4px; font-size:10.5px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:var(--text-3); background:var(--surface); border:1px dashed var(--border-2); border-radius:999px; cursor:pointer; white-space:nowrap; }
.adm-fpm__potes:hover { color:var(--text-2); border-color:var(--text-3); }
.adm-fpm__potes.is-open { color:var(--accent-hover); border-color:var(--accent-border); background:var(--accent-soft); }
.adm-fpm__use { height:18px; padding:0 8px; line-height:1; font-size:10px; font-weight:800; border-radius:4px; cursor:pointer; background:var(--surface-3); color:var(--text-2); border:1px solid var(--border-2); white-space:nowrap; }
.adm-fpm__use:hover { background:var(--accent-soft); color:var(--accent-hover); border-color:var(--accent-border); }
@media (max-width:700px){
  .adm-fpm__img { width:56px; height:56px; }
  .adm-fpm__ordbtn { width:24px; height:22px; font-size:11px; }
  .adm-fpm__pos { font-size:11px; }
  .adm-fpm__del { width:22px; height:22px; line-height:19px; }
  .adm-fpm__use { height:22px; font-size:11px; }
}

/* ---- editor de imágenes por medida (familias) ---- */
.adm-mie { display:grid; gap:8px; padding:10px 0; grid-template-columns:minmax(0,1fr); }
.adm-mie__row { display:grid; grid-template-columns:auto auto 1.3fr 1fr auto; grid-template-areas:"ord thumb url alt acts"; gap:6px; align-items:center; }
.adm-mie__ord { grid-area:ord; display:flex; align-items:center; gap:2px; }
.adm-mie__ordbtn { padding:2px 6px; }
.adm-mie__ordbtn:disabled { opacity:.35; }
.adm-mie__pos { font-size:11px; font-weight:800; min-width:20px; text-align:center; color:var(--accent-hover); }
.adm-mie__row > .adm-thumb { grid-area:thumb; }
.adm-mie__url { grid-area:url; min-width:0; }
.adm-mie__alt { grid-area:alt; min-width:0; }
.adm-mie__acts { grid-area:acts; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
@media (max-width:700px){
  /* Tarjeta apilada: url y alt a lo ancho, acciones abajo. */
  .adm-mie__row { grid-template-columns:auto auto minmax(0,1fr); grid-template-areas:"ord thumb url" "ord thumb alt" "ord thumb acts"; align-items:start; row-gap:6px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--r-sm); padding:8px; }
  .adm-mie__ord { flex-direction:column; gap:4px; }
}

/* ---- medidas de la familia: header del accordion + form agregar ---- */
.adm-acc { border:1px solid var(--border); border-radius:9px; overflow:hidden; background:var(--surface); }
.adm-acc__head { display:flex; align-items:stretch; background:var(--surface-2); }
.adm-acc__toggle { flex:1; min-width:0; display:flex; align-items:center; gap:10px; padding:9px 12px; background:transparent; border:none; color:var(--text); cursor:pointer; text-align:left; font-family:inherit; }
.adm-acc__name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:700; font-size:13px; }
.adm-acc__muted { color:var(--text-3); font-weight:400; }
.adm-acc__count { font-size:11.5px; color:var(--text-3); white-space:nowrap; flex:0 0 auto; }
.adm-acc__caret { color:var(--text-3); flex:0 0 auto; }
.adm-acc__del { flex:0 0 auto; padding:0 12px; background:transparent; border:none; border-left:1px solid var(--border); color:var(--danger,#e5484d); cursor:pointer; font-size:14px; }
.adm-acc__del:hover { background:var(--danger-soft); }
.adm-acc__body { padding:0 12px 6px; }
.adm-addmedida { margin-top:12px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.adm-addmedida__fmt { width:150px; flex:0 0 auto; }
.adm-addmedida__price { display:flex; align-items:center; gap:4px; flex:0 0 auto; }
.adm-addmedida__price > .adm-input { width:110px; }
.adm-addmedida__cur { font-size:13px; color:var(--text-3); }
@media (max-width:700px){
  .adm-addmedida__fmt { flex:1 1 140px; width:auto; }
  .adm-addmedida__price { flex:1 1 120px; }
  .adm-addmedida__price > .adm-input { width:100%; flex:1; }
  .adm-acc__count { display:none; } /* en pantallas chicas gana el nombre */
}

/* ---- touch: sin hover no hay acciones ocultas ---- */
@media (hover:none){
  .adm-tile__acts { opacity:1; }
}

/* ---- search ---- */
.adm-search { position:relative; }
.adm-search .adm-input { padding-left:36px; }
.adm-search__i { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-3); pointer-events:none; display:flex; }

/* ---- alerts ---- */
.adm-alert { padding:11px 14px; border-radius:var(--r-sm); font-size:13px; line-height:1.5; }
.adm-alert--err { background:var(--danger-soft); color:var(--danger-ink); border:1px solid var(--danger-border); }
.adm-alert--ok { background:var(--accent-soft); color:var(--accent-hover); border:1px solid var(--accent-border); }
.adm-alert--info { background:#eef4fb; color:#1d4e89; border:1px solid #cfe0f2; }

/* ---- toolbar / layout ---- */
.adm-toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.adm-spread { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.adm-empty { text-align:center; padding:48px 20px; color:var(--text-2); }
.adm-empty__ic { font-size:34px; margin-bottom:10px; }

/* ---- full-screen editor (Tiendanube-style) ---- */
.adm-editor { position:fixed; inset:0; z-index:9000; background:var(--bg); display:flex; flex-direction:column; }
.adm-editor__top { position:sticky; top:0; z-index:5; display:flex; align-items:center; gap:12px; padding:11px 18px; background:rgba(255,255,255,.88); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); border-bottom:1px solid var(--border); }
.adm-editor__title { font-size:15px; font-weight:800; letter-spacing:-.01em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.adm-editor__scroll { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; }
.adm-editor__wrap { max-width:1060px; margin:0 auto; padding:22px 20px 96px; display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:20px; align-items:start; }
.adm-editor__main { display:flex; flex-direction:column; gap:16px; min-width:0; }
.adm-editor__side { display:flex; flex-direction:column; gap:16px; position:sticky; top:74px; }
@media (max-width:880px){
  .adm-editor__wrap { grid-template-columns:1fr; padding-bottom:80px; }
  .adm-editor__side { position:static; }
}
/* Mobile: la barra sticky del editor no entra en una fila (390px) y "Guardar
   cambios" quedaba cortado fuera de pantalla. Título arriba a fila completa,
   acciones abajo; "Cerrar" se oculta (duplica a "← Volver"). */
@media (max-width:700px){
  .adm-editor__top { flex-wrap:wrap; row-gap:8px; padding:10px 12px; }
  .adm-editor__title { order:-1; flex:1 1 100%; }
  .adm-editor__top .adm-hide-mobile { display:none; }
}

/* ---- mobile ----
   iOS Safari hace ZOOM automático al enfocar cualquier campo con fuente
   menor a 16px, y esa pantalla agrandada y corrida es el "no me deja
   moverme para editar" clásico. En táctil los campos van a 16px. */
@media (max-width:700px){
  .adm-input, .adm-textarea, .adm-select { font-size:16px; }
  .adm-only-desktop { display:none !important; }
}

/* ---- lista de tarjetas: la cara mobile de una tabla ----
   Una tabla ancha en el celu esconde las acciones tras un scroll horizontal
   que nadie descubre. En pantallas chicas se muestra esta lista en su lugar
   (la tabla lleva .adm-only-desktop y la lista sólo existe bajo 700px). */
.adm-cardlist { display:none; }
@media (max-width:700px){
  .adm-cardlist { display:flex; flex-direction:column; gap:10px; }
}
.adm-icard { border:1px solid var(--border); border-radius:var(--r-sm); background:var(--surface); padding:12px; display:flex; flex-direction:column; gap:10px; box-shadow:var(--sh-sm); }
.adm-icard__top { display:flex; gap:12px; align-items:center; min-width:0; }
.adm-icard__body { flex:1; min-width:0; }
.adm-icard__name { font-weight:800; font-size:14px; }
.adm-icard__desc { font-size:12px; color:var(--text-2); margin-top:1px; overflow:hidden; text-overflow:ellipsis; }
.adm-icard__meta { display:flex; flex-wrap:wrap; gap:6px; align-items:center; font-size:12px; color:var(--text-2); }
.adm-icard__acts { display:flex; gap:8px; }
.adm-icard__acts > .adm-btn { flex:1; }
`;

let injected = false;
export function useAdmCss() {
  useEffect(() => {
    if (injected || document.getElementById("adm-css")) { injected = true; return; }
    const s = document.createElement("style");
    s.id = "adm-css";
    s.textContent = CSS;
    document.head.appendChild(s);
    injected = true;
  }, []);
}

const cx = (...a) => a.filter(Boolean).join(" ");

export function Btn({ variant = "default", size, className, children, ...rest }) {
  return (
    <button {...rest} className={cx("adm-btn", `adm-btn--${variant}`, size && `adm-btn--${size}`, className)}>
      {children}
    </button>
  );
}

export function Card({ title, hint, right, icon, children, bodyStyle, className }) {
  return (
    <section className={cx("adm-card", className)}>
      {(title || right) && (
        <header className="adm-card__hd">
          <div>
            <div className="adm-card__t">{icon}{title}</div>
            {hint && <div className="adm-card__h">{hint}</div>}
          </div>
          {right}
        </header>
      )}
      <div className="adm-card__bd" style={bodyStyle}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, style }) {
  return (
    <div className="adm-field" style={style}>
      {label && <label className="adm-label">{label}</label>}
      {children}
      {hint && <div className="adm-help">{hint}</div>}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="adm-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="adm-switch__track" />
      {(label || hint) && (
        <span className="adm-switch__lab">
          {label && <span className="adm-switch__t">{label}</span>}
          {hint && <span className="adm-switch__h">{hint}</span>}
        </span>
      )}
    </label>
  );
}

export function Badge({ tone = "muted", children }) {
  return <span className={cx("adm-badge", `adm-badge--${tone}`)}>{children}</span>;
}
