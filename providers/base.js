// ============================================================
// PROVIDER BASE — Gemeinsames Interface fuer alle KI-Anbieter
// ============================================================
// Jeder Provider (Gemini, OpenAI, Anthropic, Ollama, ...)
// muss folgende Methoden implementieren:
//
//   getName()              -> String (Anzeige-Name)
//   getId()                -> String (eindeutige ID, z.B. "openai")
//   isMultiStage()         -> Boolean (true = braucht 2 API-Calls)
//   getRequiredKeys()      -> Array<String> (welche API-Keys noetig sind)
//   processAudio(blob, template, keys, onProgress) -> Promise<String>
//                                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                 gibt Markdown-Text zurueck
//
// Durch dieses Interface kann die App den Anbieter wechseln,
// ohne den Rest des Codes zu aendern (Adapter-Pattern).
// ============================================================

/**
 * Abstrakte Basisklasse fuer alle Provider.
 * Enthaelt gemeinsame Hilfsfunktionen (z.B. Audio zu Base64).
 *
 * Konkrete Provider erben von dieser Klasse und ueberschreiben
 * die abstrakten Methoden.
 */
export class BaseProvider {
    /**
     * Konstruktor - speichert ID und Anzeige-Name.
     * @param {string} id   - Eindeutige ID (z.B. "gemini")
     * @param {string} name - Anzeige-Name (z.B. "Google Gemini")
     * @param {boolean} multiStage - true = 2-Stage (STT + LLM)
     */
    constructor(id, name, multiStage = false) {
        this.id = id;
        this.name = name;
        this.multiStage = multiStage;
    }

    // --- Abstrakte Methoden (muessen von Unterklassen implementiert werden) ---

    /**
     * Liste der benoetigten API-Keys.
     * Beispiel: ["openai_api_key"] oder ["stt_key", "llm_key"]
     * @returns {Array<{id: string, label: string, placeholder: string}>}
     */
    getRequiredKeys() {
        // Muss in Unterklasse ueberschrieben werden
        throw new Error('getRequiredKeys() muss implementiert werden');
    }

    /**
     * Verarbeitet ein Audio-Blob und gibt einen Markdown-Bericht zurueck.
     *
     * @param {Blob} audioBlob     - Die Audio-Daten
     * @param {string} template    - Vorlagen-Name ("standard", "detailed", "technical")
     * @param {Object} keys        - Objekt mit API-Keys, z.B. { openai_api_key: "sk-..." }
     * @param {Function} onProgress - Callback fuer Fortschrittsmeldungen
     * @returns {Promise<string>} Markdown-Text
     */
    async processAudio(audioBlob, template, keys, onProgress) {
        // Muss in Unterklasse ueberschrieben werden
        throw new Error('processAudio() muss implementiert werden');
    }

    // --- Gemeinsame Hilfsfunktionen fuer alle Provider ---

    /**
     * Wandelt ein Blob (Binaerdaten) in einen Base64-String um.
     * Base64 ist noetig, weil viele APIs Audio als Text erwarten.
     *
     * @param {Blob} blob - Die Binaerdaten (Audio)
     * @returns {Promise<string>} Base64-String (ohne "data:..." Header)
     */
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // Ergebnis sieht so aus: "data:audio/mp4;base64,XXXX..."
                // Wir brauchen nur den Teil nach dem Komma (die eigentlichen Daten)
                const result = reader.result;
                const base64Data = result.substring(result.indexOf(',') + 1);
                resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Prueft ob alle benoetigten API-Keys vorhanden und nicht-leer sind.
     * @param {Object} keys - Das Keys-Objekt
     * @returns {boolean} true wenn alle Keys vorhanden
     */
    hasAllRequiredKeys(keys) {
        return this.getRequiredKeys().every(k => {
            const val = keys[k.id];
            return val && val.trim().length > 0;
        });
    }
}

// ============================================================
// PROVIDER REGISTRY - Zentrale Liste aller verfuegbaren Provider
// ============================================================
// Hier werden alle Provider registriert. Die App holt sich von hier
// die Liste der verfuegbaren Provider und kann diese durchschalten.
//
// Neue Provider hinzufuegen:
//   1. Datei providers/xxx.js erstellen (erbt von BaseProvider)
//   2. Hier importieren und in REGISTRY aufnehmen
// ============================================================

import { GeminiProvider } from './gemini.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';
import { MiniMaxProvider } from './minimax.js';
import { GLMProvider } from './glm.js';
import { NvidiaProvider } from './nvidia.js';

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
