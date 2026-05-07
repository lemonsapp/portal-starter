"use strict";

const cron = require("node-cron");
const db = require("../db");
const { askClaude } = require("../lib/claude");
const { ensureTables } = require("../routes/instagram-content");

const STORY_TEMPLATES = [
  { id: "tip_dia",          name: "Tip del día",            focus: "un tip útil de logística internacional, accionable, que el seguidor pueda aplicar mañana" },
  { id: "ruta_cn",          name: "Ruta destacada China",   focus: "destacar el courier desde China: tiempos 15-25 días, qué tipo de productos conviene, mito común desmentido" },
  { id: "ruta_us",          name: "Ruta destacada USA",     focus: "destacar el courier desde USA/Miami: tiempos 7-12 días, ventajas, qué se compra mucho" },
  { id: "ruta_eu",          name: "Ruta destacada Europa",  focus: "destacar el courier desde Europa: tiempos 10-18 días, productos típicos, particularidades" },
  { id: "faq_aduana",       name: "FAQ aduana",             focus: "una pregunta frecuente sobre aduana argentina (CUIT, IVA importación, montos, declaración) con respuesta corta y clara" },
  { id: "error_frecuente",  name: "Error frecuente",        focus: "un error común que cometen los emprendedores al importar por primera vez y cómo evitarlo" },
  { id: "comparativa",      name: "Comparativa rápida",     focus: "comparar dos opciones (ej: courier vs envío oficial, comprar en Amazon vs AliExpress, etc) en pros/cons cortos" },
];

function dayOfYear(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function pickTemplate(override) {
  if (override) {
    const t = STORY_TEMPLATES.find(x => x.id === override);
    if (t) return t;
  }
  const idx = dayOfYear() % STORY_TEMPLATES.length;
  return STORY_TEMPLATES[idx];
}

function buildSystemPrompt(template) {
  return `Sos un community manager senior de @lemonsarg (Lemons Logística Internacional, courier desde China, USA y Europa para emprendedores e importadores argentinos).

Generás UNA story de Instagram en formato vertical (9:16). Las stories son efímeras (24h), casuales, llamativas, con texto corto sobre fondo limpio. Buscan: enseñar algo concreto en 5 segundos, generar interacción (poll, pregunta, sticker), o destacar un servicio.

Tono: argentino, voseo, cercano, directo. Sin clichés. Datos concretos > frases huecas.

Plantilla del día: ${template.name}.
Foco específico: ${template.focus}.

Reglas:
- caption es el texto que va EN la story (no debajo, va sobre la imagen). Máximo 80 caracteres porque es story. Letra grande, frase corta, impactante.
- hook es para uso interno (no se publica), una frase de 1 línea que resume el ángulo elegido.
- hashtags 3-5 separados por espacios sin #. Las stories no muestran hashtags visibles igual, pero los guardamos por consistencia.
- visual_brief: instrucciones para el diseñador. Especificá: qué se ve de fondo (foto/color/textura), qué texto en pantalla y dónde, si lleva sticker (poll/quiz/pregunta), duración si es video. 3-5 oraciones.
- NO inventes precios concretos. Tiempos en rangos.

Devolvé EXACTAMENTE este JSON, sin nada antes ni después:
{
  "hook": "string corto",
  "caption": "string MUY corto (≤80 chars)",
  "hashtags": "tag1 tag2 tag3",
  "visual_brief": "string 3-5 oraciones para el diseñador"
}`;
}

function extractJson(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
}

function validateStory(parsed) {
  if (!parsed || typeof parsed !== "object") throw new Error("respuesta no es objeto");
  if (typeof parsed.caption !== "string" || !parsed.caption.trim()) throw new Error("caption faltante");
  if (typeof parsed.visual_brief !== "string" || !parsed.visual_brief.trim()) throw new Error("visual_brief faltante");
  return parsed;
}

async function callClaude(template, extraInstruction = "") {
  const userMsg = extraInstruction
    ? `Generá la story ahora. Devolvé únicamente el JSON.\n\n${extraInstruction}`
    : "Generá la story ahora. Devolvé únicamente el JSON.";
  const { text } = await askClaude({
    system: buildSystemPrompt(template),
    messages: [{ role: "user", content: userMsg }],
    max_tokens: 1024,
  });
  return text;
}

async function generateDailyStory({ trigger = "cron", templateOverride = null } = {}) {
  if (!process.env.ANTHROPIC_KEY) {
    throw new Error("ANTHROPIC_KEY no configurada — no se puede generar story");
  }
  await ensureTables();

  const template = pickTemplate(templateOverride);

  let raw = await callClaude(template);
  let parsed = extractJson(raw);
  let story = null;
  try {
    story = validateStory(parsed);
  } catch (firstErr) {
    console.warn("[IG-STORIES] primer intento falló:", firstErr.message, "— reintentando");
    raw = await callClaude(template, "El intento anterior no devolvió JSON válido. Devolvé sólo el JSON con hook, caption (≤80 chars), hashtags y visual_brief.");
    parsed = extractJson(raw);
    story = validateStory(parsed);
  }

  const today = new Date();
  const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const batchId = `story_${yyyymmdd}`;

  const ins = await db.query(
    `INSERT INTO ig_content_ideas (kind, hook, caption, hashtags, script, visual_brief, status, batch_id)
     VALUES ('story', $1, $2, $3, NULL, $4, 'draft', $5)
     RETURNING id`,
    [
      typeof story.hook === "string" ? story.hook : null,
      story.caption.trim(),
      typeof story.hashtags === "string" ? story.hashtags.trim() : null,
      story.visual_brief.trim(),
      batchId,
    ]
  );

  const ideaId = ins.rows[0]?.id;
  console.log(`[IG-STORIES] story creada idea_id=${ideaId} template=${template.id} batch=${batchId} trigger=${trigger}`);
  return { idea_id: ideaId, template_id: template.id, template_name: template.name, batch_id: batchId };
}

let cronTask = null;
function startStoriesCron() {
  if (cronTask) return cronTask;
  cronTask = cron.schedule(
    "0 11 * * *",
    async () => {
      try {
        const out = await generateDailyStory({ trigger: "cron" });
        console.log("[IG-STORIES cron] OK", out);
      } catch (e) {
        console.error("[IG-STORIES cron ERROR]", e.message);
      }
    },
    { timezone: "America/Argentina/Buenos_Aires" }
  );
  return cronTask;
}

module.exports = {
  STORY_TEMPLATES,
  generateDailyStory,
  startStoriesCron,
};
