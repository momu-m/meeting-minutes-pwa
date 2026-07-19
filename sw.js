// ============================================================
// SERVICE WORKER v3 — Asetronics Meeting-Minuten AI v2.0
// ============================================================
// Cache-Version v3: inkl. neue Provider- und Service-Module.
//
// Neue Dateien in v3:
//   - providers/*.js (8 Module)
//   - services/*.js (4 Module)
//   - utils/*.js (3 Module)
// ============================================================

// Cache-Version - bei jeder Code-Aenderung erhoehen!
const CACHE_NAME = 'asetronics-meeting-ai-v3';

// Liste aller Dateien, die fuer Offline-Modus gecacht werden
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './print.css',
    './app.js',
    './firebase-config.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    // Provider-Module
    './providers/base.js',
    './providers/gemini.js',
    './providers/openai.js',
    './providers/anthropic.js',
    './providers/ollama.js',
    './providers/minimax.js',
    './providers/glm.js',
    './providers/nvidia.js',
    // Service-Module
    './services/crypto.js',
    './services/keyvault.js',
    './services/db.js',
    './services/notify.js',
    // Utils
    './utils/markdown.js',
    './utils/format.js',
    './utils/prompts.js'
];

// ============================================================
// INSTALLATION
// ============================================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                // addAll schlaegt fehl wenn eine Datei fehlt - deshalb
                // nutzen wir fuer jede Datei einzeln add (mit Catch)
                return Promise.all(
                    ASSETS.map(url =>
                        cache.add(url).catch(err =>
                            console.warn('Konnte nicht cachen:', url, err)
                        )
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// ============================================================
// AKTIVIERUNG - alte Caches loeschen
// ============================================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Loesche alten Cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ============================================================
// FETCH-STRATEGIE: Cache-First, Network-Fallback
// ============================================================
// Ausnahmen:
//   - API-Aufrufe (Google, OpenAI, Anthropic, etc.) nie cachen
//   - Firebase-Ressourcen immer aus dem Netz
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // API-Calls und Firebase nie cachen
    const NEVER_CACHE = [
        'googleapis.com',
        'api.openai.com',
        'api.anthropic.com',
        'api.ollama.com',
        'api.minimaxi.com',
        'open.bigmodel.cn',
        'integrate.api.nvidia.com',
        'firestore.googleapis.com',
        'firebase'
    ];

    if (NEVER_CACHE.some(host => url.includes(host))) {
        return;  // Immer ans Netz weiterleiten
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).catch(() => {
                    // Wenn beides fehlschlaegt (offline): index.html als Fallback
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
