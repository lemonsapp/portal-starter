"use strict";

// One-shot: traduce name+description+category de cada SKILL.md al español argentino
// y guarda el output en server/clawfu-skills/translations_es.json.
//
// Uso:
//   ANTHROPIC_KEY=<key> node scripts/translate-skills-es.js
//
// El JSON resultante se commitea al repo. Backend lo lee lazy en lib/clawfu.js (no se
// traduce en runtime). Si querés re-traducir (cambió la lista de skills, mejor modelo,
// etc.), corré el script otra vez y se sobreescribe el JSON.

const fs = require("fs");
const path = require("path");

// Carga simple de .env sin dep externa (server/.env tiene ANTHROPIC_KEY)
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

const { listSkills } = require(path.join(__dirname, "..", "server", "lib", "clawfu"));

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
if (!ANTHROPIC_KEY) {
  console.error("[translate] ANTHROPIC_KEY no seteada (revisá server/.env o exportala en la shell)");
  process.exit(1);
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const BATCH_SIZE = 25;
const MAX_RETRIES = 2;

// Pricing aprox Sonnet 4.6 (USD per million tokens) — solo para reporte de costo aproximado
const PRICE_IN = 3.0;
const PRICE_OUT = 15.0;

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
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Claude HTTP ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }
  const text = data.content?.[0]?.text || "";
  return { text, usage: data.usage || {} };
}

const SYSTEM_PROMPT = `Sos traductor profesional ES-AR especializado en marketing y copywriting.

Reglas estrictas:
- Traducí al español argentino (usá "vos", no "tú").
- MANTENÉ sin traducir: nombres propios (Schwartz, Dunford, Cialdini, Ogilvy, Brunson, Ries, Trout, Heath, Kennedy, Hopkins, Halbert, etc.), siglas/conceptos canónicos (CTR, CTA, ROI, ROAS, AIDA, PAS, FAB, ICP, BANT, MEDDIC, JTBD, KPI, OKR, CAC, LTV, CRO, SEO, SEM, UGC, CPM, CPC, A/B, e-commerce, landing page, funnel, copy, brief, storytelling, lead, headline, hook).
- Para frameworks/skills con nombre propio (ej. "expert-secrets", "schwartz-awareness"), mantené el nombre original O usá la versión española natural si existe (ej. "expert-secrets" → "Expert Secrets"; "six-thinking-hats" → "Seis sombreros para pensar").
- Las descriptions suelen empezar con "Use when:" o similar — traducilo a "Usalo cuando:" preservando el resto.
- Las categorías son palabras simples: content→Contenido, strategy→Estrategia, acquisition→Adquisición, funnels→Funnels, branding→Branding, growth→Growth, sales→Ventas, social→Social, analytics→Analytics, validation→Validación, copy→Copy, etc.
- Devolvé SOLO JSON válido (un array de objetos), sin markdown, sin explicaciones, sin texto antes ni después del JSON.`;

async function translateBatch(batch, attempt = 1) {
  const userPrompt = `Para cada item del array INPUT, devolvé un objeto en OUTPUT con exactamente estos 3 campos: name_es, description_es, category_es. El array OUTPUT debe tener el mismo length y mismo orden que INPUT.

INPUT:
${JSON.stringify(batch, null, 2)}

OUTPUT (solo JSON array, mismo length que INPUT):`;
  try {
    const { text, usage } = await callClaude(SYSTEM_PROMPT, userPrompt);
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) throw new Error("Sin JSON array en respuesta de Claude");
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) throw new Error("La respuesta no es array");
    if (arr.length !== batch.length) {
      throw new Error(`Length mismatch: esperaba ${batch.length}, obtuve ${arr.length}`);
    }
    return { arr, usage };
  } catch (e) {
    if (attempt > MAX_RETRIES) throw e;
    console.log(`  ⚠ retry ${attempt}/${MAX_RETRIES}: ${e.message.slice(0, 160)}`);
    await new Promise(r => setTimeout(r, 1500 * attempt));
    return translateBatch(batch, attempt + 1);
  }
}

(async () => {
  const all = listSkills(); // [{ name, category, description }, ...]
  if (!all.length) {
    console.error("[translate] listSkills() devolvió 0 — abortando");
    process.exit(1);
  }
  const totalBatches = Math.ceil(all.length / BATCH_SIZE);
  console.log(`[translate] ${all.length} skills · batches de ${BATCH_SIZE} · ${totalBatches} batches totales`);
  console.log(`[translate] modelo: ${MODEL}`);

  const skillsMap = {};
  let totalIn = 0, totalOut = 0;

  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    const batch = all.slice(i, i + BATCH_SIZE);
    const idx = Math.floor(i / BATCH_SIZE) + 1;
    process.stdout.write(`[translate] batch ${idx}/${totalBatches} (${batch.length} items)… `);
    const t0 = Date.now();
    const { arr, usage } = await translateBatch(batch);
    totalIn += usage?.input_tokens || 0;
    totalOut += usage?.output_tokens || 0;
    for (let j = 0; j < batch.length; j++) {
      const orig = batch[j];
      const tr = arr[j] || {};
      skillsMap[orig.name] = {
        name_es: tr.name_es || orig.name,
        description_es: tr.description_es || orig.description,
        category_es: tr.category_es || orig.category,
      };
    }
    console.log(`✓ ${(Date.now() - t0)}ms (in:${usage?.input_tokens || 0} out:${usage?.output_tokens || 0})`);
  }

  // Construir mapping de categorías canónico tomando la primera traducción que aparezca
  // de cada categoría única.
  const categories = {};
  for (const s of all) {
    const cat = (s.category || "").replace(/^skills\//, "");
    if (cat && !categories[cat]) {
      const trCat = skillsMap[s.name]?.category_es || cat;
      categories[cat] = String(trCat).replace(/^skills\//i, "").trim();
    }
  }

  const out = {
    version: 1,
    generated_at: new Date().toISOString(),
    model: MODEL,
    source_skills_count: all.length,
    skills: skillsMap,
    categories,
  };

  const outPath = path.join(__dirname, "..", "server", "clawfu-skills", "translations_es.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  const stat = fs.statSync(outPath);

  const costIn = (totalIn * PRICE_IN) / 1_000_000;
  const costOut = (totalOut * PRICE_OUT) / 1_000_000;

  console.log("");
  console.log(`✅ ${Object.keys(skillsMap).length} skills traducidos guardados en ${outPath}`);
  console.log(`   Tamaño JSON: ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`   Tokens input: ${totalIn.toLocaleString()} | output: ${totalOut.toLocaleString()}`);
  console.log(`   Costo aprox (${MODEL}): $${(costIn + costOut).toFixed(4)} USD (input $${costIn.toFixed(4)} + output $${costOut.toFixed(4)})`);
})().catch(e => {
  console.error("");
  console.error("[translate] FATAL:", e.message);
  if (e.stack) console.error(e.stack.split("\n").slice(0, 5).join("\n"));
  process.exit(1);
});
