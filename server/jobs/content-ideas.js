"use strict";

const crypto = require("crypto");
const cron = require("node-cron");
const db = require("../db");
const { askClaude } = require("../lib/claude");
const { ensureTables } = require("../routes/instagram-content");

const SYSTEM_PROMPT = `Sos un community manager senior especializado en logística internacional para PyMEs y emprendedores argentinos. Tu cuenta es @lemonsarg, marca: Lemons Logística Internacional, dedicada a importar productos desde China, USA y Europa.

Audiencia: emprendedores que revenden, dueños de tiendas online, importadores chicos, particulares que compran desde el exterior.

Tono: argentino, claro, directo, profesional pero cercano. Voseo. Sin clichés tipo "rompé esquemas", sin emojis excesivos (máximo 2 por caption). Datos concretos > frases motivacionales.

Formatos:
- post: imagen estática + caption educativo (200-400 chars).
- reel: video 15-30 seg con hook fuerte en los primeros 3 seg + script paso a paso.
- carousel: 4-7 slides, post-multimedia, ideal para tutoriales/comparaciones.
(Las stories las genera otro job aparte con templates específicos — NO las incluyas acá.)

Reglas:
1. NUNCA inventes precios concretos (USD/AR$). Si hablás de costo, usá rangos o decí "según producto y volumen".
2. Tiempos de envío en rangos: China 15-25 días, USA 7-12 días, Europa 10-18 días.
3. Hashtags: 5-8 por post, mix entre nicho ("importacionesarg", "couriermiamiarg", "comprasonline") y generales ("emprendedoresarg", "pymesarg").
4. Hooks útiles: pregunta directa al lector, dato sorprendente, mito común, comparación, error frecuente.
5. Cada caption termina con CTA: "DM para cotizar", "guardá este post", "etiquetá a alguien que importe".
6. Visual brief es para el diseñador/editor: describí qué se ve, color/mood, texto en pantalla.

Devolvé EXACTAMENTE un JSON válido (nada antes, nada después) con esta forma:
{
  "ideas": [
    {
      "kind": "post" | "reel" | "carousel",
      "hook": "string corto",
      "caption": "string con CTA y hashtags al final",
      "hashtags": "hashtags separados por espacios sin #",
      "script": "solo si kind=reel, paso a paso del video con timing",
      "visual_brief": "string 2-3 oraciones para diseño"
    }, ...
  ]
}

Generá EXACTAMENTE 6 ideas con este mix: 2 reels, 3 posts, 1 carousel.
Variá temas: tips logística, errores frecuentes, comparativas de rutas, tutoriales aduana, casos de éxito (sin inventar nombres), curiosidades del rubro.`;

const USER_PROMPT = `Generá las 6 ideas ahora. Devolvé únicamente el JSON, sin markdown ni texto adicional.`;

const REQUIRED_MIX = { reel: 2, post: 3, carousel: 1 };

function extractJson(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  // Quitar fences markdown si vinieran
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = s.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function validateIdeas(parsed) {
  if (!parsed || !Array.isArray(parsed.ideas)) {
    throw new Error("La respuesta no contiene un array 'ideas'");
  }
  if (parsed.ideas.length !== 6) {
    throw new Error(`Se esperaban 6 ideas, llegaron ${parsed.ideas.length}`);
  }
  const counts = { post: 0, reel: 0, carousel: 0 };
  for (const idea of parsed.ideas) {
    if (!idea || typeof idea !== "object") throw new Error("Idea inválida (no es objeto)");
    if (!["post", "reel", "carousel"].includes(idea.kind)) {
      throw new Error(`kind inválido: ${idea.kind}`);
    }
    if (typeof idea.caption !== "string" || !idea.caption.trim()) {
      throw new Error("caption faltante");
    }
    if (typeof idea.visual_brief !== "string" || !idea.visual_brief.trim()) {
      throw new Error("visual_brief faltante");
    }
    counts[idea.kind]++;
  }
  for (const [kind, expected] of Object.entries(REQUIRED_MIX)) {
    if (counts[kind] !== expected) {
      throw new Error(`Mix incorrecto: ${kind} tiene ${counts[kind]}, se esperaban ${expected}`);
    }
  }
  return parsed.ideas;
}

async function callClaudeForIdeas(extraInstruction = "") {
  const messages = [{ role: "user", content: extraInstruction ? `${USER_PROMPT}\n\n${extraInstruction}` : USER_PROMPT }];
  const { text } = await askClaude({
    system: SYSTEM_PROMPT,
    messages,
    max_tokens: 4096,
  });
  return text;
}

async function generateIdeasBatch({ trigger = "cron", userId = null } = {}) {
  if (!process.env.ANTHROPIC_KEY) {
    throw new Error("ANTHROPIC_KEY no configurada — no se puede generar ideas");
  }
  await ensureTables();

  let raw = await callClaudeForIdeas();
  let parsed = extractJson(raw);
  let ideas = null;

  try {
    ideas = validateIdeas(parsed);
  } catch (firstErr) {
    console.warn("[IG-CONTENT] primer intento falló:", firstErr.message, "— reintentando");
    raw = await callClaudeForIdeas("El intento anterior no devolvió JSON válido o no respetó el mix. Devolvé JSON válido con exactamente 6 ideas y el mix 2 reels, 3 posts, 1 carousel (sin stories).");
    parsed = extractJson(raw);
    ideas = validateIdeas(parsed);
  }

  const batchId = crypto.randomUUID();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const idea of ideas) {
      const isReel = idea.kind === "reel";
      await client.query(
        `INSERT INTO ig_content_ideas (kind, hook, caption, hashtags, script, visual_brief, status, batch_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)`,
        [
          idea.kind,
          typeof idea.hook === "string" ? idea.hook : null,
          idea.caption.trim(),
          typeof idea.hashtags === "string" ? idea.hashtags.trim() : null,
          isReel && typeof idea.script === "string" ? idea.script : null,
          idea.visual_brief.trim(),
          batchId,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  console.log(`[IG-CONTENT] batch ${batchId} insertado (trigger=${trigger}, user=${userId ?? "-"})`);
  return { batch_id: batchId, count: ideas.length };
}

let cronTask = null;
function startContentIdeasCron() {
  if (cronTask) return cronTask;
  cronTask = cron.schedule(
    "0 7 * * *",
    async () => {
      try {
        const out = await generateIdeasBatch({ trigger: "cron" });
        console.log("[IG-CONTENT cron] OK", out);
      } catch (e) {
        console.error("[IG-CONTENT cron ERROR]", e.message);
      }
    },
    { timezone: "America/Argentina/Buenos_Aires" }
  );
  return cronTask;
}

module.exports = { generateIdeasBatch, startContentIdeasCron };
