"use strict";

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || "";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-opus-4-7";

async function askClaude({ system, messages, max_tokens = 1024, model = DEFAULT_MODEL, temperature } = {}) {
  if (!ANTHROPIC_KEY) {
    throw new Error("ANTHROPIC_KEY no configurada en el entorno");
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("askClaude: messages debe ser un array no vacío");
  }

  const body = { model, max_tokens, messages };
  if (system) body.system = system;
  if (typeof temperature === "number") body.temperature = temperature;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const detail = data?.error?.message || JSON.stringify(data).slice(0, 300);
    throw new Error(`Claude API error ${res.status}: ${detail}`);
  }

  const text = (data.content || [])
    .filter(b => b?.type === "text" && typeof b.text === "string")
    .map(b => b.text)
    .join("")
    .trim();

  return {
    text,
    raw: data,
    stop_reason: data.stop_reason,
    usage: data.usage,
  };
}

module.exports = { askClaude, DEFAULT_MODEL };
