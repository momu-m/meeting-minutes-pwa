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
// WICHTIG: Die REGISTRY und die Provider-Imports liegen in der
// separaten Datei providers/index.js. Das verhindert einen
// Circular Dependency (Zirkelbezug):
//
//   base.js  ->  importiert gemini.js  ->  importiert base.js
//
// Saubere Struktur:
//   base.js    = nur BaseProvider + getProviderMeta (keine konkreten Provider)
//   index.js   = importiert alle Provider + enthaelt REGISTRY
//   app.js     = importiert von index.js (nicht von base.js!)
//
// Neue Provider hinzufuegen:
//   1. Datei providers/xxx.js erstellen (erbt von BaseProvider aus base.js)
//   2. In providers/index.js importieren und in REGISTRY aufnehmen
// ============================================================

// ============================================================
// PROVIDER META - UI-relevante Metadaten (Icon, Farbe, Kurztext)
// ============================================================
// Diese Map wird NUR fuer die Darstellung im UI verwendet.
// Sie hat keinen Einfluss auf die Provider-Logik selbst.
//
//   color  : Akzentfarbe fuer Badges/Icons (hex)
//   icon   : SVG-Pfad (24x24 viewBox, stroke=currentColor)
//   tagline: Ein-Wort-Kurzinfo fuer den Switcher
// ============================================================

const PROVIDER_META = {
    openai: {
        color: '#10A37F',
        tagline: '1 Key (sk-...): Whisper + GPT',
        icon: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'
    },
    gemini: {
        color: '#4285F4',
        tagline: '1 Key (AIzaSy...): Audio direkt',
        icon: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'
    }
};

/**
 * Liefert die UI-Metadaten fuer einen Provider.
 * Falls keine Metadaten definiert sind, wird ein neutraler Fallback geliefert.
 *
 * @param {string} providerId - Die Provider-ID (z.B. "gemini")
 * @returns {{color: string, tagline: string, icon: string}}
 */
export function getProviderMeta(providerId) {
    return PROVIDER_META[providerId] || {
        color: '#94a3b8',
        tagline: 'KI-Anbieter',
        icon: '<circle cx="12" cy="12" r="9"/>'
    };
}
