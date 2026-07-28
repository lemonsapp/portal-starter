// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // URL de produccion. Astro la usa para generar sitemap, og:url, canonical
  // y links absolutos. Cuando movamos el DNS al Vercel, va a coincidir;
  // mientras tanto el deploy en *.vercel.app sigue funcionando — esto solo
  // afecta meta tags y sitemap, no la accesibilidad del sitio.
  site: 'https://hgrowshop.com',

  integrations: [
    react(),
    // Sitemap para Search Console. /home-classic queda afuera: es la home
    // vieja preservada como referencia, no queremos que Google la indexe
    // como página aparte.
    sitemap({
      filter: (page) => !page.includes('/home-classic'),
      // Las canonical del sitio son SIN barra final (/linea-race) — el
      // sitemap tiene que coincidir o Search Console reporta duplicados.
      serialize: (item) => ({
        ...item,
        url: item.url === 'https://hgrowshop.com/' ? item.url : item.url.replace(/\/$/, ''),
      }),
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});