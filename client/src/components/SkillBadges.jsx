// Renderiza badges de skills usados (output de /generate-skill-driven o /generate-ad-creative).
// Hover muestra description.

const CATEGORY_ICONS = {
  content: "✍️",
  strategy: "📐",
  acquisition: "🎯",
  funnels: "🌪️",
  branding: "🎨",
  growth: "📈",
  sales: "💼",
  social: "📣",
  seo: "🔍",
  analytics: "📊",
  validation: "🧪",
};

function iconFor(category) {
  const c = String(category || "").toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_ICONS)) {
    if (c.includes(k)) return v;
  }
  return "⚡";
}

function shortCategory(category) {
  const parts = String(category || "").split("/");
  return parts[parts.length - 1] || category || "";
}

export default function SkillBadges({ skills, dim = false }) {
  if (!skills?.length) {
    return (
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>
        Sin frameworks específicos — Claude generó solo con el system prompt base.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {skills.map((s, i) => {
        const displayName = s.name_es || s.name;
        const displayDesc = s.description_es || s.description;
        const displayCat = s.category_es || s.category;
        return (
          <span
            key={`${s.name}-${i}`}
            title={displayDesc || displayName}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: 999,
              background: dim ? "rgba(245,224,58,0.06)" : "rgba(245,224,58,0.12)",
              border: "1px solid rgba(245,224,58,0.25)",
              color: dim ? "rgba(245,224,58,0.7)" : "#f5e03a",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "'DM Mono', monospace",
              letterSpacing: "0.3px",
              cursor: "help",
              maxWidth: 280,
            }}
          >
            <span style={{ fontSize: 13 }}>{iconFor(displayCat)}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName}
            </span>
            <span style={{ opacity: 0.55, fontSize: 10 }}>· {shortCategory(displayCat)}</span>
          </span>
        );
      })}
    </div>
  );
}
