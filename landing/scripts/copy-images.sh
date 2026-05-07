#!/usr/bin/env bash
set -euo pipefail

SRC="C:/Users/Lemon/holistic-astro/src/images-web"
DST="C:/Users/Lemon/holistic-astro/public/img/productos"

# kebab-case + ascii fold
slug() {
  echo "$1" \
    | sed 's/Á/a/g; s/É/e/g; s/Í/i/g; s/Ó/o/g; s/Ú/u/g; s/Ñ/n/g' \
    | sed 's/á/a/g; s/é/e/g; s/í/i/g; s/ó/o/g; s/ú/u/g; s/ñ/n/g' \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[[:space:]]\+/-/g; s/_/-/g; s/(\([0-9]\+\))/-\1/g; s/[^a-z0-9.-]//g; s/--\+/-/g; s/-\././g; s/^-//; s/-$//'
}

copy_dir() {
  local src_sub="$1" dst_sub="$2"
  if [ ! -d "$SRC/$src_sub" ]; then return; fi
  shopt -s nullglob
  for f in "$SRC/$src_sub"/*.png; do
    base="$(basename "$f")"
    name="${base%.png}"
    new="$(slug "$name").png"
    cp -f "$f" "$DST/$dst_sub/$new"
    echo "$dst_sub/$new"
  done
  shopt -u nullglob
}

copy_dir "BIO ESTIMULANTE"     "bio-estimulante"
copy_dir "DAY 0"               "day-0"
copy_dir "ELITE MAX"           "elite-max"
copy_dir "ESQUEJERA"           "esquejera"
copy_dir "LINEA ELITE/1L"      "linea-elite/1l"
copy_dir "LINEA ELITE/500gr"   "linea-elite/500gr"
copy_dir "LINEA PRO/25gr"      "linea-pro/25gr"
copy_dir "LINEA PRO/100gr"     "linea-pro/100gr"
copy_dir "LINEA PRO/500gr"     "linea-pro/500gr"
copy_dir "LINEA PRO/1KG"       "linea-pro/1kg"
copy_dir "LINEA RACE/250ML"    "linea-race/250ml"
copy_dir "LINEA RACE/500ml"    "linea-race/500ml"
copy_dir "SPACE H"             "space-h"
