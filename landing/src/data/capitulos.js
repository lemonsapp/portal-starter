// Datos canónicos de cada capítulo (línea de producto) de la landing.
// Cada capítulo se renderiza en /[slug] via [categoria].astro y aparece
// también como ChapterSection en el index.astro.
//
// Copy SEO actualizado desde IMAGENES-HOLISTIC/SEO-DOCS/v3 (Marzo 2026).
// Cada entry tiene:
//   - seoTitle / seoDescription → meta tags + <title> de la página /[slug]
//   - h1 → headline indexable que la página debe pintar arriba del hero
//   - parrafoIntro → párrafo SEO debajo del h1
//   - tagline → copy emocional corto (era el subtítulo del componente hero)
//   - descripcion → meta legacy, mantenida para back-compat con componentes
//     que la consumen como fallback. Idéntica a parrafoIntro acortado.
//   - quote → línea de cierre (pull-quote)
//   - keywords → para referencia documental, no se renderizan automático

export const capitulos = [
    {
        slug: "bio-estimulante",
        orden: 1,
        kicker: "ETAPA 01 · DESPERTAR",
        nombreCorto: "BIO",
        nombreDestacado: "Estimulante",

        // SEO meta — v3 §5
        seoTitle: "Bioestimulante Orgánico para Cultivo Indoor | Holistic Growshop",
        seoDescription:
            "Bio Estimulante Holistic: bioestimulante orgánico para cultivo indoor fabricado en biorreactor industrial. Estimula raíces, potencia absorción de nutrientes y activa defensas naturales. Compatible con todos los fertilizantes del catálogo. Envío gratis.",
        keywords: ["bioestimulante orgánico", "cultivo indoor", "estimulador de raíces", "Azospirillum", "Azotobacter", "absorción de nutrientes"],

        // Copy visible — v3 §5
        h1: "Bioestimulante orgánico para cultivo indoor",
        tagline: "El catalizador que potencia todo lo demás.",
        parrafoIntro:
            "Bioestimulante 100% orgánico para cultivo indoor, fabricado en biorreactor industrial con cepas seleccionadas de Azospirillum y Azotobacter. Hasta 70% más efectivo que micorrizas tradicionales. Estimula el desarrollo radicular, potencia la absorción de nutrientes y activa defensas naturales. Compatible con todos los fertilizantes del catálogo: Línea Pro, Línea Elite y Línea Race.",
        descripcion:
            "Bioestimulante 100% orgánico para cultivo indoor. Fabricado en biorreactor industrial con Azospirillum y Azotobacter — 70% más efectivo que las micorrizas tradicionales. Estimula raíces, potencia absorción de nutrientes y activa defensas naturales.",
        quote: "La diferencia entre un cultivo indoor bueno y uno excelente arranca por la raíz. El Bio Estimulante es el primer paso.",

        producto: "/img/productos/bio-estimulante/perspectiva-1-grande-rosa-sin-fondo.png",
        productoSecundario: "/img/productos/bio-estimulante/lateral-grande-rosa-sin-fondo.png",
        ctaTexto: "Ver Bio Estimulante",
        ctaHref: "/bio-estimulante",
        bgColor: "#F7D6DC",
        accentColor: "#FFFFFF",
        textColor: "#1A1A1A",
    },
    {
        slug: "cloner",
        orden: 2,
        kicker: "ETAPA 02 · NACIMIENTO",
        nombreCorto: "CLONER",
        nombreDestacado: "Gel",

        // SEO meta — v3 §6
        seoTitle: "Gel Enraizante para Esquejes | Cloner — Holistic Growshop",
        seoDescription:
            "Cloner Holistic: gel enraizante de alta adherencia para esquejes. Prendimiento rápido y uniforme, mínima manipulación. El punto de partida de cada ciclo de cultivo indoor. Envío gratis.",
        keywords: ["gel enraizante", "esquejes", "prendimiento rápido", "cultivo indoor", "enraizante para clones"],

        // Copy visible — v3 §6
        h1: "Gel enraizante para esquejes. El primer paso del ciclo.",
        tagline: "Todo empieza con un corte.",
        parrafoIntro:
            "Cloner es el gel enraizante de alta adherencia de Holistic para esquejes y plantines. Fórmula de contacto rápido que acelera el prendimiento radicular con mínima manipulación. El comienzo del ciclo que define la calidad del resultado final. Compatible con todo el catálogo Holistic.",
        descripcion:
            "Gel enraizante de alta adherencia para esquejes y plantines. Fórmula de contacto rápido para prendimiento radicular con mínima manipulación. Donde nace la próxima cosecha.",
        quote: "El comienzo del ciclo define la calidad del resultado final.",

        producto: "/assets/productos/cloner2.png",
        productoSecundario: null,
        ctaTexto: "Ver Cloner",
        ctaHref: "/cloner",
        bgColor: "#E4D5F2",
        accentColor: "#6B3BAF",
        textColor: "#1A1A1A",
    },
    {
        slug: "linea-race",
        orden: 3,
        kicker: "ETAPA 03 · VELOCIDAD",
        nombreCorto: "LÍNEA",
        nombreDestacado: "RACE",

        // SEO meta — v4 (2026-05-23): indoor + outdoor, Race 4 = Micro + Magnesio,
        // Race 3 dividida en 1ª y 2ª parte PK de crecimiento y maduración.
        seoTitle: "Línea Race — Sistema Completo de Fertilizantes para Indoor y Outdoor | Holistic",
        seoDescription:
            "Línea Race Holistic: 4 fertilizantes para el ciclo completo de cultivo indoor y outdoor. Race 1 (NPK), Race 2 (Calcio + Nitrógeno, Part A + B), Race 3 (PK de crecimiento y maduración en 2 partes) y Race 4 (Micro + Magnesio). Envío gratis.",
        keywords: ["sistema de fertilizantes", "cultivo indoor", "cultivo outdoor", "fertilizante NPK", "fertilizante PK", "calcio y nitrógeno", "micro y magnesio", "autoflorecientes", "ciclo completo"],

        // Copy visible — v4
        h1: "Sistema completo de fertilizantes para cultivo indoor y outdoor.",
        tagline: "Velocidad máxima para cultivos exigentes.",
        parrafoIntro:
            "Línea Race es el sistema de fertilizantes de Holistic para cultivadores que priorizan velocidad y rendimiento. Cuatro fórmulas para todo el ciclo indoor y outdoor: Race 1 (NPK que se usa durante todo el ciclo), Race 2 (Calcio + Nitrógeno, Part A + B), Race 3 (PK de crecimiento y maduración en dos partes) y Race 4 (Micro + Magnesio).",
        descripcion:
            "4 fertilizantes para el ciclo completo indoor y outdoor: Race 1 (NPK), Race 2 (Calcio + Nitrógeno), Race 3 (PK de crecimiento y maduración, 2 partes) y Race 4 (Micro + Magnesio). Diseñada para extraer el máximo rendimiento en cada cultivo.",
        quote: "La velocidad sin control es ruido. Race es el fertilizante que te da las dos cosas: velocidad y precisión, indoor y outdoor.",

        producto: "/img/productos/linea-race/500ml/race-1-verde-500ml.png",
        productoSecundario: "/img/productos/linea-race/500ml/race-4-rosa-500ml.png",
        ctaTexto: "Ver Línea Race",
        ctaHref: "/linea-race",
        bgColor: "#C7F0DD",
        accentColor: "#2E8F6E",
        textColor: "#1A1A1A",
    },
    {
        slug: "linea-elite",
        orden: 4,
        kicker: "ETAPA 04 · MÁXIMO RENDIMIENTO",
        nombreCorto: "LÍNEA",
        nombreDestacado: "ELITE",

        // SEO meta — v3 §3
        seoTitle: "Fertilizante para Hidroponía y Sustrato Inerte | Línea Elite — Holistic",
        seoDescription:
            "Línea Elite Holistic: fertilizante líquido en dos partes (Part 1 + Part 2) para hidroponía, NFT, DWC, coco y sustratos inertes. NPK completo, pH auto-buffer 5.8–6.2, ciclo completo sin cambiar de producto. Envío gratis.",
        keywords: ["fertilizante para hidroponía", "fertilizante para sustrato inerte", "NFT", "DWC", "coco", "NPK completo", "pH auto-buffer", "ciclo completo"],

        // Copy visible — v3 §3
        h1: "Fertilizante premium para hidroponía y sustrato inerte. Dos partes, un ciclo completo.",
        tagline: "Cuando buscás el resultado superior.",
        parrafoIntro:
            "Part 1 + Part 2: el fertilizante dual de Holistic para cultivadores de hidroponía, NFT, DWC, coco y sustratos 100% inertes. Concentración máxima de NPK en cada riego, pH auto-buffer entre 5.8 y 6.2, resultados consistentes cosecha tras cosecha.",
        descripcion:
            "Sistema premium de dos componentes (Part 1 + Part 2) para hidroponía, NFT, DWC, coco y sustratos inertes. NPK completo, pH auto-buffer 5.8–6.2, todo el ciclo sin cambiar de producto.",
        quote: "Lo que separa una cosecha buena de una excelente está en el fertilizante que elegís. Línea Elite no deja márgenes de error.",

        producto: "/img/productos/linea-elite/1l/parte-1-perspectiva-1l.png",
        productoSecundario: "/img/productos/linea-elite/1l/juntos-1l.png",
        ctaTexto: "Ver Línea Elite",
        ctaHref: "/linea-elite",
        bgColor: "#F7F3EA",
        accentColor: "#C9A34E",
        textColor: "#1A1A1A",
    },
    {
        slug: "linea-pro",
        orden: 5,
        kicker: "ETAPA 05 · PRECISIÓN",
        nombreCorto: "LÍNEA",
        nombreDestacado: "PRO",

        // SEO meta — v3 §2
        seoTitle: "Fertilizante Hidrosoluble para Sustratos Compuestos | Línea Pro — Holistic",
        seoDescription:
            "Línea Pro Holistic: 4 fertilizantes hidrosolubles para el ciclo completo en sustratos compuestos. Enraizante, Vegetativo, Preflora y Flora. EC programable, pH estable, 36 meses de vida útil. Disponible en 25g, 100g, 500g y 1kg. Envío gratis.",
        keywords: ["fertilizante hidrosoluble", "fertilizante para sustratos compuestos", "ciclo completo", "enraizante", "vegetativo", "prefloración", "floración", "EC programable", "pH estable"],

        // Copy visible — v3 §2
        h1: "Fertilizante hidrosoluble para sustratos compuestos. Precisión en cada etapa.",
        tagline: "Hidrosoluble. Precisión sólida.",
        parrafoIntro:
            "Cuatro fertilizantes etapa-específicos en formato sólido hidrosoluble para sustratos compuestos. Enraizante, Vegetativo, Preflora y Flora: cada uno con el ratio NPK exacto para esa fase. Pesás, disolvés, regás. EC programable, pH estable, mismo resultado en cada lote. Compatible con autoflorecientes y fotoperiódicas.",
        descripcion:
            "Sistema sólido hidrosoluble con 4 fórmulas específicas — Enraizante, Vegetativo, Preflora y Flora — disponibles en 25g, 100g, 500g y 1kg. NPK exacto por etapa, pH estable, 36 meses de vida útil.",
        quote: "Si lo podés pesar, lo podés repetir. Con Línea Pro, cada cultivo indoor es mejor que el anterior.",

        producto: "/img/productos/linea-pro/1kg/flora-1kg-1.png",
        productoSecundario: "/img/productos/linea-pro/1kg/vegetativo-1kg-1.png",
        ctaTexto: "Ver Línea Pro",
        ctaHref: "/linea-pro",
        bgColor: "#AEDAD4",
        accentColor: "#F5948A",
        textColor: "#1A1A1A",
    },
    {
        slug: "day-0",
        orden: 6,
        kicker: "ETAPA 06 · COSECHA",
        nombreCorto: "DAY",
        nombreDestacado: "0",

        // SEO meta — v3 §7
        seoTitle: "Finalizador de Cosecha para Cultivo Indoor | Day 0 — Holistic",
        seoDescription:
            "Day 0 Holistic: tratamiento finalizador previo a cosecha. Limpieza profunda, mejora de sabor y pulido del resultado final. La última decisión antes de cortar. Envío gratis.",
        keywords: ["finalizador de cosecha", "lavado de raíces", "tratamiento pre-cosecha", "cultivo indoor", "sabor", "aroma"],

        // Copy visible — v3 §7
        h1: "Finalizador de cosecha. La última decisión que define todo.",
        tagline: "El final que define todo.",
        parrafoIntro:
            "Day 0 es el tratamiento finalizador de Holistic para los últimos días del ciclo indoor. Limpieza profunda del sistema radicular, pulido del sabor, aroma y textura del resultado final. Lo que diferencia una cosecha buena de una perfecta. Se usa junto a Race 4 o como cierre exclusivo de cualquier sistema Holistic.",
        descripcion:
            "Tratamiento finalizador previo a cosecha: limpieza profunda, mejora de sabor y pulido del resultado final. La última decisión antes del corte.",
        quote: "Lo que diferencia una cosecha buena de una perfecta se decide en los últimos días.",

        producto: "/img/productos/day-0/perspectiva-1-grande-amarillo-sin-fondo.png",
        productoSecundario: "/img/productos/day-0/lateral-grande-amarillo-sin-fondo.png",
        ctaTexto: "Ver Day-0",
        ctaHref: "/day-0",
        bgColor: "#F9E79B",
        accentColor: "#1A1A1A",
        textColor: "#1A1A1A",
    },
];
