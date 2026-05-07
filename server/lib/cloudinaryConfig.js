// server/lib/cloudinaryConfig.js
//
// Configura el SDK de Cloudinary leyendo las API keys de configStore
// (que las tiene encriptadas con MASTER_KEY en app_config). Reemplaza
// el patron viejo de cloudinary.config({ ...process.env }) que era
// deuda del Sprint 0 y rompia en deploys donde las creds NO viven en
// .env (correcto: solo el wizard las setea, no .env).
//
// Cache: re-aplica config solo si las creds cambiaron desde la ultima
// llamada (evita hits a DB en cada upload). admin-config.js llama a
// invalidateCache() cuando el admin guarda la seccion cloudinary.
//
// Fallback a process.env como ultima opcion para mantener compat con
// scripts standalone (tests, migrations) que no tengan configStore.

"use strict";

const cloudinary = require("cloudinary").v2;
const cs = require("./configStore");

let cachedSig = null;

async function configureCloudinary() {
    let cloudName, apiKey, apiSecret;
    try {
        [cloudName, apiKey, apiSecret] = await Promise.all([
            cs.getConfig("cloudinary.cloud_name"),
            cs.getConfig("cloudinary.api_key"),
            cs.getConfig("cloudinary.api_secret"),
        ]);
    } catch (e) {
        // configStore puede fallar si la tabla no existe todavia (dev fresco).
        // Caemos a env vars sin tirar el error.
        cloudName = apiKey = apiSecret = null;
    }

    const config = {
        cloud_name: cloudName || process.env.CLOUDINARY_CLOUD_NAME,
        api_key:    apiKey    || process.env.CLOUDINARY_API_KEY,
        api_secret: apiSecret || process.env.CLOUDINARY_API_SECRET,
    };

    if (!config.cloud_name || !config.api_key || !config.api_secret) {
        const err = new Error(
            "Cloudinary no esta configurado. Pegue las API keys en /admin/setup -> Cloudinary."
        );
        err.code = "CLOUDINARY_NOT_CONFIGURED";
        throw err;
    }

    // Re-config solo si las creds cambiaron (cheap signature)
    const sig = `${config.cloud_name}:${config.api_key}`;
    if (sig !== cachedSig) {
        cloudinary.config(config);
        cachedSig = sig;
    }

    return cloudinary;
}

function invalidateCache() {
    cachedSig = null;
}

module.exports = { configureCloudinary, invalidateCache };
