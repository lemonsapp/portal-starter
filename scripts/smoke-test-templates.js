// scripts/smoke-test-templates.js
// Smoke-test de templateRenderer.js. Corre todos los casos en orden y aborta al primer fallo.
// Uso: node scripts/smoke-test-templates.js
"use strict";
const fs = require("fs");
const path = require("path");
const OUT_DIR = "/tmp/templates-smoke";
fs.mkdirSync(OUT_DIR, { recursive: true });

const tr = require("../server/lib/templateRenderer");

function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); process.exit(1); }
  console.log("  ✓", msg);
}

(async () => {
  console.log("\n[Task 1] Helpers");
  // getMascotUrl: slug válido devuelve URL con transform.
  const url = tr.getMascotUrl("saludo");
  assert(typeof url === "string" && url.includes("/upload/c_limit,w_1080,f_auto,q_auto/"), "getMascotUrl('saludo') aplica transform Cloudinary");
  assert(url.endsWith("saludo.png"), "getMascotUrl('saludo') termina en saludo.png");
  // getMascotUrl: slug inexistente cae al fallback (cart) sin tirar.
  const fallback = tr.getMascotUrl("este_slug_no_existe");
  assert(typeof fallback === "string" && fallback.includes("mascot-cart.png"), "getMascotUrl(slug-inexistente) cae al cart fallback");
  // listMascots devuelve array con shape esperado.
  const list = tr.listMascots();
  assert(Array.isArray(list) && list.length === 14, "listMascots() devuelve 14 items");
  const first = list[0];
  for (const k of ["slug", "url", "thumb_url", "label", "width", "height"]) {
    assert(k in first, `listMascots()[0] tiene campo '${k}'`);
  }
  assert(first.thumb_url.includes("/upload/w_96,h_96,c_fit,f_auto,q_auto/"), "thumb_url tiene transform 96x96");

  console.log("\n[Task 2] Endpoint shape (verificación de listMascots como contrato del endpoint)");
  // El endpoint serializa listMascots() tal cual. Verificamos el shape exacto.
  const allHaveStringUrl = list.every(m => typeof m.url === "string" && m.url.startsWith("https://"));
  assert(allHaveStringUrl, "todas las URLs son https://");
  const labels = list.map(m => m.label);
  assert(labels.includes("Saludo 👋"), "label override 'Saludo 👋' presente");
  assert(labels.includes("Cupido 💘"), "label override 'Cupido 💘' presente");

  console.log("\n✅ Tasks 1-2 OK (helpers)");

  console.log("\n[Task 3] Render descuentos_pais");
  const buf1 = await tr.renderTemplate("descuentos_pais", {});
  assert(Buffer.isBuffer(buf1) && buf1.length > 5000, "descuentos_pais con defaults renderiza PNG > 5KB");
  fs.writeFileSync(`${OUT_DIR}/descuentos_pais_default.png`, buf1);
  console.log("  → /tmp/templates-smoke/descuentos_pais_default.png");

  const buf2 = await tr.renderTemplate("descuentos_pais", { mascot_id: "avion", title: "PROMO MAYO" });
  assert(Buffer.isBuffer(buf2) && buf2.length > 5000, "descuentos_pais con mascot_id=avion renderiza PNG");
  fs.writeFileSync(`${OUT_DIR}/descuentos_pais_avion.png`, buf2);
  console.log("  → /tmp/templates-smoke/descuentos_pais_avion.png");

  console.log("\n[Task 4] Render comparativa");
  const bufC = await tr.renderTemplate("comparativa", {});
  assert(Buffer.isBuffer(bufC) && bufC.length > 5000, "comparativa con defaults renderiza PNG");
  fs.writeFileSync(`${OUT_DIR}/comparativa_default.png`, bufC);
  console.log("  → /tmp/templates-smoke/comparativa_default.png");

  console.log("\n[Task 5] Render bienvenida");
  const bufB = await tr.renderTemplate("bienvenida", {});
  assert(Buffer.isBuffer(bufB) && bufB.length > 5000, "bienvenida con defaults renderiza PNG");
  fs.writeFileSync(`${OUT_DIR}/bienvenida_default.png`, bufB);
  console.log("  → /tmp/templates-smoke/bienvenida_default.png");

  console.log("\n[Task 6] Render entrega_exitosa");
  const bufE = await tr.renderTemplate("entrega_exitosa", {});
  assert(Buffer.isBuffer(bufE) && bufE.length > 5000, "entrega_exitosa con defaults renderiza PNG");
  fs.writeFileSync(`${OUT_DIR}/entrega_exitosa_default.png`, bufE);
  console.log("  → /tmp/templates-smoke/entrega_exitosa_default.png");
  console.log("\n[Task 7] Render tip_del_dia (sin mascot y con mascot)");
  const bufT1 = await tr.renderTemplate("tip_del_dia", {});
  assert(Buffer.isBuffer(bufT1) && bufT1.length > 5000, "tip_del_dia sin mascot renderiza PNG (look histórico)");
  fs.writeFileSync(`${OUT_DIR}/tip_del_dia_no_mascot.png`, bufT1);

  const bufT2 = await tr.renderTemplate("tip_del_dia", { mascot_id: "apuntando" });
  assert(Buffer.isBuffer(bufT2) && bufT2.length > 5000, "tip_del_dia con mascot_id=apuntando renderiza PNG");
  fs.writeFileSync(`${OUT_DIR}/tip_del_dia_apuntando.png`, bufT2);

  console.log("\n[Task 8] Render guia_n_pasos");
  const bufG = await tr.renderTemplate("guia_n_pasos", {});
  assert(Buffer.isBuffer(bufG) && bufG.length > 5000, "guia_n_pasos con defaults renderiza PNG");
  fs.writeFileSync(`${OUT_DIR}/guia_n_pasos_default.png`, bufG);
  // Caso real: regímenes de aduana
  const bufG2 = await tr.renderTemplate("guia_n_pasos", {
    eyebrow: "GUÍA RÁPIDA",
    title: "Regímenes de aduana",
    step1_title: "Courier",
    step1_desc: "Hasta US$ 3.000, sin trámite",
    step2_title: "Particular",
    step2_desc: "Hasta US$ 1.000 al año, sin impuestos",
    step3_title: "Comercial",
    step3_desc: "Sin tope, requiere Aduana",
    step4_title: "Equipaje",
    step4_desc: "Hasta US$ 500 sin declarar",
    mascot_id: "apuntando",
    footer: "Cualquier duda escribinos y te orientamos.",
  });
  fs.writeFileSync(`${OUT_DIR}/guia_n_pasos_aduana.png`, bufG2);
  console.log("  → /tmp/templates-smoke/guia_n_pasos_aduana.png (CASO BENCHMARK)");

  console.log("\n[Task 9] Render tarifa_post");
  const bufTar = await tr.renderTemplate("tarifa_post", {});
  assert(Buffer.isBuffer(bufTar) && bufTar.length > 5000, "tarifa_post con defaults renderiza PNG");
  fs.writeFileSync(`${OUT_DIR}/tarifa_post_default.png`, bufTar);

  console.log("\n[Task 10] Render stats_mes");
  const bufS = await tr.renderTemplate("stats_mes", {
    title: "MAYO EN NÚMEROS",
    stat1_num: "+1.200", stat1_label: "PAQUETES ENVIADOS",
    stat2_num: "98%",    stat2_label: "ENTREGAS A TIEMPO",
    stat3_num: "37",     stat3_label: "PAÍSES ALCANZADOS",
    footer: "Gracias por elegirnos cada día 🍋",
  });
  fs.writeFileSync(`${OUT_DIR}/stats_mes_mayo.png`, bufS);

  console.log("\n[Task 11] Render quote_testimonio");
  const bufQ = await tr.renderTemplate("quote_testimonio", {
    quote: "Llegó perfecto y antes de tiempo, los recomiendo a ojos cerrados.",
    author_name: "Marta G.",
    author_origin: "Cliente Buenos Aires",
  });
  fs.writeFileSync(`${OUT_DIR}/quote_testimonio_marta.png`, bufQ);
  console.log("\n[Task 12] Render hero_announcement (con y sin title_line_2)");
  const bufH1 = await tr.renderTemplate("hero_announcement", {
    eyebrow: "ATENCIÓN",
    title_line_1: "ENVÍOS",
    title_line_2: "MÁS RÁPIDOS",
    subtitle: "Reducimos los tiempos en ruta USA » AR de 18 a 12 días",
    cta: "Coordiná tu envío",
  });
  fs.writeFileSync(`${OUT_DIR}/hero_announcement_2lineas.png`, bufH1);
  const bufH2 = await tr.renderTemplate("hero_announcement", {
    eyebrow: "AVISO",
    title_line_1: "FERIADO 1° MAYO",
    title_line_2: "",
    subtitle: "No estaremos recibiendo cargas",
    cta: "Volvemos el lunes",
  });
  fs.writeFileSync(`${OUT_DIR}/hero_announcement_1linea.png`, bufH2);
})().catch(e => { console.error("CRASH:", e); process.exit(1); });
