// ============================================================
// PROVIDER: Google Gemini
// ============================================================
// Gemini ist ein 1-Stage-Provider:
//   Audio-Blob -> Gemini API -> Markdown-Protokoll
//
// Vorteile:
//   - Sehr schnell (nur ein API-Aufruf)
//   - Akzeptiert Audio direkt (Base64)
//   - Grosses kostenloses Kontingent
//
// Modell: gemini-2.5-flash (aktuell schnellstes Modell, Stand 7/2026)
// ============================================================

import { BaseProvider } from './base.js';
import { getPromptForTemplate } from '../utils/prompts.js';

export class GeminiProvider extends BaseProvider {
    constructor() {
        // id="gemini", name="Google Gemini", multiStage=false (1-Stage)
        super('gemini', 'Google Gemini', false);
        // Aktuellstes Modell - direkt hier konfigurierbar
        this.model = 'gemini-2.5-flash';
    }

    /**
     * Gemini braucht nur einen einzigen API-Key.
     */
    getRequiredKeys() {
        return [{
            id: 'gemini_api_key',
            label: 'Gemini API-Key',
            placeholder: 'AIzaSy...'
        }];
    }

    /**
     * Verarbeitet das Audio direkt bei Gemini (1 API-Call).
     *
     * Ablauf:
     *   1. Audio-Blob in Base64 umwandeln
     *   2. Prompt (Anweisung) basierend auf Vorlage laden
     *   3. API-Anfrage an Gemini senden
     *   4. Markdown-Antwort zurueckgeben
     */
    async processAudio(audioBlob, template, keys, onProgress) {
        const apiKey = keys.gemini_api_key;
        if (!apiKey) {
            throw new Error('Gemini API-Key fehlt. Bitte in Einstellungen eintragen.');
        }

        // 1. Audio in Base64 umwandeln
        onProgress?.('Audio wird fuer Gemini vorbereitet...');
        const base64Audio = await this.blobToBase64(audioBlob);

        // 2. Prompt fuer die gewaehlte Vorlage holen
        const promptText = getPromptForTemplate(template);

        // 3. MIME-Type bestimmen (welches Audioformat)
        const mimeType = audioBlob.type || 'audio/mp4';

        // 4. API-Anfrage an Gemini senden
        //    SICHERHEIT: API-Key im Header (x-goog-api-key) statt in der URL.
        //    Fruehere Version hatte ?key= in URL - das landet in Server-Logs.
        onProgress?.('Gemini transkribiert und analysiert...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            // Audio-Daten als Base64
                            { inlineData: { mimeType: mimeType, data: base64Audio } },
                            // Anweisung an die KI
                            { text: promptText }
                        ]
                    }]
                })
            }
        );

        // 5. HTTP-Fehler abfangen
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Gemini API Fehler (HTTP ${response.status})`);
        }

        // 6. Antwort auswerten - Markdown-Text extrahieren
        const data = await response.json();
        const markdownText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!markdownText) {
            throw new Error('Gemini hat keinen Text zurueckgegeben. Moeglicherweise war das Audio zu leise.');
        }

        return markdownText;
    }
}
