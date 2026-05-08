// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // URL de produccion. Astro la usa para generar sitemap, og:url, canonical
  // y links absolutos. Cuando movamos el DNS al Vercel, va a coincidir;
  // mientras tanto el deploy en *.vercel.app sigue funcionando — esto solo
  // afecta meta tags y sitemap, no la accesibilidad del sitio.
  site: 'https://hgrowshop.com',

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },
});