// ============================================================
// PROVIDER INDEX - Registry und Haupteinstieg fuer die App
// ============================================================
// v2.4 PHILOSOPHIE:
//   Jeder hier gelistete Provider funktioniert mit NUR EINEM Key.
//   Kein "2-Stage mit OpenAI+X" mehr - das war verwirrend.
//
//   Provider mit eigenem STT + LLM (1 Key):
//     - OpenAI (sk-...):  Whisper (Audio) + GPT-4o-mini (Text)
//     - Gemini (AIzaSy...): Audio direkt in 1 Call verarbeitet
//
// Saubere Struktur (kein Circular Dependency):
//   base.js    = nur die Klasse BaseProvider + getProviderMeta
//   index.js   = importiert Provider + baut die REGISTRY auf
//   app.js     = importiert ausschliesslich von hier
//
// Neue Provider hinzufuegen:
//   1. Datei providers/xxx.js erstellen (erbt von BaseProvider aus base.js)
//   2. Hier importieren und in REGISTRY aufnehmen
//   3. WICHTIG: Darf nur 1 Key benoetigen!
// ============================================================

import { GeminiProvider } from './gemini.js';
import { OpenAIProvider } from './openai.js';

// getProviderMeta bleibt in base.js (nur statische UI-Daten, kein Zirkelbezug)
export { getProviderMeta } from './base.js';

// Liste der verfuegbaren Provider (Reihenfolge = Reihenfolge im UI)
// OpenAI zuerst, weil die meisten Nutzer einen sk-... Token haben.
const REGISTRY = [
    new OpenAIProvider(),    // 1 Key: sk-... (Whisper + GPT)
    new GeminiProvider()     // 1 Key: AIzaSy... (direkte Audio-Verarbeitung)
];

/**
 * Gibt alle verfuegbaren Provider zurueck.
 * @returns {Array<BaseProvider>}
 */
export function getAllProviders() {
    return REGISTRY;
}

/**
 * Sucht einen Provider anhand seiner ID.
 * @param {string} id - Die Provider-ID (z.B. "openai")
 * @returns {BaseProvider|null}
 */
export function getProviderById(id) {
    return REGISTRY.find(p => p.id === id) || null;
}

/**
 * Gibt die Standard-Vorbelegung zurueck.
 * v2.4: OpenAI ist Default, weil die meisten Nutzer einen sk-Token haben.
 * @returns {BaseProvider}
 */
export function getDefaultProvider() {
    return REGISTRY[0];
}
