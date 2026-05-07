"use strict";

const fs = require("fs");
const path = require("path");

const SKILLS_DIR = path.join(__dirname, "..", "clawfu-skills");
const TRANSLATIONS_PATH = path.join(SKILLS_DIR, "translations_es.json");

let _cache = null;
let _translations = null; // lazy load
let _translationsLoaded = false;

function _loadTranslations() {
  if (_translationsLoaded) return _translations;
  _translationsLoaded = true;
  try {
    if (fs.existsSync(TRANSLATIONS_PATH)) {
      const raw = fs.readFileSync(TRANSLATIONS_PATH, "utf8");
      _translations = JSON.parse(raw);
      const count = Object.keys(_translations?.skills || {}).length;
      console.log(`[clawfu] traducciones cargadas: ${count} skills (v${_translations?.version || "?"})`);
    } else {
      console.log("[clawfu] translations_es.json no encontrado — sin soporte ES");
    }
  } catch (e) {
    console.error("[clawfu] error cargando translations:", e.message);
    _translations = null;
  }
  return _translations;
}

function _withLang(skill, lang) {
  if (lang !== "es") return skill;
  const t = _loadTranslations();
  const tr = t?.skills?.[skill.name];
  if (!tr) return skill;
  return {
    ...skill,
    name_es: tr.name_es || skill.name,
    description_es: tr.description_es || skill.description,
    category_es: tr.category_es || skill.category,
  };
}

function _scanAll() {
  if (_cache) return _cache;
  const skills = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "SKILL.md") {
        try {
          const raw = fs.readFileSync(full, "utf8");
          const fm = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
          if (!fm) continue;
          const meta = {};
          for (const line of fm[1].split("\n")) {
            const m = line.match(/^(\w+):\s*(.+)$/);
            if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, "");
          }
          const rel = path.relative(SKILLS_DIR, full);
          const parts = rel.split(path.sep);
          // SKILL.md vive en .../<categoria>/<skill-name>/SKILL.md → categoría = parts[parts.length-3]
          const category = parts.length >= 3 ? parts.slice(0, -2).join("/") : parts[0];
          skills.push({
            name: meta.name || path.basename(path.dirname(full)),
            description: meta.description || "",
            category,
            body: fm[2].trim(),
            path: rel,
          });
        } catch (e) { console.error("[clawfu scan]", full, e.message); }
      }
    }
  }
  walk(SKILLS_DIR);
  _cache = skills;
  console.log(`[clawfu] ${skills.length} skills cargados`);
  return _cache;
}

function listSkills(category = null, lang = null) {
  const all = _scanAll();
  const filtered = category
    ? all.filter(s => s.category.toLowerCase().includes(category.toLowerCase()))
    : all;
  return filtered.map(s => {
    const base = { name: s.name, category: s.category, description: s.description };
    return _withLang(base, lang);
  });
}

function loadSkill(name, lang = null) {
  const found = _scanAll().find(s => s.name === name);
  if (!found) return null;
  return _withLang(found, lang);
}

function findSkillsForObjective(objective, max = 5, allowedCategories = ["content", "strategy", "acquisition", "funnels", "branding", "growth", "sales"], lang = null) {
  const all = _scanAll();
  const objLower = String(objective || "").toLowerCase();
  const keywords = objLower.split(/\s+/).filter(w => w.length > 3);
  const scored = all
    .filter(s => allowedCategories.some(c => s.category.toLowerCase().includes(c)))
    .map(s => {
      const text = (s.description + " " + s.name).toLowerCase();
      let score = 0;
      for (const kw of keywords) if (text.includes(kw)) score++;
      const useWhenMatch = text.match(/use when:?(.*)/);
      if (useWhenMatch) {
        for (const kw of keywords) if (useWhenMatch[1].includes(kw)) score += 2;
      }
      return { ...s, _score: score };
    })
    .filter(s => s._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, max);
  return scored.map(s => _withLang(s, lang));
}

function buildSkillsPrompt(skills) {
  if (!skills?.length) return "";
  return `\n\n═══ FRAMEWORKS EXPERTOS DISPONIBLES ═══\n\nEstás operando con los siguientes frameworks. Aplicálos en tu output:\n\n` +
    skills.map((s, i) => `\n--- SKILL ${i+1}: ${s.name} (${s.category}) ---\n${s.body}\n`).join("\n") +
    `\n═══ FIN FRAMEWORKS ═══\n\nUsá estos frameworks como guía pero no los cites textualmente — aplicá la metodología.`;
}

module.exports = { listSkills, loadSkill, findSkillsForObjective, buildSkillsPrompt };
