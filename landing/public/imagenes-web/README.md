# imagenes-web — carpeta canónica de imágenes servidas

**TODAS las imágenes en uso por la web (landing + shop) viven acá.**
Se sirve en producción como `https://hgrowshop.com/imagenes-web/...`
(este folder es parte de `landing/public/`, que el build copia al raíz del deploy).

Consolidada el 2026-06-06 (antes estaban dispersas en `/img/`, `/assets/productos/`
y `/ultimos-cambios/`; `vercel.json` mantiene rewrites de esos prefijos viejos).

## Estructura

| Carpeta            | Contenido                                                        |
|--------------------|------------------------------------------------------------------|
| `productos/`       | Renders actuales de producto (shop + internas), por línea/tamaño |
| `fotos-productos/` | Fotos JPG del catálogo viejo y complementos (macetas, filtro…)   |
| `banners/`         | Banners hero por línea (desktop + `-celu` mobile) y OG images    |
| `race/`            | Campaña RACE: cinematic, posters, sliders de botella             |
| `race-slider/`     | Frames del slider RACE del home                                  |
| `slider-spylt/`    | Layers del slider estilo SPYLT (base/hero/silhouette/sub)        |
| `portal-race/`     | Layers del portal 3D RACE (fondo/luces/remolino/…)               |
| `elementos/`       | Iconografía de etapas (vegetativo, preflora, floración…)         |
| `ultimos-cambios/` | Renders 2026 del home (POTE-*, VEGETATIVO-*)                     |
| `marca/`           | Logo y favicon de marca (`logo.svg`, `favicon.svg`)              |
| `video-posters/`   | Posters (frames estáticos) de los videos hero                    |

## Reglas

1. **Imagen nueva → va acá adentro**, en la subcarpeta que corresponda.
2. Referenciar siempre como ruta absoluta `/imagenes-web/<carpeta>/<archivo>`.
3. Las URLs de producto en DB (`product_images.url`) también usan este prefijo
   (migración idempotente en `server/routes/shop.js`).
4. NO confundir con `landing/imagenes-web/` (archivo crudo del cliente,
   gitignoreado, no se deploya) ni con `IMAGENES-HOLISTIC/` (ídem).
5. Excepciones que NO viven acá (a propósito):
   - `/favicon.ico`, `/favicon.svg` — convención de browsers, raíz del sitio.
   - `/icons/` — íconos PWA del manifest (server `htmlBranding.js` los referencia).
   - `client/public/imagenes-web/` — mini-espejo del portal (fondos de login rotativos +
     logo) para que `npm run dev` del client funcione sin la landing.
   - `/video/` — assets de video (.mp4; sus posters JPG sí viven acá).
