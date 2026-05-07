// Service worker desactivado
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => clients.claim());
