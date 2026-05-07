"use strict";

// One-shot fix-up para translations_es.json:
// 1) Limpia prefix "Skills/" / "skills/" en cada category_es.
// 2) Detecta skills donde name_es === name (slug sin traducir) y los re-traduce con un prompt más directo.
// 3) Mergea y reescribe el JSON.
//
// Uso:
//   ANTHROPIC_KEY=<key> node scripts/translate-skills-es-fix.js

const fs = require("fs");
const path = require("path");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
loadEnv(path.join(__dirname, "..", "server", ".env"));
loadEnv(path.join(__dirname, "..", ".env"));

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
if (!ANTHROPIC_KEY) { console.error("ANTHROPIC_KEY no seteada"); process.exit(1); }

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const BATCH_SIZE = 30;
const MAX_RETRIES = 2;
const PRICE_IN = 3.0;
const PRICE_OUT = 15.0;

const JSON_PATH = path.join(__dirname, "..", "server", "clawfu-skills", "translations_es.json");

async function callClaude(systemPrompt, userPrompt) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude HTTP ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  return { text: data.content?.[0]?.text || "", usage: data.usage || {} };
}

const SYSTEM_PROMPT = `Traducí los siguientes nombres de skills de marketing al español argentino natural.

Reglas estrictas:
- SIEMPRE devolvé un nombre en español, NUNCA el slug original (no devuelvas "grand-slam-offers" si te lo pasan; devolvé "Ofertas irresistibles (Hormozi)" o algo similar).
- Mantené sin traducir solo nombres propios canónicos cuando sean parte del nombre del framework: Schwartz, Dunford, Cialdini, Brunson, Hormozi, Ogilvy, de Bono, Heath, Kennedy, Hopkins, Halbert, Ries, Trout, Godin, Drucker, Drucker, Christensen, Sinek, Maurya, Patel, Zappos.
- Mantené siglas/conceptos canónicos: AIDA, PAS, FAB, JTBD, CTA, ROI, ROAS, ICP, SEO, SEM, CRO, KPI, OKR, CAC, LTV, BANT, MEDDIC, A/B, e-commerce, funnel, copy, headline, hook, brief, lead, MRR, CAC, LTV.
- El nombre debe ser legible para un argentino. Ejemplos:
  · "grand-slam-offers" → "Ofertas irresistibles (Hormozi)"
  · "copywriting-awareness" → "Niveles de Conciencia (Schwartz)"
  · "ad-spend-optimizer" → "Optimizador de gasto publicitario"
  · "sales-narrative" → "Narrativa de ventas"
  · "purple-cow-marketing" → "Vaca Púrpura (Godin)"
- Devolvé SOLO JSON puro (array de objetos), sin markdown, sin texto antes ni después.`;

async function translateBatch(items, attempt = 1) {
  const userPrompt = `Para cada item del array INPUT, devolvé un objeto en OUTPUT con exactamente estos 2 campos: original_name (idéntico al del input), name_es (el nombre traducido al español natural — NUNCA devuelvas el slug, siempre un nombre legible).

INPUT:
${JSON.stringify(items, null, 2)}

OUTPUT (solo JSON array, mismo length):`;
  try {
    const { text, usage } = await callClaude(SYSTEM_PROMPT, userPrompt);
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) throw new Error("Sin JSON array en respuesta");
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr) || arr.length !== items.length) {
      throw new Error(`Length mismatch: esperaba ${items.length}, obtuve ${arr?.length}`);
    }
    return { arr, usage };
  } catch (e) {
    if (attempt > MAX_RETRIES) throw e;
    console.log(`  ⚠ retry ${attempt}/${MAX_RETRIES}: ${e.message.slice(0, 160)}`);
    await new Promise(r => setTimeout(r, 1500 * attempt));
    return translateBatch(items, attempt + 1);
  }
}

(async () => {
  // 1. Cargar JSON existente
  if (!fs.existsSync(JSON_PATH)) { console.error("translations_es.json no existe"); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  const original = JSON.parse(JSON.stringify(data)); // deep clone para diff

  // 2. Limpiar prefix Skills/ en cada category_es
  let cleanedCount = 0;
  for (const [k, v] of Object.entries(data.skills)) {
    const cleaned = String(v.category_es || "").replace(/^skills\//i, "").trim();
    if (cleaned !== v.category_es) {
      v.category_es = cleaned;
      cleanedCount++;
    }
  }
  console.log(`[fix] prefix "Skills/" limpiado en ${cleanedCount} category_es`);

  // 3. Detectar slugs sin traducir
  const slugOnly = [];
  for (const [name, t] of Object.entries(data.skills)) {
    if (t.name_es === name) slugOnly.push({ name, description: t.description_es || "", category: t.category_es || "" });
  }
  console.log(`[fix] ${slugOnly.length} skills con name_es === slug original — re-traduciendo`);

  if (slugOnly.length === 0) {
    fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), "utf8");
    console.log("✅ Solo limpieza de prefix, JSON guardado");
    process.exit(0);
  }

  // 4. Re-run en batches
  const totalBatches = Math.ceil(slugOnly.length / BATCH_SIZE);
  let totalIn = 0, totalOut = 0;
  let updatedCount = 0;
  const samples = []; // para reporte

  for (let i = 0; i < slugOnly.length; i += BATCH_SIZE) {
    const batch = slugOnly.slice(i, i + BATCH_SIZE);
    const idx = Math.floor(i / BATCH_SIZE) + 1;
    process.stdout.write(`[fix] batch ${idx}/${totalBatches} (${batch.length} items)… `);
    const t0 = Date.now();
    // pasar al modelo solo lo necesario: original_name + un context corto
    const items = batch.map(s => ({ original_name: s.name, hint_category: s.category }));
    const { arr, usage } = await translateBatch(items);
    totalIn += usage?.input_tokens || 0;
    totalOut += usage?.output_tokens || 0;
    for (const r of arr) {
      const orig = r.original_name;
      if (data.skills[orig] && r.name_es && r.name_es !== orig) {
        data.skills[orig].name_es = String(r.name_es).trim();
        updatedCount++;
        if (samples.length < 5 && Math.random() < 0.5) {
          samples.push({ original: orig, name_es: data.skills[orig].name_es });
        }
      }
    }
    console.log(`✓ ${(Date.now() - t0)}ms (in:${usage?.input_tokens || 0} out:${usage?.output_tokens || 0})`);
  }

  // 5. Bump version + timestamp
  data.version = (data.version || 1) + 1;
  data.generated_at = new Date().toISOString();
  data.fix_applied = "v1: clean Skills/ prefix + re-translate slug-only names";

  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), "utf8");
  const stat = fs.statSync(JSON_PATH);

  // Si nos faltan samples, completar con los primeros
  if (samples.length < 5) {
    const extras = slugOnly.slice(0, 10).filter(s => !samples.find(x => x.original === s.name));
    for (const s of extras) {
      if (samples.length >= 5) break;
      const newName = data.skills[s.name].name_es;
      if (newName !== s.name) samples.push({ original: s.name, name_es: newName });
    }
  }

  // Counts finales
  const remainingSlugOnly = Object.entries(data.skills).filter(([k, v]) => v.name_es === k).length;
  const remainingSkillsPrefix = Object.values(data.skills).filter(v => /^skills\//i.test(v.category_es || "")).length;

  console.log("");
  console.log(`✅ Re-run completo`);
  console.log(`   Nombres re-traducidos OK: ${updatedCount}/${slugOnly.length}`);
  console.log(`   Nombres todavía como slug (residuales): ${remainingSlugOnly}`);
  console.log(`   Categorías con prefix "Skills/" residuales: ${remainingSkillsPrefix}`);
  console.log(`   Tamaño final JSON: ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`   Tokens input: ${totalIn.toLocaleString()} | output: ${totalOut.toLocaleString()}`);
  const cost = (totalIn * PRICE_IN + totalOut * PRICE_OUT) / 1_000_000;
  console.log(`   Costo aprox: $${cost.toFixed(4)} USD`);
  console.log("");
  console.log("=== Samples (5) ===");
  for (const s of samples.slice(0, 5)) {
    console.log(`   "${s.original}" → "${s.name_es}"`);
  }
})().catch(e => {
  console.error("[fix] FATAL:", e.message);
  process.exit(1);
});
