import { useEffect, useState } from "react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

const FALLBACK_LINES = {
  usa_normal: true,
  usa_express: true,
  china_normal: true,
  china_express: true,
  europa_normal: false,
};

const COUNTRY_LINES = {
  usa: ["usa_normal", "usa_express"],
  china: ["china_normal", "china_express"],
  europa: ["europa_normal"],
};

export const LINE_META = {
  usa_normal:    { country: "usa",    countryName: "USA",    flag: "🇺🇸", svc: "Normal",     express: false, eta: "7-10 días"  },
  usa_express:   { country: "usa",    countryName: "USA",    flag: "🇺🇸", svc: "Express",    express: true,  eta: "72 hs"      },
  china_normal:  { country: "china",  countryName: "China",  flag: "🇨🇳", svc: "Normal",     express: false, eta: "~18 días"   },
  china_express: { country: "china",  countryName: "China",  flag: "🇨🇳", svc: "Express",    express: true,  eta: "~7 días"    },
  europa_normal: { country: "europa", countryName: "Europa", flag: "🇪🇺", svc: "Normal",     express: false, eta: "18-20 días" },
};

function deriveCountries(lines) {
  return Object.fromEntries(
    Object.entries(COUNTRY_LINES).map(([c, keys]) => [c, keys.some(k => lines[k])])
  );
}

export default function useOpStatus(intervalMs = 60000) {
  const [lines, setLines] = useState(FALLBACK_LINES);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let abort = false;
    async function load() {
      try {
        const r = await fetch(`${API}/public/operations-status`, { cache: "no-store" });
        const d = await r.json();
        if (abort) return;
        if (d?.lines) {
          setLines({ ...FALLBACK_LINES, ...d.lines });
          setNotes(d.notes || {});
          setUpdatedAt(d.updated_at || new Date().toISOString());
        }
      } catch {
        // mantiene fallback
      } finally {
        if (!abort) setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, intervalMs);
    return () => { abort = true; clearInterval(iv); };
  }, [intervalMs]);

  const countries = deriveCountries(lines);
  const totalLines = Object.keys(lines).length;
  const onLines = Object.values(lines).filter(Boolean).length;

  return { lines, notes, countries, loading, updatedAt, totalLines, onLines };
}

export { COUNTRY_LINES };
