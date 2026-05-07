export default function FounderPipeline() {
  const states = [
    { label: "En depósito", value: 12 },
    { label: "En tránsito", value: 25 },
    { label: "Listo entrega", value: 8 },
    { label: "Entregado", value: 59 }
  ];

  return (
    <div style={{
      marginTop: 30,
      background: "rgba(255,255,255,0.04)",
      padding: 20,
      borderRadius: 16
    }}>
      <h3 style={{ color: "white", marginBottom: 20 }}>
        Pipeline de envíos
      </h3>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16
      }}>
        {states.map((s, i) => (
          <div key={i} style={{
            background: "rgba(255,255,255,0.05)",
            padding: 16,
            borderRadius: 12
          }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>
              {s.label}
            </div>
            <div style={{
              color: "white",
              fontSize: 20,
              fontWeight: "bold"
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
