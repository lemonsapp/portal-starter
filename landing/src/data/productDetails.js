/* =====================================================================
   productDetails.js
   Detalle profundo por producto (estilo apple.com/macbook-pro).
   Cada slug tiene secciones narrativas que el componente ProductDeepDive
   renderiza en orden cinemático.

   Estructura:
     hero        → headline + claim + CTAs
     highlights  → 3-4 puntos para sticky-scroll (cada uno con kicker, title, body)
     bigStat     → número grande scrub-counted + label + body
     features    → grid 2×3 con icon + title + body
     formats     → presentaciones (name, size, image)
     system      → texto de integración con el resto del catálogo
     pullquote   → frase emblemática
     techSpecs   → lista label/value
   ===================================================================== */
export const productDetails = {
    "linea-elite": {
        hero: {
            kicker: "LÍNEA ELITE · FERTILIZANTE PARA HIDROPONÍA",
            headline: "Fertilizante premium\npara hidroponía y sustrato inerte.",
            claim: "Part 1 + Part 2: el fertilizante dual de Holistic para cultivadores de hidroponía, NFT, DWC, coco y sustratos 100% inertes. Concentración máxima de NPK en cada riego, pH auto-buffer entre 5.8 y 6.2, resultados consistentes cosecha tras cosecha.",
            ctaPrimary:   { label: "COMPRAR ELITE",        href: "/shop?categoria=elite" },
            ctaSecondary: { label: "VER ESPECIFICACIONES", href: "#specs" },
            color: "#C9A34E",
            colorSoft: "#F7F3EA",
            heroVideo: {
                src: "/video/internas/linea-elite/hero.mp4",
            },
            heroBackground: true,
        },
        // Highlights cinematográficos para Elite — paleta dorada/crema.
        // Cada uno tiene su imagen del catálogo Elite (Part 1, Part 2,
        // juntos, envase grande). El componente ProductHighlights hace
        // cross-fade + halo dinámico + big number + partículas.
        highlights: [
            {
                kicker: "DISEÑO DUAL",
                title: "Dos botellas, un sistema completo.",
                body: "Part 1 aporta calcio, magnesio y micro. Part 2 entrega el NPK base. Aplicadas juntas en cada riego, dan al cultivo todo lo que necesita en su justa proporción — sin antagonismos.",
                image: "/img/productos/linea-elite/1l/juntos-1l.png",
                color: "#C9A34E",
                stat: "01",
            },
            {
                kicker: "FULL-CYCLE",
                title: "Una sola línea, todo el ciclo.",
                body: "Vegetativo, preflora, floración, finalizado. La misma fórmula con dosis ajustada por etapa. Menos productos para comprar, menos chances de equivocarse al dosar.",
                image: "/img/productos/linea-elite/1l/parte-1-perspectiva-1l.png",
                color: "#E5D9B8",
                stat: "02",
            },
            {
                kicker: "INERTE & HIDRO",
                title: "El fertilizante ideal para coco, perlita, NFT y DWC.",
                body: "Coco, perlita, lana de roca, NFT y DWC. Los nutrientes son 100% biodisponibles: la planta los absorbe directamente sin depender de la microbiología del sustrato.",
                image: "/img/productos/linea-elite/500gr/parte-2-perspectiva-1l.png",
                color: "#B8923A",
                stat: "03",
            },
            {
                kicker: "PUREZA",
                title: "Calidad de laboratorio.",
                body: "Materias primas grado farma. Cada lote pasa control de pureza, EC y pH antes de envasarse. Trazabilidad completa.",
                image: "/img/productos/elite-max/10-litros-apilados.png",
                color: "#D4B856",
                stat: "04",
            },
        ],
        bigStat: {
            num: 100,
            suffix: "%",
            label: "BIODISPONIBLE",
            body: "Cada elemento en su forma absorbible. Sin pasar por la microbiología del suelo: las raíces toman lo que necesitan, cuando lo necesitan.",
        },
        features: [
            { title: "pH auto-buffer",        body: "La fórmula mantiene el pH del solución entre 5.8 y 6.2 sin ajustes manuales constantes.",                  emoji: "⚖" },
            { title: "EC predecible",          body: "Dosis exacta = EC exacta. Repetible riego tras riego, lote tras lote.",                                       emoji: "📊" },
            { title: "Sin precipitados",       body: "Part 1 y Part 2 están diseñadas para mezclarse en el agua sin formar sales insolubles.",                     emoji: "✦" },
            { title: "Concentración premium",  body: "Más nutriente por ml — menos botellas, más densidad activa.",                                                 emoji: "◆" },
            { title: "Soporte técnico",        body: "Acompañamiento humano en arranque, ajustes y diagnóstico. Sin call centers.",                                emoji: "♥" },
            { title: "Trazabilidad de lote",   body: "Número de lote impreso. Sabés exactamente qué materia prima entró en tu botella.",                           emoji: "✓" },
        ],
        // Cubre el rango completo: pequeñas (250ml–1L PNG con alpha),
        // intermedias (5L) y grandes industriales (10L y 20L apilados).
        // Las imágenes "apiladas" comunican volumen y nivel pro.
        formats: [
            { name: "250 ML",   size: "250ml",  image: "/img/productos/linea-elite/1l/juntos-1l.png" },
            { name: "500 ML",   size: "500ml",  image: "/img/productos/linea-elite/500gr/parte-2-perspectiva-1l.png" },
            { name: "1 LITRO",  size: "1L",     image: "/img/productos/linea-elite/1l/parte-1-perspectiva-1l.png" },
            { name: "5 LITROS", size: "5L",     image: "/img/productos/elite-max/a-5-lts-perspectiva-1.png" },
            { name: "10 LITROS",size: "10L",    image: "/img/productos/elite-max/10-litros-apilados.png" },
            { name: "20 LITROS",size: "20L",    image: "/img/productos/elite-max/20-litros-apilados.png" },
        ],
        system: {
            title: "Diseñado para integrar el sistema Holistic.",
            body: "Elite es el corazón del catálogo. Combiná con Race para acelerar floración, con Bio Estimulante en el arranque, con Day-0 para el cierre. Un solo equipo técnico atrás de todos los productos.",
            chips: ["+ Bio Estimulante", "+ Race", "+ Day-0"],
        },
        pullquote: "Lo que separa una cosecha buena de una excelente está en el fertilizante que elegís. Línea Elite no deja márgenes de error.",
        techSpecs: [
            { label: "Composición",      value: "Part 1: Ca-Mg-Micros · Part 2: NPK + secundarios" },
            { label: "Forma",             value: "Líquido concentrado" },
            { label: "Aplicación",        value: "Sustratos inertes, hidroponía, coco" },
            { label: "Dosis vegetativo",  value: "1.5 ml/L de cada parte" },
            { label: "Dosis floración",   value: "2.0 ml/L de cada parte" },
            { label: "Conservación",      value: "Bajo techo, 5–25°C, 24 meses" },
            { label: "Presentaciones",    value: "250 ml · 500 ml · 1 L" },
        ],
    },

    "linea-pro": {
        hero: {
            kicker: "LÍNEA PRO · FERTILIZANTE HIDROSOLUBLE",
            headline: "Fertilizante hidrosoluble\npara sustratos compuestos.",
            claim: "Cuatro fertilizantes etapa-específicos en formato sólido hidrosoluble para sustratos compuestos. Enraizante, Vegetativo, Preflora y Flora: cada uno con el ratio NPK exacto para esa fase. Pesás, disolvés, regás. EC programable, pH estable, mismo resultado en cada lote. Compatible con autoflorecientes y fotoperiódicas.",
            ctaPrimary:   { label: "COMPRAR PRO",            href: "/shop?categoria=pro" },
            ctaSecondary: { label: "VER ESPECIFICACIONES", href: "#specs" },
            color: "#F5948A",
            colorSoft: "#FFE3DE",
            heroVideo: {
                src: "/video/internas/linea-pro/hero.mp4",
            },
            heroBackground: true,
        },
        // Highlights de Pro: paleta coral/salmón. Primer highlight usa
        // el video MP4 oficial del cliente como media (mediaType:video).
        // Los demás muestran las 4 etapas (Enraizante, Vegetativo,
        // Preflora, Flora) en su gramaje 1kg.
        highlights: [
            {
                kicker: "FÓRMULA POR ETAPA",
                title: "Una para cada momento.",
                body: "Enraizante, Vegetativo, Preflora y Flora. Cada una desarrollada para el perfil nutricional exacto que la planta necesita en esa fase.",
                image: "/video/holistic-pro.mp4",
                mediaType: "video",
                color: "#F5948A",
                stat: "01",
            },
            {
                kicker: "FORMATO SÓLIDO",
                title: "Sin agua, sin alcohol, sin conservantes.",
                body: "100% materia activa. El fertilizante sólido no pierde potencia con el calor ni con el tiempo: 36 meses de vida útil garantizados.",
                image: "/img/productos/linea-pro/1kg/vegetativo-1kg-1.png",
                color: "#FFB39B",
                stat: "02",
            },
            {
                kicker: "DOSIS EXACTA",
                title: "Al gramo.",
                body: "Balanceá tu reservorio con precisión de laboratorio. Misma cucharita, misma EC, mismo resultado.",
                image: "/img/productos/linea-pro/1kg/flora-1kg-1.png",
                color: "#E87C70",
                stat: "03",
            },
            {
                kicker: "ECONÓMICO",
                title: "Más cosechas por kilo.",
                body: "Más concentrado que líquidos: menor costo por dosis y menor logística (1 kg sólido = ~5 L líquido).",
                image: "/img/productos/linea-pro/1kg/enraizante-1kg-1.png",
                color: "#FF8A7A",
                stat: "04",
            },
        ],
        bigStat: {
            num: 4,
            suffix: " etapas",
            label: "FÓRMULAS ESPECÍFICAS",
            body: "Enraizante · Vegetativo · Preflora · Flora. Cada fórmula concentra el ratio NPK ideal para esa etapa — sin compromisos de mezcla universal.",
        },
        features: [
            { title: "Estabilidad total",     body: "Sin agua = sin caducidad acelerada. Vida útil 36 meses sin pérdida de actividad.",          emoji: "♢" },
            { title: "Sin almacenamiento frío",body: "Conservalo donde quieras. No requiere heladera ni rangos estrictos.",                       emoji: "✦" },
            { title: "EC programable",         body: "Ajustá la EC final al exacto valor que tu cultivo necesita por gramos disueltos.",          emoji: "⚖" },
            { title: "Mezcla limpia",          body: "Disuelve completo en agua tibia sin residuos — sin filtros que limpiar.",                   emoji: "○" },
            { title: "Compatible NFT/DWC",     body: "El sólido disuelto se comporta como un líquido premium en cualquier sistema.",              emoji: "↯" },
            { title: "Trazabilidad por lote",  body: "Cada bolsa impresa con lote y composición exacta del análisis.",                            emoji: "✓" },
        ],
        // 4 etapas (Vegetativo, Preflora, Flora, Enraizante) en
        // distintos gramajes. Mostramos una por etapa para que el
        // selector cuente la historia del ciclo, no sólo del peso.
        formats: [
            { name: "VEGETATIVO",  size: "1kg",   image: "/img/productos/linea-pro/1kg/vegetativo-1kg-1.png" },
            { name: "PREFLORA",    size: "1kg",   image: "/img/productos/linea-pro/1kg/preflora-1kg-1.png" },
            { name: "FLORA",       size: "1kg",   image: "/img/productos/linea-pro/1kg/flora-1kg-1.png" },
            { name: "ENRAIZANTE",  size: "1kg",   image: "/img/productos/linea-pro/1kg/enraizante-1kg-1.png" },
            { name: "FLORA",       size: "500g",  image: "/img/productos/linea-pro/500gr/flora-500gr-1.png" },
            { name: "FLORACIÓN",   size: "100g",  image: "/img/productos/linea-pro/100gr/floracion-100gr-1.png" },
        ],
        system: {
            title: "Encaja con todo el catálogo.",
            body: "Pro es la opción técnica del cultivador que mide. Mezclable con Bio Estimulante en arranque y con Day-0 al cierre.",
            chips: ["+ Bio Estimulante", "+ Day-0"],
        },
        pullquote: "Si lo podés pesar, lo podés repetir. Con Línea Pro, cada cultivo indoor es mejor que el anterior.",
        techSpecs: [
            { label: "Composición",     value: "NPK + Ca-Mg-Micro etapa-ajustado" },
            { label: "Forma",            value: "Sólido cristalino hidrosoluble" },
            { label: "Solubilidad",      value: "100% en agua >18°C" },
            { label: "Dosis",            value: "0.5 – 1.5 g/L según etapa" },
            { label: "Conservación",     value: "Lugar seco, hasta 36 meses" },
            { label: "Presentaciones",   value: "25 g · 100 g · 500 g · 1 kg" },
            { label: "Etapas",           value: "Enraizante · Vegetativo · Preflora · Flora" },
        ],
    },

    "linea-race": {
        hero: {
            kicker: "LÍNEA RACE · FERTILIZANTE LÍQUIDO CONCENTRADO",
            headline: "Fertilizantes líquidos concentrados\npara cultivo indoor de ciclo corto.",
            claim: "Línea Race es el sistema de fertilizantes líquidos concentrados de Holistic para cultivadores que priorizan velocidad y rendimiento. Cuatro fórmulas para todo el ciclo indoor: Race 1 Vegetativo, Race 2 Floración (Part A + B), Race 3 Bloom Booster y Race 4 Finalizador. Ideal para autoflorecientes, ciclos cortos y cultivadores que no quieren perder ni una semana.",
            // CTAs intencionalmente omitidos para Race — el hero queda
            // como statement editorial puro sobre el video. ProductDeepDive
            // renderiza los CTAs condicionalmente: si no están definidos,
            // el bloque entero de botones se omite.
            color: "#2E8F6E",
            colorSoft: "#C7F0DD",
            // Hero CINEMATOGRÁFICO: video MP4 full-bleed como fondo
            // (no como elemento separado al lado del texto). El componente
            // detecta `heroBackground: true` para layout overlay vs. stage.
            heroVideo: {
                src: "/video/race/cinematic-violeta-splash-radial.mp4",
                poster: "/img/race/cinematic-violeta-splash-radial-poster.png",
            },
            heroImage: "/img/race/bottle-violeta-field-sunset.jpg",
            // Flag que el componente lee para usar el layout fullbleed.
            heroBackground: true,
        },
        // Cada highlight tiene su imagen propia + color tema. El componente
        // ProductHighlights lee estos colores (vía data-colors) para teñir
        // halo, big number atrás, gradient bg, dot pulsante, partículas
        // orbitales y progress bar de cada highlight activa.
        highlights: [
            {
                kicker: "VEGETATIVO",
                title: "Race 1 — fertilizante vegetativo concentrado.",
                body: "Concentrado de alta carga nitrogenada para arranque vigoroso. Hojas grandes, internudos cortos, masa vegetal sólida para entrar a floración con potencia máxima.",
                image: "/img/race/bottle-violeta-a-roots.jpg",
                color: "#8E24AA",
                stat: "01",
            },
            {
                kicker: "FLORACIÓN",
                title: "Race 2 (Part A + B) — fertilizante de floración dual.",
                body: "Part A aporta calcio y magnesio, Part B entrega fósforo y potasio en la proporción exacta. La química correcta para flores densas y compactas.",
                image: "/img/race/bottle-verde-greenhouse.jpg",
                color: "#2E8F6E",
                stat: "02",
            },
            {
                kicker: "BLOOM BOOSTER",
                title: "Race 3 — bloom booster para semanas 4-6.",
                body: "Potenciador de floración que activa la translocación de azúcares y agranda flores en el pico productivo. El fertilizante que más diferencia hace en el resultado final.",
                image: "/img/race/bottle-violeta-sunset.jpg",
                color: "#6B3BAF",
                stat: "03",
            },
            {
                kicker: "FINALIZADOR",
                title: "Race 4 — fertilizante finalizador.",
                body: "Para los últimos días del ciclo. Compacta tejidos, potencia aromas y resinas, y prepara la planta para el cierre definitivo con Day-0.",
                image: "/img/race/bottle-rosa-sunset.jpg",
                color: "#EC407A",
                stat: "04",
            },
        ],
        bigStat: {
            num: 5,
            suffix: " fórmulas",
            label: "EL KIT COMPLETO",
            body: "Race 1 · 2A · 2B · 3 · 4. Cinco productos para cubrir el ciclo completo desde vegetativo hasta finalizador. Diseñado como sistema integrado.",
        },
        features: [
            { title: "Concentración alta",     body: "1 ml/L típicamente. Menos plástico, más nutriente por riego.",                          emoji: "◆" },
            { title: "pH neutro",              body: "Cada Race trabaja en el rango óptimo del cultivo sin shock de pH.",                     emoji: "⚖" },
            { title: "Estabilidad en mezcla",  body: "Race 2A + 2B mezclables sin precipitar (en el orden indicado).",                        emoji: "✦" },
            { title: "Compatible con Elite",   body: "Race se puede usar con Elite como booster de floración.",                              emoji: "↯" },
            { title: "Velocidad real",         body: "Diseñado para cultivos donde el tiempo importa: indoor, ciclos cortos, autoflorecientes.",emoji: "⚡" },
            { title: "Soporte de uso",         body: "Tabla de dosificación clara. Variantes para indoor/outdoor incluidas.",                  emoji: "♥" },
        ],
        // 4 fórmulas con imágenes editoriales (5528, 5529, 5530, 5531)
        // entregadas por el cliente. Orden literal del usuario.
        // El componente RaceFormatsShowcase reemplaza al pdd__formats
        // genérico para Race con stage central + partículas + tabs
        // animadas — cuando slug=linea-race el ProductDeepDive omite
        // su sección de formats y monta el showcase.
        formats: [
            {
                name: "RACE 1",
                size: "Vegetativo",
                image: "/img/race/bottle-violeta-a-roots.jpg",
                color: "#8E24AA",
                tagline: "Fertilizante vegetativo concentrado.",
                description:
                    "Alta carga nitrogenada para arranque vigoroso. Hojas grandes, internudos cortos, masa vegetal sólida para entrar a floración con potencia máxima.",
            },
            {
                name: "RACE 2",
                size: "Floración",
                image: "/img/race/bottle-verde-greenhouse.jpg",
                color: "#2E8F6E",
                tagline: "Fertilizante de floración dual.",
                description:
                    "Part A aporta calcio y magnesio, Part B entrega fósforo y potasio en la proporción exacta. La química correcta para flores densas y compactas.",
            },
            {
                name: "RACE 3",
                size: "Bloom Booster",
                image: "/img/race/bottle-violeta-sunset.jpg",
                color: "#6B3BAF",
                tagline: "Potenciador de floración.",
                description:
                    "Bloom booster para semanas 4-6. Activa la translocación de azúcares y agranda flores en el pico productivo. El fertilizante que más diferencia hace en el resultado final.",
            },
            {
                name: "RACE 4",
                size: "Finalizador",
                image: "/img/race/bottle-rosa-sunset.jpg",
                color: "#EC407A",
                tagline: "Fertilizante finalizador.",
                description:
                    "Para los últimos días del ciclo. Compacta tejidos, potencia aromas y resinas, y prepara la planta para el cierre definitivo con Day-0.",
            },
        ],
        system: {
            title: "El motor del catálogo.",
            body: "Race es la línea más enfocada en performance. Combinable con Elite (sustrato inerte) o Pro (hidrosoluble) según preferencia. Day-0 al final, siempre.",
            chips: ["+ Elite", "+ Pro", "+ Day-0"],
        },
        pullquote: "La velocidad sin control es ruido. Race es el fertilizante indoor que te da las dos cosas: velocidad y precisión.",
        techSpecs: [
            { label: "Composición",     value: "Race 1 NPK foliar · 2A Ca-Mg · 2B PK · 3 PK booster · 4 finalizador" },
            { label: "Forma",            value: "Líquido concentrado" },
            { label: "Dosis típica",     value: "1.0 – 1.5 ml/L" },
            { label: "Compatibilidad",   value: "Sustratos inertes, coco, hidro, tierra premium" },
            { label: "Conservación",     value: "Bajo techo, 5–25°C, 24 meses" },
            { label: "Presentaciones",   value: "250 ml · 500 ml" },
            { label: "Variantes",        value: "5 fórmulas etapa-específicas" },
        ],
    },

    "bio-estimulante": {
        hero: {
            kicker: "BIO ESTIMULANTE · ORGÁNICO PARA CULTIVO INDOOR",
            headline: "Bioestimulante orgánico\npara cultivo indoor.",
            claim: "Bioestimulante 100% orgánico para cultivo indoor, fabricado en biorreactor industrial con cepas seleccionadas de Azospirillum y Azotobacter. Hasta 70% más efectivo que micorrizas tradicionales. Estimula el desarrollo radicular, potencia la absorción de nutrientes y activa defensas naturales. Compatible con todos los fertilizantes del catálogo: Línea Pro, Línea Elite y Línea Race.",
            ctaPrimary:   { label: "COMPRAR BIO",           href: "/shop?categoria=bio" },
            ctaSecondary: { label: "VER ESPECIFICACIONES", href: "#specs" },
            color: "#E8A5B1",
            colorSoft: "#F7D6DC",
            heroVideo: {
                src: "/video/internas/bio-estimulante/hero.mp4",
            },
            heroBackground: true,
        },
        // Highlights de Bio Estimulante: paleta rosa/coral. Botella
        // grande en distintas perspectivas + raíz dramática (5533) que
        // refuerza el claim "70% más efectivo en raíces".
        highlights: [
            {
                kicker: "BIORREACTOR",
                title: "Producido en biorreactor industrial.",
                body: "No es un té de compost casero: es un bioestimulante orgánico producido en fermentadores industriales controlados, con cepas de Azospirillum y Azotobacter seleccionadas y CFU ≥10⁹ UFC/ml verificado por lote.",
                image: "/img/productos/bio-estimulante/perspectiva-1-grande-rosa-sin-fondo.png",
                color: "#E8A5B1",
                stat: "01",
            },
            {
                kicker: "SINERGIA",
                title: "Acelera todo lo demás.",
                body: "Aplicado junto a Elite, Pro o Race, multiplica la eficiencia de absorción radicular. La planta toma más nutrientes con menos input.",
                image: "/img/productos/bio-estimulante/perspectiva-2-grande-rosa-sin-fondo.png",
                color: "#F7B8C5",
                stat: "02",
            },
            {
                kicker: "VERSÁTIL",
                title: "Riego, foliar, esquejes.",
                body: "Una sola botella para activar raíces, mejorar foliage y reforzar defensas naturales. Multifunción real.",
                image: "/img/race/root-detail.jpg",
                color: "#F091A5",
                stat: "03",
            },
            {
                kicker: "SEGURIDAD",
                title: "100% orgánico, 100% inocuo.",
                body: "Sin metales pesados, sin sintéticos. Apto para cultivos de consumo y para todo el ciclo.",
                image: "/img/productos/bio-estimulante/lateral-grande-rosa-sin-fondo.png",
                color: "#D67D92",
                stat: "04",
            },
        ],
        bigStat: {
            num: 70,
            suffix: "%",
            label: "MÁS EFECTIVO",
            body: "Hasta 70% más efectivo que las micorrizas tradicionales en estudios comparativos de absorción de fósforo y desarrollo radicular en plantas vegetativas.",
        },
        features: [
            { title: "Acelera enraizamiento", body: "Esquejes y plantines arrancan más rápido y con mayor masa radicular.",     emoji: "✦" },
            { title: "Defensas naturales",     body: "Activa la respuesta inmune endógena de la planta sin químicos.",            emoji: "♥" },
            { title: "Resistencia a estrés",   body: "Plantas más tolerantes a transplante, calor, sequía y poda.",                emoji: "◆" },
            { title: "Mejora absorción",       body: "Sinergia con cualquier nutriente — no es un reemplazo, es un potenciador.",  emoji: "⚡" },
            { title: "Aplicación foliar",      body: "Spray foliar para hojas, raíces y corteza con un solo producto.",            emoji: "○" },
            { title: "Producción local",       body: "Fabricado en Argentina con tecnología de biorreactor industrial.",           emoji: "✓" },
        ],
        formats: [
            { name: "GRANDE", size: "Standard", image: "/img/productos/bio-estimulante/perspectiva-1-grande-rosa-sin-fondo.png" },
            { name: "LATERAL", size: "Display", image: "/img/productos/bio-estimulante/lateral-grande-rosa-sin-fondo.png" },
        ],
        system: {
            title: "El primer paso del ciclo.",
            body: "Aplicalo en arranque, antes de cualquier otro producto. Activa raíces y defensas para que el resto del catálogo trabaje sobre una planta sana y receptiva.",
            chips: ["+ Cloner", "+ Elite", "+ Pro"],
        },
        pullquote: "La diferencia entre un cultivo indoor bueno y uno excelente arranca por la raíz. El Bio Estimulante es el primer paso.",
        techSpecs: [
            { label: "Composición",     value: "Microorganismos benéficos + metabolitos secundarios" },
            { label: "Forma",            value: "Líquido orgánico" },
            { label: "CFU",              value: "≥10^9 UFC/ml (cepas seleccionadas)" },
            { label: "Aplicación",       value: "Riego, foliar, esquejes, transplante" },
            { label: "Conservación",     value: "Bajo techo, 5–25°C, 12 meses" },
            { label: "Compatibilidad",   value: "Todos los productos del catálogo + sustratos minerales" },
            { label: "Certificación",    value: "Producción en biorreactor — sin metales pesados" },
        ],
    },

    "cloner": {
        hero: {
            kicker: "CLONER · GEL ENRAIZANTE PARA ESQUEJES",
            headline: "Gel enraizante para esquejes.\nEl primer paso del ciclo.",
            claim: "Cloner es el gel enraizante de alta adherencia de Holistic para esquejes y plantines. Fórmula de contacto rápido que acelera el prendimiento radicular con mínima manipulación. El comienzo del ciclo que define la calidad del resultado final. Compatible con todo el catálogo Holistic.",
            ctaPrimary:   { label: "COMPRAR CLONER",         href: "/shop?categoria=cloner" },
            ctaSecondary: { label: "VER ESPECIFICACIONES",   href: "#specs" },
            color: "#6B3BAF",
            colorSoft: "#E4D5F2",
        },
        // Highlights de Cloner: paleta violeta. Hasta tener foto del
        // tubo Cloner, usamos imágenes de la esquejera (proceso real
        // del clonado: barritas, paso a paso, vista superior). Cada
        // imagen muestra una etapa del workflow.
        highlights: [
            {
                kicker: "ALTA ADHERENCIA",
                title: "Se queda donde lo aplicás.",
                body: "Gel viscoso que no escurre. Aplicás, plantás. Cubre el 100% del corte y mantiene la zona en contacto óptimo con el sustrato.",
                image: "/img/productos/esquejera/uso-barrita-pasos-sin-fondo.png",
                color: "#6B3BAF",
                stat: "01",
            },
            {
                kicker: "PRENDIMIENTO",
                title: "Tasa de éxito superior al 90%.",
                body: "Combinación de auxinas y vehículos protectores que aceleran la formación de raíces adventicias en cualquier variedad.",
                image: "/img/productos/esquejera/4-perspectiva-barritas-colocadas-editado.png",
                color: "#9C5FD8",
                stat: "02",
            },
            {
                kicker: "MULTIPLICACIÓN",
                title: "Pensado para producción profesional.",
                body: "Esquejes seriados, batches grandes, propagación masiva: la consistencia del gel hace que todos arranquen al mismo tiempo.",
                image: "/img/productos/esquejera/superior-sin-fondo.png",
                color: "#7D4BC9",
                stat: "03",
            },
            {
                kicker: "USO SIMPLE",
                title: "Sumergir, plantar, regar.",
                body: "Sin polvos que se vuelan, sin diluciones a pesar. La curva de aprendizaje es casi cero.",
                image: "/img/productos/esquejera/5-top-editado.png",
                color: "#B49AE0",
                stat: "04",
            },
        ],
        bigStat: {
            num: 90,
            suffix: "%+",
            label: "PRENDIMIENTO",
            body: "Tasa de prendimiento promedio en condiciones controladas (humedad >70%, temperatura 22-26°C, sustrato fresco). Validado en ensayos con esquejes de variedades comerciales.",
        },
        features: [
            { title: "Auxinas activas",      body: "Combinación IBA + NAA en concentración óptima para inducir raíz adventicia.",     emoji: "✦" },
            { title: "Sin contaminación",     body: "Tubo individual previene contaminación cruzada entre lotes.",                       emoji: "✓" },
            { title: "Adherencia premium",    body: "Permanece en el corte hasta que el esqueje desarrolla raíces propias.",             emoji: "◆" },
            { title: "Espectro amplio",       body: "Funciona en esquejes herbáceos, leñosos y semi-leñosos.",                          emoji: "↯" },
            { title: "Combinable con Bio",    body: "Aplicar Bio Estimulante en el agua del propagador potencia la respuesta.",          emoji: "♥" },
            { title: "Trazable",              body: "Lote y fecha en cada tubo. Sabés exactamente con qué estás trabajando.",            emoji: "○" },
        ],
        // Sin foto del tubo Cloner aún → mostramos los assets de la
        // esquejera (proceso real del clonado: corte, gel, sustrato).
        // Un solo "format" rompía visualmente este bloque, así que
        // exponemos 3 vistas del mismo flujo de uso.
        formats: [
            { name: "USO",        size: "Paso a paso",      image: "/img/productos/esquejera/uso-barrita-pasos-sin-fondo.png" },
            { name: "ESQUEJERA",  size: "Vista superior",   image: "/img/productos/esquejera/superior-sin-fondo.png" },
            { name: "BARRITAS",   size: "En sustrato",      image: "/img/productos/esquejera/4-perspectiva-barritas-colocadas-editado.png" },
        ],
        system: {
            title: "Donde nace la próxima cosecha.",
            body: "Cloner es el punto de entrada del ciclo. Aplicalo junto a Bio Estimulante en el agua del propagador y entrá a vegetativo con plantas vigorosas listas para Elite o Pro.",
            chips: ["+ Bio Estimulante"],
        },
        pullquote: "El comienzo del ciclo define la calidad del resultado final.",
        techSpecs: [
            { label: "Forma",             value: "Gel de alta viscosidad" },
            { label: "Principio activo",  value: "IBA + NAA en vehículo protector" },
            { label: "Aplicación",        value: "Sumergir base del esqueje 2-3 cm" },
            { label: "Tasa típica",       value: ">90% en condiciones controladas" },
            { label: "Tipo de esquejes",  value: "Herbáceos, leñosos, semi-leñosos" },
            { label: "Conservación",      value: "Bajo techo, 5–25°C, 24 meses" },
        ],
    },

    "day-0": {
        hero: {
            kicker: "DAY 0 · FINALIZADOR DE COSECHA",
            headline: "Finalizador de cosecha.\nLa última decisión que define todo.",
            claim: "Day 0 es el tratamiento finalizador de Holistic para los últimos días del ciclo indoor. Limpieza profunda del sistema radicular, pulido del sabor, aroma y textura del resultado final. Lo que diferencia una cosecha buena de una perfecta. Se usa junto a Race 4 o como cierre exclusivo de cualquier sistema Holistic.",
            ctaPrimary:   { label: "COMPRAR DAY-0",          href: "/shop?categoria=day0" },
            ctaSecondary: { label: "VER ESPECIFICACIONES",   href: "#specs" },
            color: "#C9A34E",
            colorSoft: "#F9E79B",
            heroVideo: {
                src: "/video/internas/day-0/hero.mp4",
            },
            heroBackground: true,
        },
        // Highlights de Day-0: paleta amarilla/dorada — el "cierre"
        // del ciclo. Botella en distintas perspectivas comunican el
        // ritual final pre-cosecha.
        highlights: [
            {
                kicker: "LIMPIEZA",
                title: "Cierra con calidad.",
                body: "Aplicado en los últimos riegos antes del corte, ayuda a vaciar los reservorios internos de la planta de excesos minerales y mejora el bouquet final.",
                image: "/img/productos/day-0/perspectiva-1-grande-amarillo-sin-fondo.png",
                color: "#D4B34A",
                stat: "01",
            },
            {
                kicker: "SABOR",
                title: "El detalle que se nota.",
                body: "Cosechas con sabor y aroma más limpios, sin notas químicas residuales. La diferencia entre una cosecha técnica y una excelente.",
                image: "/img/productos/day-0/perspectiva-2-grande-amarillo-sin-fondo.png",
                color: "#F0D56D",
                stat: "02",
            },
            {
                kicker: "TIMING",
                title: "Programable al día.",
                body: "10-14 días antes del corte estimado. La planta ajusta su metabolismo y el cultivador llega al día 0 con una flor pulida.",
                image: "/img/productos/day-0/lateral-grande-amarillo-sin-fondo.png",
                color: "#C9A34E",
                stat: "03",
            },
            {
                kicker: "UNIVERSAL",
                title: "Compatible con cualquier sistema.",
                body: "Funciona después de Elite, Pro o Race. Independiente del nutriente principal — es el cierre que une todo el catálogo.",
                image: "/img/productos/day-0/lateral-2-grande-amarillo-sin-fondo.png",
                color: "#F9E79B",
                stat: "04",
            },
        ],
        bigStat: {
            num: 14,
            suffix: " días",
            label: "PROTOCOLO DE CIERRE",
            body: "Programá el último riego de Day-0 catorce días antes del corte estimado. La planta usa esos días para metabolizar reservas internas y entregar el sabor final más limpio posible.",
        },
        features: [
            { title: "Activa metabolitos",     body: "Estimula la conversión final de azúcares y aceites esenciales.",                emoji: "✦" },
            { title: "Sin shock",               body: "Transición suave del nutriente principal a la fase de cierre.",                  emoji: "◇" },
            { title: "Mejora aromas",           body: "Las plantas tratadas con Day-0 muestran perfil aromático más definido.",         emoji: "♥" },
            { title: "Compatibilidad total",    body: "Después de cualquier línea Holistic — Elite, Pro, Race.",                       emoji: "↯" },
            { title: "Aplicación simple",       body: "Una sola dosis por riego en los últimos 10-14 días. Sin escalones complejos.",   emoji: "○" },
            { title: "Validado en cultivo",     body: "Probado en variedades indoor/outdoor con resultado consistente.",                emoji: "✓" },
        ],
        formats: [
            { name: "GRANDE", size: "Standard",   image: "/img/productos/day-0/perspectiva-1-grande-amarillo-sin-fondo.png" },
            { name: "LATERAL", size: "Display",   image: "/img/productos/day-0/lateral-grande-amarillo-sin-fondo.png" },
        ],
        system: {
            title: "El cierre del catálogo.",
            body: "Day-0 es la última decisión del cultivo. Después de Elite, Pro o Race — antes del corte. Cierra el ciclo con la calidad que merece.",
            chips: ["+ Elite", "+ Pro", "+ Race"],
        },
        pullquote: "Lo que diferencia una cosecha buena de una perfecta se decide en los últimos días.",
        techSpecs: [
            { label: "Forma",             value: "Líquido / 250 ml" },
            { label: "Aplicación",         value: "Últimos 10-14 días pre-cosecha" },
            { label: "Dosis",              value: "1-2 ml/L según protocolo" },
            { label: "Compatibilidad",     value: "Cualquier línea Holistic + sustratos minerales" },
            { label: "Función",             value: "Limpieza de residuos + activación metabolitos" },
            { label: "Conservación",        value: "Bajo techo, 5–25°C, 24 meses" },
            { label: "Presentaciones",      value: "250 ml" },
        ],
    },
};

export function getProductDetail(slug) {
    return productDetails[slug] || null;
}
