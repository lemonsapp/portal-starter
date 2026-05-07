import React from "react";

function usd(v){
  return `$${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`
}

export default function FounderInsights({ metrics, monthly=[] }){

  if(!metrics) return null;

  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();

  const executive = Number(metrics.executive_total_profit || 0);

  const projected = day > 0 ? (executive / day) * daysInMonth : executive;

  const prev = monthly[1]?.net || 0;
  const current = monthly[0]?.net || 0;
  const trend = prev !== 0 ? ((current - prev) / Math.abs(prev)) * 100 : 0;

  const alerts = [];

  if(executive < 0){
    alerts.push("🔥 Estás en negativo → revisar urgente costos");
  } else if(executive < 1500){
    alerts.push("⚠️ Ganancia baja → escalar volumen");
  } else {
    alerts.push("🚀 Buen mes → escalar fuerte");
  }

  if(metrics.additional_income_usd <= 0){
    alerts.push("💡 Falta ingresos adicionales");
  }

  return (
    <div style={{
      marginBottom:18,
      padding:20,
      borderRadius:26,
      background:"rgba(255,255,255,0.03)"
    }}>

      <div style={{fontSize:22,fontWeight:900}}>
        Inteligencia del negocio
      </div>

      <div style={{display:"flex",gap:20,marginTop:12}}>

        <div>
          <div>Proyección</div>
          <div style={{fontWeight:900}}>{usd(projected)}</div>
        </div>

        <div>
          <div>Tendencia</div>
          <div style={{fontWeight:900}}>
            {trend.toFixed(1)}%
          </div>
        </div>

        <div>
          <div>Actual</div>
          <div style={{fontWeight:900}}>
            {usd(executive)}
          </div>
        </div>

      </div>

      <div style={{marginTop:12}}>
        {alerts.map((a,i)=>(
          <div key={i}>{a}</div>
        ))}
      </div>

    </div>
  )
}
