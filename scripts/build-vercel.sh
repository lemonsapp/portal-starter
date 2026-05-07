#!/usr/bin/env bash
#
# scripts/build-vercel.sh — buildea landing Astro + portal React, mergea en dist/
#
# Sprint 13: integracion landing + portal en un solo deploy de Vercel.
#
# Estructura final de dist/:
#   dist/index.html               ← landing Astro
#   dist/_astro/*                 ← chunks CSS/JS de Astro
#   dist/assets/*                 ← public/ de Astro (imagenes productos, logo)
#   dist/favicon.ico              ← favicon de la landing
#   dist/portal/index.html        ← shell del SPA React
#   dist/portal/assets/*          ← chunks JS/CSS de React (con base /portal/)
#
# Vercel rewrites (vercel.json) mandan rutas del portal a /portal/index.html
# para que React Router las maneje sin colisionar con la landing.

set -euo pipefail

echo "▶ [1/3] Building landing (Astro)…"
cd landing
npm install --no-audit --no-fund
npm run build
cd ..

echo "▶ [2/3] Building portal (React + Vite)…"
cd client
npm install --no-audit --no-fund
npm run build
cd ..

echo "▶ [3/3] Merging dists into ./dist/…"
rm -rf dist
mkdir -p dist
# Landing al raiz
cp -r landing/dist/. dist/
# Portal bajo /portal/
mkdir -p dist/portal
cp -r client/dist/. dist/portal/

echo "✓ Build completo. dist/ listo."
ls -la dist/
echo ""
echo "✓ Estructura clave:"
ls dist/portal/ | head -10
