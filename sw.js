// ============================================================
// SERVICE WORKER v6 — Asetronics Meeting-Minuten AI v2.4
// ============================================================
// Cache-Version v9: Vereinfachtes Onboarding + 2 saubere Provider.
//
// v2.4 (dieser Stand):
//   - providers/index.js: nur noch OpenAI + Gemini (jeweils 1 Key)
//   - providers/base.js: Meta-Daten auf 2 Provider reduziert
//   - app.js: Vereinfachtes Onboarding (Token-Eingabe statt Master-PW-Vergleich)
//   - showWelcomeOnboarding() als neuer Einstiegspunkt
//
// v2.3.1 (v8): Hotfix Circular Dependency
// v2.3 (v7): UI-Redesign
// ============================================================

// Cache-Version - bei jeder Code-Aenderung erhoehen!
const CACHE_NAME = 'asetronics-meeting-ai-v9';

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
    './providers/index.js',
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
    './services/docx-export.js',
    './services/audio-store.js',
    './services/tags.js',
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
//   - CDN-Bibliotheken (jsdelivr) nicht cachen (Cache-Poisoning-Schutz)
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // API-Calls, Firebase und CDN nie cachen
    const NEVER_CACHE = [
        'googleapis.com',
        'api.openai.com',
        'api.anthropic.com',
        'api.ollama.com',
        'api.minimaxi.com',
        'open.bigmodel.cn',
        'integrate.api.nvidia.com',
        'firestore.googleapis.com',
        'firebase',
        'cdn.jsdelivr.net',      // CDN-Bibliotheken immer frisch laden
        'unpkg.com',
        'cdnjs.cloudflare.com'
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
