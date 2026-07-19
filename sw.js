// ============================================================
// SERVICE WORKER — Asetronics Meeting-Minuten AI
// ============================================================
// Der Service Worker laeuft im Hintergrund und sorgt fuer:
//   1. Offline-Faehigkeit: App-Dateien werden zwischengespeichert
//   2. Schnelles Laden: Gecachte Dateien werden sofort angezeigt
//   3. PWA-Funktionalitaet: Noetig fuer die Installation auf dem Homescreen
// ============================================================

// Cache-Name mit Versionsnummer
// WICHTIG: Bei jeder Aenderung an den App-Dateien muss die Version
// erhoeht werden (z.B. v2 → v3), damit der Browser die neuen Dateien laedt
const CACHE_NAME = 'asetronics-meeting-ai-v2';

// Liste der Dateien, die gecacht (zwischengespeichert) werden sollen
const ASSETS = [
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// ============================================================
// INSTALLATION
// ============================================================
// Wird einmal ausgeloest, wenn der Service Worker zum ersten Mal
// registriert wird oder wenn sich die Version aendert.
self.addEventListener('install', (event) => {
    event.waitUntil(
        // Cache oeffnen und alle App-Dateien speichern
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS);
            })
            .then(() => {
                // Sofort aktivieren (nicht auf andere Tabs warten)
                return self.skipWaiting();
            })
    );
});

// ============================================================
// AKTIVIERUNG
// ============================================================
// Wird nach der Installation ausgeloest.
// Hier werden alte Caches geloescht (Aufraeumen).
self.addEventListener('activate', (event) => {
    event.waitUntil(
        // Alle vorhandenen Caches durchgehen
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    // Alte Caches loeschen (alles ausser dem aktuellen)
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            // Kontrolle ueber alle offenen Tabs uebernehmen
            return self.clients.claim();
        })
    );
});

// ============================================================
// FETCH-STRATEGIE: Cache-First
// ============================================================
// Bei jeder Netzwerkanfrage:
//   1. Zuerst im Cache nachschauen
//   2. Wenn nicht im Cache: aus dem Netzwerk laden
//
// Ausnahme: API-Anfragen (z.B. an Google Gemini) werden
// NICHT gecacht, weil sie immer aktuell sein muessen.
self.addEventListener('fetch', (event) => {
    // API-Aufrufe nicht cachen (z.B. an Google Gemini)
    if (event.request.url.includes('googleapis.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Wenn die Datei im Cache ist: sofort zurueckgeben
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Sonst: aus dem Netzwerk laden
                return fetch(event.request);
            })
    );
});
