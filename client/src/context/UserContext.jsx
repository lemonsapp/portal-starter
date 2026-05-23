import { createContext, useContext, useState, useEffect, useCallback } from "react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [me,      setMe]      = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    try {
      const [meRes, profRes] = await Promise.all([
        fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/profile`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [meData, profData] = await Promise.all([meRes.json(), profRes.json()]);
      if (meRes.ok)   setMe(meData.user);
      if (profRes.ok) { setProfile(profData); setVersion(v=>v+1); }
    } catch(e) { console.error("[UserContext reload]", e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayName  = profile?.profile?.custom_name || me?.name || "";
  const nameColor    = profile?.profile?.name_color      || "#ede9e0";
  const glowColor    = profile?.profile?.name_glow_color || null;
  const glowInt      = profile?.profile?.name_glow       ?? 0;
  const nameGlow     = glowInt > 0 && glowColor
    ? `0 0 ${glowInt*2}px ${glowColor}, 0 0 ${glowInt*4}px ${glowColor}99`
    : "none";
  const nameGradFrom = profile?.profile?.name_grad_from  || null;
  const nameGradTo   = profile?.profile?.name_grad_to    || null;
  const nameStyle    = nameGradFrom && nameGradTo
    ? { background:`linear-gradient(90deg,${nameGradFrom},${nameGradTo})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }
    : { color: nameColor, textShadow: nameGlow };

  return (
    <UserContext.Provider value={{
      me, profile, loading, reload: load,
      displayName, nameColor, glowColor, glowInt, nameGlow,
      nameGradFrom, nameGradTo, nameStyle,
      coins:       profile?.coins              || { balance: 0, total_earned: 0 },
      level:       profile?.user?.level        || "bronze",
      ownedItems:  profile?.profile?.owned_items || [],
      activeAvatar: profile?.profile?.avatar_key || "avatar_lemon",
      activeFrame:  profile?.profile?.frame_key  || null,
      activeTitle:  profile?.profile?.title_key  || null,
      activeBadges: profile?.profile?.badges     || [],
    }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
