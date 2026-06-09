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
            kicker: "LÍNEA ELITE · FERTILIZANTE PARA HIDROPONÍA Y SUSTRATOS",
            headline: "Fertilizante equilibrado\npara hidroponía y sustratos.",
            claim: "Part 1 + Part 2: el fertilizante dual de Holistic para cultivadores de hidroponía, NFT, DWC, coco y sustratos. Concentración máxima de NPK en cada riego, pH auto-buffer, resultados consistentes cosecha tras cosecha.",
            ctaPrimary:   { label: "COMPRAR ELITE",        href: "/shop?categoria=elite" },
            ctaSecondary: { label: "VER GUÍA DE USO", href: "#specs" },
            color: "#C9A34E",
            colorSoft: "#F7F3EA",
            // Hero BANNER (tormenta/rayos) — reemplaza al video por pedido
            // del cliente (2026-06-05). Mobile usa la versión 9:16 "celu".
            heroBanner: {
                src: "/imagenes-web/banners/banner-elite.webp",
                w: 2560, h: 1441,
                mobile: { src: "/imagenes-web/banners/banner-elite-celu.webp", w: 1080, h: 1919 },
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
                body: "Parte 1: aporta NPK y calcio. Parte 2: aporta magnesio y micro. Aplicadas juntas en cada riego dan al cultivo todo lo que se necesita en su justa proporción — sin antagonismos químicos.",
                image: "/imagenes-web/ultimos-cambios/POTE-ELITE-UNIFICADO-INTERNA.png",
                color: "#C9A34E",
                stat: "01",
            },
            {
                kicker: "FULL-CYCLE",
                title: "Para ciclos completos de cultivo.",
                body: "Vegetativo, preflora, floración, finalizado. La misma fórmula con dosis ajustada por etapa. Menos productos para comprar, menos chances de equivocarse al dosar.",
                image: "/imagenes-web/ultimos-cambios/POTE-LINEA-ELITE-DOBLE.png",
                color: "#E5D9B8",
                stat: "02",
            },
            {
                kicker: "SUSTRATO & HIDRO",
                title: "Adaptable a cada sistema.",
                body: "Coco, perlita, lana de roca, NFT, DWC, turba y sustratos compuestos. Los nutrientes son 100% biodisponibles: la planta los absorbe directamente sin depender de la microbiología del sustrato.",
                image: "/imagenes-web/ultimos-cambios/POTE-DOBLE-5LT.png",
                color: "#B8923A",
                stat: "03",
            },
            {
                kicker: "PUREZA",
                title: "Nutrición concentrada.",
                body: "Materias primas superiores. Cada lote pasa control de pureza, EC y pH antes de envasarse. Trazabilidad completa.",
                image: "/imagenes-web/ultimos-cambios/POTE-20LT.png",
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
            { title: "pH auto-buffer",        body: "La fórmula mantiene el pH de la solución, sin ajustes manuales constantes.",                  emoji: "⚖" },
            { title: "EC predecible",          body: "Dosis exacta = EC exacta. Repetible riego tras riego, lote tras lote.",                                       emoji: "📊" },
            { title: "Sin precipitados",       body: "Part 1 y Part 2 están diseñadas para mezclarse en el agua sin formar sales insolubles.",                     emoji: "✦" },
            { title: "Concentración máxima",  body: "Más nutriente por ml — menos botellas, más densidad activa.",                                                 emoji: "◆" },
            { title: "Soporte técnico",        body: "Acompañamiento humano en arranque, ajustes y diagnóstico. Sin call centers.",                                emoji: "♥" },
            { title: "Trazabilidad de lote",   body: "Sabés exactamente qué materia prima entró en tu botella.",                                                    emoji: "✓" },
        ],
        // Cubre el rango completo: pequeñas (250ml–1L PNG con alpha),
        // intermedias (5L) y grandes industriales (10L y 20L apilados).
        // Las imágenes "apiladas" comunican volumen y nivel pro.
        formats: [
            { name: "250 ML",   size: "250ml",  image: "/imagenes-web/productos/linea-elite/elite-unificado.png" },
            { name: "500 ML",   size: "500ml",  image: "/imagenes-web/productos/linea-elite/elite-part-2.png" },
            { name: "1 LITRO",  size: "1L",     image: "/imagenes-web/productos/linea-elite/elite-part-1.png" },
            { name: "5 LITROS", size: "5L",     image: "/imagenes-web/productos/elite-max/a-5-lts-perspectiva-1.png" },
            { name: "10 LITROS",size: "10L",    image: "/imagenes-web/productos/elite-max/10-litros-apilados.png" },
            { name: "20 LITROS",size: "20L",    image: "/imagenes-web/productos/elite-max/20-litros-apilados.png" },
        ],
        system: {
            title: "Diseñado para integrar el sistema Holistic.",
            body: "Elite es el corazón del catálogo. Combiná con Race para acelerar floración, con Bio Estimulante en el arranque, con Day-0 para el cierre. Un solo equipo técnico atrás de todos los productos.",
            chips: ["+ Bio Estimulante", "+ Race", "+ Day-0"],
        },
        // Pullquote removido por pedido del cliente — antes decía
        // "Lo que separa una cosecha buena...". ProductDeepDive omite
        // la sección entera (texto + imagen decorativa) cuando es falsy.
        pullquote: "",
        techSpecs: [
            { label: "Composición",      value: "Parte 1: aporta NPK y calcio · Parte 2: aporta magnesio y micro" },
            { label: "Forma",             value: "Líquido concentrado" },
            { label: "Aplicación",        value: "Hidroponía, sustratos inertes, coco, turba, lana de roca, sustratos orgánicos" },
            { label: "Dosis vegetativo",  value: "0.5 a 5 ml/L de cada parte" },
            { label: "Dosis floración",   value: "2 a 5 ml/L de cada parte" },
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
            ctaSecondary: { label: "VER GUÍA DE USO", href: "#specs" },
            color: "#F5948A",
            colorSoft: "#FFE3DE",
            // Hero BANNER nuevo (potes flotando, fondo oscuro dramático,
            // 2026-06-05). Mobile usa la versión 9:16 "celu".
            heroBanner: {
                src: "/imagenes-web/banners/banner-pro.webp",
                w: 2560, h: 1441,
                mobile: { src: "/imagenes-web/banners/banner-pro-celu.webp", w: 1080, h: 1919 },
            },
            heroBackground: true,
        },
        // Highlights de Pro: paleta coral/salmón. Renders nuevos
        // (zip 2026-05-31) que muestran cada etapa del ciclo
        // (Enraizante, Vegetativo, Preflora, Floración).
        highlights: [
            {
                kicker: "FÓRMULA POR ETAPA",
                title: "Una para cada momento.",
                body: "Enraizante, Vegetativo, Preflora y Flora. Cada una desarrollada para el perfil nutricional exacto que la planta necesita en esa fase.",
                image: "/imagenes-web/productos/linea-pro/100gr/enraizante-100gr-1.png",
                color: "#F5948A",
                stat: "01",
            },
            {
                kicker: "FORMATO SÓLIDO",
                title: "Sin agua, sin alcohol, sin conservantes.",
                body: "100% materia activa. El fertilizante sólido no pierde potencia con el calor ni con el tiempo: 36 meses de vida útil garantizados.",
                image: "/imagenes-web/productos/linea-pro/100gr/vegetativo-100gr-1.png",
                color: "#FFB39B",
                stat: "02",
            },
            {
                kicker: "DOSIS EXACTA",
                title: "Al gramo.",
                body: "Balanceá tu reservorio con precisión de laboratorio. Misma cucharita, misma EC, mismo resultado.",
                image: "/imagenes-web/productos/linea-pro/100gr/pre-floracion-100gr-1.png",
                color: "#E87C70",
                stat: "03",
            },
            {
                kicker: "ECONÓMICO",
                title: "Más cosechas por kilo.",
                body: "Más concentrado que líquidos: menor costo por dosis y menor logística.",
                image: "/imagenes-web/productos/linea-pro/100gr/floracion-100gr-1.png",
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
            { title: "Estabilidad total",     body: "Sin agua = sin caducidad acelerada. Vida útil garantizada, sin pérdida de actividad.",          emoji: "♢" },
            { title: "Sin almacenamiento frío",body: "Conservalo donde quieras. No requiere heladera ni rangos estrictos.",                       emoji: "✦" },
            { title: "pH ideal",               body: "Cada Pro trabaja en el rango óptimo del cultivo sin shock de pH.",                            emoji: "⚖" },
            { title: "Mezcla limpia",          body: "Disuelve completo en agua tibia sin residuos — sin filtros que limpiar.",                   emoji: "○" },
            { title: "Compatible con fertirriego", body: "El sólido disuelto se comporta como un líquido premium en cualquier sistema.",              emoji: "↯" },
            { title: "Trazabilidad por lote",  body: "Cada bolsa impresa con lote y composición exacta del análisis.",                            emoji: "✓" },
        ],
        // Selector de FORMATO por tamaño (pedido cliente 2026-06-09): en
        // vez de las 4 etapas, mostramos el pote de Pro en sus 4 medidas
        // 25g · 100g · 500g · 1kg. Cada tab muestra la foto del pote
        // correspondiente a ese tamaño.
        formats: [
            { name: "25 G",   size: "25g",   image: "/imagenes-web/productos/linea-pro/25gr/vegetativo-25gr-1.png" },
            { name: "100 G",  size: "100g",  image: "/imagenes-web/productos/linea-pro/100gr/vegetativo-100gr-1.png" },
            { name: "500 G",  size: "500g",  image: "/imagenes-web/productos/linea-pro/500gr/vegetativo-500gr-1.png" },
            { name: "1 KG",   size: "1kg",   image: "/imagenes-web/productos/linea-pro/1kg/vegetativo-1kg-1.png" },
        ],
        system: {
            title: "Encaja con todo el catálogo.",
            body: "Pro es la opción técnica del cultivador que mide. Mezclable con Bio Estimulante en arranque, con Race para acelerar floración y con Day-0 al cierre.",
            chips: ["+ Bio Estimulante", "+ Day-0", "+ Race"],
        },
        // Pullquote removido por pedido del cliente — antes decía
        // "Si lo podés pesar, lo podés repetir...". ProductDeepDive
        // omite la sección entera (texto + imagen) cuando es falsy.
        pullquote: "",
        techSpecs: [
            { label: "Composición",     value: "NPK + Mg + S + micronutrientes" },
            { label: "Forma",            value: "Sólido cristalino hidrosoluble" },
            { label: "Solubilidad",      value: "100% en agua" },
            { label: "Dosis",            value: "0.5 – 1.5 g/L según etapa" },
            { label: "Conservación",     value: "Lugar seco, hasta 36 meses" },
            { label: "Presentaciones",   value: "25 g · 100 g · 500 g · 1 kg" },
            { label: "Etapas",           value: "Enraizante · Vegetativo · Preflora · Flora" },
        ],
    },

    "linea-race": {
        hero: {
            kicker: "LÍNEA RACE",
            headline: "Sistema adaptable de fertilizantes\npara cultivo indoor y outdoor.",
            claim: "Línea Race es el sistema de fertilizantes de Holistic para cultivadores que priorizan velocidad y rendimiento. Cinco fórmulas para todo el ciclo indoor y outdoor: Race 1 (NPK que se usa durante todo el ciclo), Race 2 (Calcio + Nitrógeno), Race 3 (PK de crecimiento y maduración en dos partes) y Race 4 (Micro + Magnesio).",
            ctaPrimary:   { label: "COMPRAR RACE",        href: "/shop?categoria=race" },
            ctaSecondary: { label: "VER GUÍA DE USO", href: "#specs" },
            color: "#2E8F6E",
            colorSoft: "#C7F0DD",
            // Hero BANNER: imagen del slider full HD como hero limpio (imagen
            // entera arriba + texto/CTAs debajo). Reemplaza al video cinematic
            // por pedido del cliente. w/h evitan CLS (aspect-ratio intrínseco).
            heroBanner: {
                src: "/imagenes-web/banners/banner-race.webp",
                w: 1536, h: 1024,
                mobile: { src: "/imagenes-web/banners/banner-race-celu.webp", w: 1080, h: 1919 },
            },
            heroBackground: true,
            heroImage: "/imagenes-web/productos/linea-race/1l/race-1-verde-1l-f1.webp",
        },
        // Cada highlight tiene su imagen propia + color tema. El componente
        // ProductHighlights lee estos colores (vía data-colors) para teñir
        // halo, big number atrás, gradient bg, dot pulsante, partículas
        // orbitales y progress bar de cada highlight activa.
        // Highlights con renders premium 500ml (zip 2026-05-23). Cada panel
        // muestra la botella real del SKU correspondiente al chapter.
        highlights: [
            {
                kicker: "TODO EL CICLO",
                title: "Race 1 — NPK concentrado.",
                body: "Nitrógeno: motor del crecimiento vegetativo — hojas, tallos y clorofila. Fósforo: raíces fuertes y transferencia de energía. Potasio: regula el metabolismo, fortalece tallos y sube la resistencia a plagas y estrés.",
                image: "/imagenes-web/productos/linea-race/1l/race-1-verde-1l-f1.webp",
                color: "#3DA86E",
                stat: "01",
            },
            {
                kicker: "ESTRUCTURA",
                title: "Race 2 — Calcio + Nitrógeno.",
                body: "Forma paredes celulares fuertes, impulsa el crecimiento de raíces y brotes, y mejora la resistencia ante plagas y sequías.",
                image: "/imagenes-web/productos/linea-race/1l/race-2-celeste-1l-f1.webp",
                color: "#3FB5CB",
                stat: "02",
            },
            {
                kicker: "3A",
                title: "Race 3 (PK de crecimiento y maduración).",
                body: "Son 2 partes PK de crecimiento y maduración. Activan la translocación de azúcares y agrandan flores en el pico productivo del ciclo.",
                image: "/imagenes-web/productos/linea-race/1l/race-3-violeta-a-1l-f1.webp",
                color: "#8E24AA",
                stat: "03",
            },
            {
                kicker: "3B",
                title: "Race 3 (PK de crecimiento y maduración).",
                body: "Son 2 partes PK de crecimiento y maduración. Aplicadas en secuencia, sostienen el desarrollo de flores densas hasta el cierre del ciclo.",
                image: "/imagenes-web/productos/linea-race/1l/race-3-violeta-b-1l-f1.webp",
                color: "#8E24AA",
                stat: "04",
            },
            {
                kicker: "MICRO + MAGNESIO",
                title: "Race 4 — Micro + Magnesio.",
                body: "Microelementos (Fe, Zn, B, Mn, Cu, Mo) que activan enzimas, fotosíntesis y división celular. Magnesio: núcleo de la clorofila — energía y desarrollo de hojas, raíces y flores.",
                image: "/imagenes-web/productos/linea-race/1l/race-4-rosa-1l-f1.webp",
                color: "#F472B6",
                stat: "05",
            },
        ],
        bigStat: {
            num: 5,
            suffix: " fertilizantes",
            label: "EL CICLO COMPLETO",
            body: "Race 1 (NPK), Race 2 (Calcio + Nitrógeno), Race 3 (PK de crecimiento y maduración, 1ª y 2ª parte) y Race 4 (Micro + Magnesio). Cinco fertilizantes para el ciclo completo, indoor y outdoor.",
        },
        features: [
            { title: "Concentración alta",     body: "1 ml/L típicamente. Menos plástico, más nutriente por riego.",                          emoji: "◆" },
            { title: "pH ideal",               body: "Cada Race trabaja en el rango óptimo del cultivo sin shock de pH.",                     emoji: "⚖" },
            { title: "Estabilidad en mezcla",  body: "Fórmulas mezclables sin precipitar, en el orden indicado.",                             emoji: "✦" },
            { title: "Compatible con Elite",   body: "Race se puede usar con Elite como booster de floración.",                              emoji: "↯" },
            { title: "Velocidad real",         body: "Indoor, outdoor, ciclos cortos, autoflorecientes y fotoperiódicas.",emoji: "⚡" },
            { title: "Soporte de uso",         body: "Tabla de dosificación clara. Variantes para indoor/outdoor incluidas.",                  emoji: "♥" },
        ],
        // 4 fórmulas con imágenes editoriales (5528, 5529, 5530, 5531)
        // entregadas por el cliente. Orden literal del usuario.
        // El componente RaceFormatsShowcase reemplaza al pdd__formats
        // genérico para Race con stage central + partículas + tabs
        // animadas — cuando slug=linea-race el ProductDeepDive omite
        // su sección de formats y monta el showcase.
        // Selector "Elegí el formato" genérico (pdd__formats) por MEDIDA:
        // las 6 presentaciones reales del shop (250ml · 500ml · 1L · 5L · 10L ·
        // 20L — ver server/routes/shop.js presentaciones). Imagen = el mismo
        // render que usa el shop por medida (shopImageSet.js): tarro de costado
        // para 250/500/1L, bidón -f1 para 5/10/20L. Race 1 verde como
        // representativo; sublabel "Las 5 fórmulas" (son 5 sistemas).
        formats: [
            { name: "250 ML", size: "Las 5 fórmulas", color: "#3DA86E", image: "/imagenes-web/productos/linea-race/250ml/race-1-verde-tarro.webp" },
            { name: "500 ML", size: "Las 5 fórmulas", color: "#3DA86E", image: "/imagenes-web/productos/linea-race/500ml/race-1-verde-tarro-500ml.webp" },
            { name: "1 L",    size: "Las 5 fórmulas", color: "#3DA86E", image: "/imagenes-web/productos/linea-race/1l/race-1-verde-tarro-1l.webp" },
            { name: "5 L",    size: "Las 5 fórmulas", color: "#3DA86E", image: "/imagenes-web/productos/linea-race/5l/race-1-verde-5l-f1.webp" },
            { name: "10 L",   size: "Las 5 fórmulas", color: "#3DA86E", image: "/imagenes-web/productos/linea-race/10l/race-1-verde-10l-f1.webp" },
            { name: "20 L",   size: "Las 5 fórmulas", color: "#3DA86E", image: "/imagenes-web/productos/linea-race/20l/race-1-verde-20l-f1.webp" },
        ],
        system: {
            title: "El motor del catálogo.",
            body: "Race es la línea más enfocada en performance. Combinable con Elite o Pro (hidrosoluble) según preferencia. Day-0 al final, siempre.",
            chips: ["+ Elite", "+ Pro", "+ Day-0", "+ Bio Estimulante"],
        },
        // Pullquote removido por pedido del cliente — antes decía
        // "La velocidad sin control es ruido...". El componente
        // ProductDeepDive omite la sección entera cuando pullquote es
        // falsy, así que vaciarlo elimina también la imagen decorativa.
        pullquote: "",
        techSpecs: [
            { label: "Composición",     value: "Race 1 NPK · Race 2 Ca + N · Race 3 PK (1ª y 2ª parte) · Race 4 Micro + Magnesio" },
            { label: "Forma",            value: "Líquido concentrado" },
            { label: "Dosis típica",     value: "0,5ml – 4ml" },
            { label: "Compatibilidad",   value: "Sustratos inertes, sustratos compuestos, coco, lana de roca, hidro, tierra — indoor y outdoor." },
            { label: "Conservación",     value: "Bajo techo, 5–25°C, 24 meses" },
            { label: "Presentaciones",   value: "250 ml · 500 ml" },
            { label: "Variantes",        value: "5 fertilizantes para el ciclo completo" },
        ],
    },

    "bio-estimulante": {
        hero: {
            kicker: "BIO ESTIMULANTE · ORGÁNICO PARA CULTIVO INDOOR & OUTDOOR",
            headline: "Bioestimulante orgánico\npara cultivo indoor y outdoor.",
            claim: "Bioestimulante 100% orgánico para cultivo indoor y outdoor, fabricado en biorreactor industrial con materias primas seleccionadas. Hasta 70% más efectivo que micorrizas tradicionales. Estimula el desarrollo radicular, potencia la absorción de nutrientes y activa defensas naturales. Compatible con todos los fertilizantes del catálogo: Línea Pro, Línea Elite y Línea Race.",
            ctaPrimary:   { label: "COMPRAR BIO",           href: "/shop?categoria=bio" },
            ctaSecondary: { label: "VER GUÍA DE USO", href: "#specs" },
            color: "#E8A5B1",
            colorSoft: "#F7D6DC",
            // Hero BANNER nuevo (corales rosados, fondo claro, 2026-06-05).
            // Mobile usa la versión 9:16 "celu".
            heroBanner: {
                src: "/imagenes-web/banners/banner-bio.webp",
                w: 2560, h: 1441,
                mobile: { src: "/imagenes-web/banners/banner-bio-celu.webp", w: 1080, h: 1919 },
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
                body: "No es un té de compost casero: es un bioestimulante orgánico producido en fermentadores industriales controlados.",
                image: "/imagenes-web/fotos-productos/BIOESTIMULANTE-SLIDER.png",
                color: "#E8A5B1",
                stat: "01",
            },
            {
                kicker: "SINERGIA",
                title: "Acelera todo lo demás.",
                body: "Aplicado junto a Elite, Pro o Race, multiplica la eficiencia de absorción radicular. La planta toma más nutrientes con menos input.",
                image: "/imagenes-web/productos/bio-estimulante/perspectiva-2-grande-rosa-sin-fondo.png",
                color: "#F7B8C5",
                stat: "02",
            },
            {
                kicker: "VERSÁTIL",
                title: "Para todo el ciclo.",
                body: "Una sola botella para activar raíces, mejorar foliage y reforzar defensas naturales. Multifunción real.",
                image: "/imagenes-web/race/root-detail.jpg",
                color: "#F091A5",
                stat: "03",
            },
            {
                kicker: "SEGURIDAD",
                title: "100% orgánico, 100% inocuo.",
                body: "Sin metales pesados, sin sintéticos, para todo el ciclo.",
                image: "/imagenes-web/productos/bio-estimulante/lateral-grande-rosa-sin-fondo.png",
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
            { title: "Apto fertiriego",        body: "Esquejes, transplantes y crecimiento con un solo producto.",                emoji: "○" },
            { title: "Producción local",       body: "Fabricado en Argentina con tecnología de biorreactor industrial.",           emoji: "✓" },
        ],
        formats: [
            { name: "250ML", size: "250 ml", image: "/imagenes-web/productos/bio-estimulante/perspectiva-1-grande-rosa-sin-fondo.png" },
            { name: "500ML", size: "500 ml", image: "/imagenes-web/productos/bio-estimulante/lateral-grande-rosa-sin-fondo.png" },
        ],
        system: {
            title: "El primer paso del ciclo.",
            body: "Aplicalo en arranque, antes de cualquier otro producto. Activa raíces y defensas para que el resto del catálogo trabaje sobre una planta sana y receptiva.",
            chips: ["+ Cloner", "+ Elite", "+ Pro"],
        },
        // Pullquote removido por pedido del cliente — antes decía
        // "La diferencia entre un cultivo indoor bueno y uno excelente
        // arranca por la raíz...". ProductDeepDive omite la sección
        // entera (texto + imagen decorativa) cuando es falsy.
        pullquote: "",
        techSpecs: [
            { label: "Composición",     value: "Ácidos húmicos, ácidos fúlvicos, ácidos carboxílicos, grupos fenoles y potasio soluble" },
            { label: "Forma",            value: "Líquido orgánico" },
            { label: "Aplicación",       value: "Riego, esquejes y transplante" },
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
            ctaSecondary: { label: "VER GUÍA DE USO",   href: "#specs" },
            color: "#6B3BAF",
            colorSoft: "#E4D5F2",
            // Hero BANNER (2026-06-06). Mobile usa la versión 9:16 "celu".
            // Crudos PNG en landing/imagenes-web/IMAGENES/banners-crudos/.
            heroBanner: {
                src: "/imagenes-web/banners/banner-cloner.webp",
                w: 2560, h: 1707,
                mobile: { src: "/imagenes-web/banners/banner-cloner-celu.webp", w: 1080, h: 1919 },
            },
            heroBackground: true,
        },
        // Highlights de Cloner: paleta violeta. Fotos propias del cliente
        // (2026-06-06) en imagenes-web/cloner-slider/ (crudos PNG en
        // landing/imagenes-web/IMAGENES/cloner-slider-crudos/).
        highlights: [
            {
                kicker: "ALTA ADHERENCIA",
                title: "Se queda donde lo aplicás.",
                body: "Gel viscoso que no escurre. Aplicás, plantás. Cubre el 100% del corte y mantiene la zona en contacto óptimo con el sustrato.",
                image: "/imagenes-web/cloner-slider/cloner-slider-1.webp",
                color: "#6B3BAF",
                stat: "01",
            },
            {
                kicker: "PRENDIMIENTO",
                title: "Tasa de éxito superior al 90%.",
                body: "Combinación de auxinas y vehículos protectores que aceleran la formación de raíces adventicias en cualquier variedad.",
                image: "/imagenes-web/cloner-slider/cloner-slider-2.webp",
                color: "#9C5FD8",
                stat: "02",
            },
            {
                kicker: "MULTIPLICACIÓN",
                title: "Pensado para producción profesional.",
                body: "Esquejes seriados, batches grandes, propagación masiva: la consistencia del gel hace que todos arranquen al mismo tiempo.",
                image: "/imagenes-web/cloner-slider/cloner-slider-3.webp",
                color: "#7D4BC9",
                stat: "03",
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
            { title: "Trazable",              body: "Sabés exactamente con qué estás trabajando.",                                       emoji: "○" },
        ],
        // Sección "Elegí el formato" removida por pedido del cliente
        // (2026-06-07): mostraba la esquejera como workaround y confundía
        // (Cloner viene en un solo formato). Vacío → el bloque no se monta.
        formats: [],
        system: {
            title: "Donde nace la próxima cosecha.",
            body: "Cloner es el punto de entrada del ciclo. Aplicalo junto a Bio Estimulante en el agua del propagador y entrá a vegetativo con plantas vigorosas listas para Elite o Pro.",
            chips: ["+ Bio Estimulante"],
        },
        // Pullquote removido por pedido del cliente (sección arriba de
        // "Datos del producto"). Vacío → el bloque no se renderiza.
        pullquote: "",
        techSpecs: [
            { label: "Forma",             value: "Gel de alta viscosidad" },
            { label: "Principio activo",  value: "Ácidos carboxílicos, ácidos húmicos, ácidos fúlvicos, enzimas enraizantes" },
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
            claim: "Day 0 es el tratamiento finalizador de Holistic para los últimos días del ciclo indoor. Se usa junto a Race, Pro o Elite, como cierre de cualquier sistema Holistic.",
            ctaPrimary:   { label: "COMPRAR DAY-0",          href: "/shop?categoria=day0" },
            ctaSecondary: { label: "VER GUÍA DE USO",   href: "#specs" },
            color: "#C9A34E",
            colorSoft: "#F9E79B",
            // Hero BANNER nuevo (splash de agua, fondo blanco, 2026-06-05).
            // Mobile usa la versión 9:16 "celu".
            heroBanner: {
                src: "/imagenes-web/banners/banner-day0.webp",
                w: 2560, h: 1707,
                mobile: { src: "/imagenes-web/banners/banner-day0-celu.webp", w: 1080, h: 1919 },
            },
            heroBackground: true,
        },
        // Highlights de Day-0: paleta amarilla/dorada — el "cierre"
        // del ciclo. Botella en distintas perspectivas comunican el
        // ritual final pre-cosecha.
        highlights: [
            {
                kicker: "LIMPIEZA",
                title: "Cierre limpio.",
                body: "Aplicado en los últimos riegos antes del corte, ayuda a vaciar los reservorios internos de la planta de excesos minerales y mejora el bouquet final.",
                image: "/video/internas/day-0/highlight-01.mp4",
                mediaType: "video",
                color: "#D4B34A",
                stat: "01",
            },
            {
                kicker: "SIN QUÍMICOS",
                title: "El detalle que se nota.",
                body: "La diferencia entre una cosecha técnica y una excelente.",
                image: "/imagenes-web/productos/day-0/perspectiva-2-grande-amarillo-sin-fondo.png",
                color: "#F0D56D",
                stat: "02",
            },
            {
                kicker: "TIMING",
                title: "Programable al día.",
                body: "5 días antes del corte estimado. La planta ajusta su metabolismo y el cultivador llega al día 0 con una flor pulida.",
                image: "/imagenes-web/productos/day-0/lateral-grande-amarillo-sin-fondo.png",
                color: "#C9A34E",
                stat: "03",
            },
            {
                kicker: "UNIVERSAL",
                title: "Compatible con cualquier sistema.",
                body: "Funciona después de Elite, Pro o Race. Independiente del nutriente principal — es el cierre que une todo el catálogo.",
                image: "/imagenes-web/productos/day-0/lateral-2-grande-amarillo-sin-fondo.png",
                color: "#F9E79B",
                stat: "04",
            },
        ],
        bigStat: {
            num: 5,
            suffix: " días",
            label: "PROTOCOLO DE CIERRE",
            body: "Programá el último riego de Day-0 cinco días antes del corte estimado. La planta usa esos días para metabolizar reservas internas y entregar el sabor final más limpio posible.",
        },
        features: [
            { title: "Sin shock",               body: "Transición suave del nutriente principal a la fase de cierre.",                  emoji: "◇" },
            { title: "Compatibilidad total",    body: "Después de cualquier línea Holistic — Elite, Pro, Race.",                       emoji: "↯" },
            { title: "Aplicación simple",       body: "Una sola dosis por riego en los últimos 5 días. Sin escalones complejos.",   emoji: "○" },
            { title: "Validado en cultivo",     body: "Probado en variedades indoor/outdoor con resultado consistente.",                emoji: "✓" },
        ],
        formats: [
            { name: "250ML", size: "250 ml", image: "/imagenes-web/productos/day-0/perspectiva-1-grande-amarillo-sin-fondo.png" },
            { name: "500ML", size: "500 ml", image: "/imagenes-web/productos/day-0/lateral-grande-amarillo-sin-fondo.png" },
        ],
        system: {
            title: "El cierre del catálogo.",
            body: "Day-0 es la última decisión del cultivo. Después de Elite, Pro o Race — antes del corte. Cierra el ciclo con la calidad que merece.",
            chips: ["+ Elite", "+ Pro", "+ Race"],
        },
        // Pullquote removido por pedido del cliente (sección arriba de
        // "Datos del producto"). Vacío → el bloque no se renderiza.
        pullquote: "",
        techSpecs: [
            { label: "Forma",             value: "Líquido / 250 ml" },
            { label: "Aplicación",         value: "Últimos 5 días pre-cosecha" },
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
