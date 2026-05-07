// UserName.jsx
import { useUser } from "../context/UserContext.jsx";
export default function UserName({
  name=null, color=null, glowColor=null, glowInt=null,
  size=16, font="barlow", weight=700, className="", style={}, own=true,
}) {
  const ctx = useUser();
  const displayName = name      ?? (own ? ctx?.displayName : "") ?? "";
  const nameColor   = color     ?? (own ? ctx?.nameColor   : "#ede9e0") ?? "#ede9e0";
  const gc          = glowColor ?? (own ? ctx?.glowColor   : null);
  const gi          = glowInt   ?? (own ? ctx?.glowInt     : 0) ?? 0;
  const ns          = own ? ctx?.nameStyle : null;
  const glow = gi > 0 && gc ? `0 0 ${gi*2}px ${gc}, 0 0 ${gi*4}px ${gc}99` : "none";
  const fontFamily = font==="bebas" ? "'Bebas Neue', sans-serif"
    : font==="mono" ? "'DM Mono', monospace"
    : "'Barlow', sans-serif";
  return (
    <span className={className} style={{
      fontFamily, fontSize:size, fontWeight:weight,
      ...(ns||{}),
      ...(ns ? {} : {color:nameColor, textShadow:glow}),
      transition:"color .3s, text-shadow .3s",
      ...style,
    }}>
      {displayName}
    </span>
  );
}
export function UserNameSmall({ name, color, glowColor, glowInt, own=true }) {
  return <UserName name={name} color={color} glowColor={glowColor} glowInt={glowInt} own={own} size={13} weight={700}/>;
}
export function UserNameHeader({ name, color, glowColor, glowInt, own=true, size=32, className="" }) {
  return <UserName name={name} color={color} glowColor={glowColor} glowInt={glowInt} own={own} size={size} weight={400} font="bebas" className={className} style={{letterSpacing:3,lineHeight:1}}/>;
}
