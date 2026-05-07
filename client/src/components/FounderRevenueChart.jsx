import { useEffect, useState } from "react";

export default function FounderRevenueChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("https://api.lemonsarg.com/api/stats/revenue-monthly")
      .then(r => r.json())
      .then(d => {
        if (d.ok) setData(d.data || []);
      })
      .catch(() => {
        setData([
          { month: "Ene", revenue: 1200 },
          { month: "Feb", revenue: 1800 },
          { month: "Mar", revenue: 2600 }
        ]);
      });
  }, []);

  return (
    <div style={{
      marginTop: 30,
      background: "rgba(255,255,255,0.04)",
      padding: 20,
      borderRadius: 16
    }}>
      <h3 style={{ color: "white", marginBottom: 20 }}>
        Revenue mensual
      </h3>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-end", height: 150 }}>
        {data.map((d, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{
              width: 30,
              height: d.revenue / 20,
              background: "#f5e03a",
              borderRadius: 6
            }} />
            <div style={{ color: "#aaa", fontSize: 12 }}>
              {d.month}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
