const EFFECTS = {
  lightning: {
    css: (c) => `@keyframes lb${c.replace('#','')}{0%,100%{box-shadow:0 0 8px ${c},0 0 22px ${c}88}50%{box-shadow:0 0 4px ${c},0 0 10px ${c}44}}@keyframes lf{0%,100%{opacity:1}92%{opacity:1}93%{opacity:.3}95%{opacity:1}97%{opacity:.6}}`,
    wrap: (c) => ({ animation:`lb${c.replace('#','')} 1.6s ease-in-out infinite`, background:`linear-gradient(135deg,${c}22,${c}08)`, border:`1.5px solid ${c}70` }),
    text: (c) => ({ animation:"lf 3s linear infinite", color:c }),
    emoji: "none",
  },
  fire: {
    css: () => `@keyframes fg{0%,100%{box-shadow:0 0 8px var(--brand-accent, #ff5500)aa,0 0 20px var(--brand-accent, #ff5500)55}50%{box-shadow:0 0 16px var(--brand-accent, #ff5500)cc,0 0 32px var(--brand-accent, #ff5500)77}}@keyframes fw{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.08)}}`,
    wrap: () => ({ animation:"fg 1.8s ease-in-out infinite", background:"linear-gradient(135deg,rgba(255,85,0,.2),rgba(245,224,58,.08))", border:"1.5px solid rgba(255,85,0,.6)" }),
    text: () => ({ background:"linear-gradient(90deg,var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500))", backgroundClip:"text", WebkitBackgroundClip:"text", color:"transparent" }),
    emoji: "fw 1.5s ease-in-out infinite",
  },
  lemon_rain: {
    css: (c) => `@keyframes lr{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-4px) rotate(12deg)}}@keyframes lg${c.replace('#','')}{0%,100%{box-shadow:0 0 10px ${c}88}50%{box-shadow:0 0 18px ${c}aa}}`,
    wrap: (c) => ({ animation:`lg${c.replace('#','')} 2s ease-in-out infinite`, background:`${c}15`, border:`1.5px solid ${c}55` }),
    text: (c) => ({ color:c }),
    emoji: "lr 1.8s ease-in-out infinite",
  },
  glow: {
    css: (c) => `@keyframes glw${c.replace('#','')}{0%,100%{box-shadow:0 0 8px ${c}66,0 0 16px ${c}33}50%{box-shadow:0 0 16px ${c}99,0 0 32px ${c}55}}`,
    wrap: (c) => ({ animation:`glw${c.replace('#','')} 2s ease-in-out infinite`, background:`${c}15`, border:`1.5px solid ${c}50` }),
    text: (c) => ({ color:c }),
    emoji: "none",
  },
  pulse: {
    css: (c) => `@keyframes pu${c.replace('#','')}{0%,100%{box-shadow:0 0 0 0 ${c}00,0 0 8px ${c}44}50%{box-shadow:0 0 0 4px ${c}22,0 0 16px ${c}77}}@keyframes bk{0%,100%{opacity:1}50%{opacity:.3}}`,
    wrap: (c) => ({ animation:`pu${c.replace('#','')} 1.8s ease-in-out infinite`, background:`${c}18`, border:`1.5px solid ${c}40` }),
    text: (c) => ({ color:c }),
    emoji: "bk 2s step-start infinite",
  },
  shield: {
    css: (c) => `@keyframes sh${c.replace('#','')}{0%,100%{box-shadow:0 0 0 0 ${c}00}50%{box-shadow:0 0 0 5px ${c}22,0 0 12px ${c}55}}`,
    wrap: (c) => ({ animation:`sh${c.replace('#','')} 2s ease-in-out infinite`, background:`linear-gradient(135deg,${c}20,${c}08)`, border:`1.5px solid ${c}50` }),
    text: (c) => ({ color:c }),
    emoji: "none",
  },
  sparkle: {
    css: () => `@keyframes sp{0%,100%{box-shadow:0 0 8px var(--brand-primary, #f5e03a)55,0 0 20px var(--brand-accent, #ff5500)33}33%{box-shadow:0 0 12px #a78bfa55}66%{box-shadow:0 0 10px var(--brand-primary, #f5e03a)77}}@keyframes spr{from{transform:rotate(0)}to{transform:rotate(360deg)}}`,
    wrap: () => ({ animation:"sp 2.5s ease-in-out infinite", background:"linear-gradient(135deg,rgba(245,224,58,.15),rgba(255,85,0,.1))", border:"1.5px solid rgba(245,224,58,.45)" }),
    text: () => ({ background:"linear-gradient(90deg,var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500),var(--brand-primary, #f5e03a))", backgroundClip:"text", WebkitBackgroundClip:"text", color:"transparent" }),
    emoji: "spr 4s linear infinite",
  },
  rainbow: {
    css: () => `@keyframes rbf{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}@keyframes rbg{0%,100%{box-shadow:0 0 10px var(--brand-primary, #f5e03a)44}33%{box-shadow:0 0 10px #a78bfa44}66%{box-shadow:0 0 10px #22c55e44}}`,
    wrap: () => ({ background:"linear-gradient(270deg,var(--brand-primary, #f5e03a)22,var(--brand-accent, #ff5500)22,#a78bfa22,#60a5fa22,#22c55e22,var(--brand-primary, #f5e03a)22)", backgroundSize:"400% 400%", animation:"rbf 4s ease infinite,rbg 3s ease-in-out infinite", border:"1.5px solid rgba(245,224,58,.3)" }),
    text: () => ({ background:"linear-gradient(90deg,var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500),#a78bfa,#60a5fa,#22c55e)", backgroundClip:"text", WebkitBackgroundClip:"text", color:"transparent" }),
    emoji: "none",
  },
  glitch: {
    css: (c) => `@keyframes gg${c.replace('#','')}{0%,100%{box-shadow:0 0 8px ${c}88,-2px 0 #ff000033,2px 0 #00ffff33}50%{box-shadow:0 0 16px ${c}aa,2px 0 #ff000055,-2px 0 #00ffff55}}`,
    wrap: (c) => ({ animation:`gg${c.replace('#','')} 0.8s ease-in-out infinite`, background:`${c}10`, border:`1.5px solid ${c}60` }),
    text: (c) => ({ color:c, fontFamily:"'DM Mono',monospace" }),
    emoji: "none",
  },
  electric_frame: {
    css: (c) => `@keyframes ef${c.replace('#','')}{0%,100%{box-shadow:0 0 0 2px ${c}88,0 0 12px ${c}66}25%{box-shadow:2px 0 0 2px ${c}aa,0 0 18px ${c}88}50%{box-shadow:0 2px 0 2px ${c}88,0 0 14px ${c}66}75%{box-shadow:-2px 0 0 2px ${c}aa,0 0 20px ${c}aa}}`,
    wrap: (c) => ({ animation:`ef${c.replace('#','')} 1s ease-in-out infinite`, background:`linear-gradient(270deg,${c}22,${c}08,${c}22)`, border:`1.5px solid ${c}77` }),
    text: (c) => ({ color:c }),
    emoji: "none",
  },
};

// Efecto por defecto según rareza
const DEFAULT_EFFECT = {
  legendary: "sparkle",
  epic:      "lightning",
  rare:      "glow",
  common:    "glow",
};

export function AnimatedBadge({ badge, size="normal" }) {
  const data   = badge.data || {};
  const color  = data.color || "var(--brand-primary, #f5e03a)";
  const effect = data.effect || DEFAULT_EFFECT[badge.rarity] || "glow";
  const fx     = EFFECTS[effect] || EFFECTS.glow;
  const sm     = size === "small";

  return (
    <>
      <style>{fx.css(color)}</style>
      <div style={{
        display:"inline-flex", alignItems:"center",
        gap:sm?5:8, padding:sm?"4px 11px":"6px 16px",
        borderRadius:100, cursor:"default", userSelect:"none",
        fontFamily:"'DM Mono',monospace",
        fontSize:sm?9:11, letterSpacing:"2px", textTransform:"uppercase",
        ...fx.wrap(color),
      }}>
        <span style={{ fontSize:sm?13:17, display:"inline-block", animation:fx.emoji!=="none"?fx.emoji:"none" }}>
          {badge.emoji}
        </span>
        <span style={{ fontWeight:600, ...fx.text(color) }}>
          {badge.name}
        </span>
      </div>
    </>
  );
}

const FALLBACK_BADGES = {
  badge_creator: { key:"badge_creator", name:"CREATOR", emoji:"⚡", rarity:"legendary", data:{ color:"var(--brand-primary, #f5e03a)", animated:true, effect:"lightning" } },
  badge_mod:     { key:"badge_mod",     name:"MOD",     emoji:"🛡", rarity:"legendary", data:{ color:"#60a5fa", animated:true, effect:"shield"    } },
  badge_bot:     { key:"badge_bot",     name:"BOT",     emoji:"🤖", rarity:"legendary", data:{ color:"#a78bfa", animated:true, effect:"pulse"     } },
  badge_beta:    { key:"badge_beta",    name:"BETA",    emoji:"🧪", rarity:"legendary", data:{ color:"#22c55e", animated:true, effect:"glow"      } },
  badge_first:   { key:"badge_first",   name:"1er Envío",emoji:"🎯",rarity:"common",   data:{ color:"var(--brand-primary, #f5e03a)", animated:false                    } },
  badge_x10:     { key:"badge_x10",     name:"10 Envíos",emoji:"📦",rarity:"rare",     data:{ color:"#22c55e", animated:false                    } },
  badge_whale:   { key:"badge_whale",   name:"Ballena", emoji:"🐋", rarity:"epic",     data:{ color:"#3b82f6", animated:false                    } },
  badge_loyal:   { key:"badge_loyal",   name:"Leal",    emoji:"💛", rarity:"rare",     data:{ color:"var(--brand-primary, #f5e03a)", animated:false                    } },
};

export function BadgeRow({ badges, allItems, size="normal" }) {
  if (!badges || !badges.length) return null;
  return (
    <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
      {badges.map(bk => {
        const b = (allItems && allItems.find(i => i.key === bk)) || FALLBACK_BADGES[bk];
        if (!b) return null;
        const data = b.data || {};
        // Todas las badges especiales y raras+ van animadas
        if (data.animated || ["legendary","epic","rare"].includes(b.rarity)) {
          return <AnimatedBadge key={bk} badge={b} size={size} />;
        }
        const color = data.color || "var(--brand-primary, #f5e03a)";
        return (
          <div key={bk} style={{ fontFamily:"'DM Mono',monospace", fontSize:size==="small"?9:10, letterSpacing:"1.5px", textTransform:"uppercase", padding:size==="small"?"3px 10px":"5px 13px", borderRadius:100, background:color+"15", border:"1px solid "+color+"30", color, display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ fontSize:size==="small"?11:13 }}>{b.emoji}</span>
            {b.name}
          </div>
        );
      })}
    </div>
  );
}
