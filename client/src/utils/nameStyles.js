// Utilidades compartidas de estilos de nombre
export function buildNameStyle(u) {
  if (u?.name_grad_from && u?.name_grad_to)
    return {
      background: `linear-gradient(90deg,${u.name_grad_from},${u.name_grad_to})`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    };
  const role = u?.role || u?.user_role;
  const isStaff = ["admin","operator"].includes(role);
  // Admin → rojo · Operator → naranja · default → lemon
  const fallback = role === "admin" ? "#ef4444" : role === "operator" ? "#fb923c" : "var(--brand-primary, #f5e03a)";
  const color = u?.name_color || fallback;
  const style = { color };
  if (u?.name_glow) style.textShadow = `0 0 ${u.name_glow}px ${u.name_glow_color || color}`;
  return style;
}

export function buildNickStyle(u) {
  const color = u?.nick_color || "#666";
  const style = { color };
  if (u?.nick_glow) style.textShadow = `0 0 ${u.nick_glow}px ${u.nick_glow_color || color}`;
  return style;
}

export function getAvatarEmoji(avatarKey) {
  const map = {
    avatar_lemon: "🪙", avatar_rocket: "🚀", avatar_globe: "🌍",
    avatar_diamond: "💎", avatar_fire: "🔥", avatar_crown: "👑", avatar_lemon_fly: "🪙",
  };
  return map[avatarKey] || "🪙";
}

export function getAvatarBg(avatarKey) {
  const map = {
    avatar_lemon: "var(--brand-primary, #f5e03a)", avatar_rocket: "#3b82f6", avatar_globe: "#22c55e",
    avatar_diamond: "#a78bfa", avatar_fire: "var(--brand-accent, #ff5500)", avatar_crown: "var(--brand-primary, #f5e03a)", avatar_lemon_fly: "var(--brand-primary, #f5e03a)",
  };
  return map[avatarKey] || "var(--brand-primary, #f5e03a)";
}
