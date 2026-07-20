// ============================================================
// PROVIDER INDEX - Registry und Haupteinstieg fuer die App
// ============================================================
// Diese Datei loest den Circular Dependency (Zirkelbezug), der
// frueher in base.js existierte:
//
//   ALT (kaputt):
//     base.js -> importiert gemini.js -> importiert BaseProvider aus base.js
//     => "Cannot access 'BaseProvider' before initialization"
//
//   NEU (sauber):
//     base.js    = nur die Klasse BaseProvider + getProviderMeta (keine Provider-Imports)
//     index.js   = importiert alle Provider + baut die REGISTRY auf
//     app.js     = importiert ausschliesslich von hier (index.js)
//
// Neue Provider hinzufuegen:
//   1. Datei providers/xxx.js erstellen (erbt von BaseProvider aus base.js)
//   2. Hier importieren und in REGISTRY aufnehmen
// ============================================================

import { GeminiProvider } from './gemini.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';
import { MiniMaxProvider } from './minimax.js';
import { GLMProvider } from './glm.js';
import { NvidiaProvider } from './nvidia.js';

// getProviderMeta bleibt in base.js, weil es nur statische UI-Daten ist
// und von ueberall ohne Zirkelbezug importiert werden darf.
export { getProviderMeta } from './base.js';

// Liste aller registrierten Provider (in dieser Reihenfolge erscheinen sie im UI)
const REGISTRY = [
    new GeminiProvider(),
    new OpenAIProvider(),
    new AnthropicProvider(),
    new OllamaProvider(),
    new MiniMaxProvider(),
    new GLMProvider(),
    new NvidiaProvider()
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
 * @param {string} id - Die Provider-ID (z.B. "gemini")
 * @returns {BaseProvider|null}
 */
export function getProviderById(id) {
    return REGISTRY.find(p => p.id === id) || null;
}

/**
 * Gibt die Standard-Vorbelegung zurueck (erster Provider).
 * Aktuell: Gemini, weil es der einzige 1-Stage-Provider ist
 * und die beste Audio-Qualitaet bietet.
 * @returns {BaseProvider}
 */
export function getDefaultProvider() {
    return REGISTRY[0];
}
