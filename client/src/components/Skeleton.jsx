/**
 * Skeleton premium reutilizable. Usar para loading states en lugar de "CARGANDO...".
 *
 * Variantes:
 *   <Skeleton.Hero />            — banner + título grande
 *   <Skeleton.Cards count={4} /> — grid de cards (KPIs)
 *   <Skeleton.Rows count={5} />  — filas de tabla
 *   <Skeleton.Block w h />       — bloque genérico
 */
const sharedStyle = `
  @keyframes lemonSkel{0%{background-position:-300% 0}100%{background-position:300% 0}}
  .skel{background:linear-gradient(90deg,rgba(255,255,255,.025) 0%,rgba(var(--brand-primary-rgb),.06) 50%,rgba(255,255,255,.025) 100%);background-size:300% 100%;animation:lemonSkel 1.6s linear infinite}
  .skel-fade{animation:lemonSkel 1.6s linear infinite, fadeInSkel .4s ease both}
  @keyframes fadeInSkel{from{opacity:0}to{opacity:1}}
`;

function Style() {
  return <style>{sharedStyle}</style>;
}

function Block({ w = "100%", h = 14, mt = 0, mb = 0, style = {} }) {
  return <div className="skel" style={{ width: w, height: h, marginTop: mt, marginBottom: mb, ...style }} />;
}

function Hero({ heroH = 200, contentH = 220 }) {
  return (
    <>
      <Style />
      <div className="skel" style={{ width:"100%", height:heroH, marginBottom:12 }} />
      <div style={{ padding:"22px 26px" }}>
        <Block w={140} h={11} mb={10} />
        <Block w="60%" h={32} mb={16} />
        <Block w="40%" h={11} mb={6} />
        <Block w="80%" h={11} />
      </div>
    </>
  );
}

function Cards({ count = 4, h = 110, gap = 8, cols = "repeat(auto-fill,minmax(160px,1fr))" }) {
  return (
    <>
      <Style />
      <div style={{ display:"grid", gridTemplateColumns:cols, gap }}>
        {Array.from({ length:count }).map((_, i) => (
          <div key={i} className="skel" style={{ height:h, animationDelay:`${i*100}ms` }} />
        ))}
      </div>
    </>
  );
}

function Rows({ count = 5, h = 52, gap = 8 }) {
  return (
    <>
      <Style />
      <div style={{ display:"flex", flexDirection:"column", gap }}>
        {Array.from({ length:count }).map((_, i) => (
          <div key={i} className="skel" style={{ height:h, animationDelay:`${i*80}ms` }} />
        ))}
      </div>
    </>
  );
}

function ListWithIcon({ count = 5, h = 64 }) {
  return (
    <>
      <Style />
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {Array.from({ length:count }).map((_, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:14, padding:14, background:"rgba(255,255,255,.02)", border:"1px solid rgba(255,255,255,.04)", animationDelay:`${i*80}ms` }}>
            <div className="skel" style={{ width:42, height:42, borderRadius:"50%" }} />
            <div style={{ flex:1 }}>
              <Block w="50%" h={12} mb={6} />
              <Block w="80%" h={10} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const Skeleton = { Block, Hero, Cards, Rows, ListWithIcon, Style };
export default Skeleton;
