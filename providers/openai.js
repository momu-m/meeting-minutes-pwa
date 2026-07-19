// ============================================================
// PROVIDER: OpenAI (Whisper + GPT)
// ============================================================
// OpenAI ist ein 2-Stage-Provider:
//   Audio-Blob -> Whisper API -> Text -> GPT-4o-mini -> Markdown
//
// Vorteile:
//   - Sehr hohe Trefferquote bei Schweizerdeutsch (Whisper large-v3)
//   - GPT-4o-mini ist sehr guenstig und hochwertig
//
// Nachteile:
//   - 2 API-Calls (etwas teurer als Gemini)
//   - Kein direkter Audio-Input ins LLM
//
// Modelle (konfigurierbar ueber diese Konstanten):
//   - STT:  whisper-1 (oder groessere Variante)
//   - LLM:  gpt-4o-mini (billig, schnell) oder gpt-4o (besser)
// ============================================================

import { BaseProvider } from './base.js';
import { getPromptForTemplate } from '../utils/prompts.js';

export class OpenAIProvider extends BaseProvider {
    constructor() {
        super('openai', 'OpenAI (Whisper + GPT)', true);
        this.sttModel = 'whisper-1';
        this.llmModel = 'gpt-4o-mini';
    }

    getRequiredKeys() {
        // OpenAI braucht nur einen Key (gilt fuer Whisper und GPT zusammen)
        return [{
            id: 'openai_api_key',
            label: 'OpenAI API-Key',
            placeholder: 'sk-proj-...'
        }];
    }

    /**
     * 2-Stage Verarbeitung:
     *   1. Audio an Whisper senden -> Transkriptions-Text
     *   2. Transkription an GPT senden -> Markdown-Protokoll
     */
    async processAudio(audioBlob, template, keys, onProgress) {
        const apiKey = keys.openai_api_key;
        if (!apiKey) {
            throw new Error('OpenAI API-Key fehlt.');
        }

        // ---- STAGE 1: Audio -> Text (Whisper) ----
        onProgress?.('Audio wird transkribiert (Whisper)...');

        // Whisper erwartet multipart/form-data (kein JSON, kein Base64)
        const formData = new FormData();
        // Datei aus dem Blob erzeugen (Whisper braucht einen Dateinamen)
        const audioFile = new File([audioBlob], 'aufnahme.mp4', { type: audioBlob.type });
        formData.append('file', audioFile);
        formData.append('model', this.sttModel);
        // Schweizerdeutsch-Erkennung verbessern: Sprache auf Deutsch stellen
        formData.append('language', 'de');
        // Antwortformat: Text (nicht JSON, nicht SRT)
        formData.append('response_format', 'text');

        const sttResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                // Bei FormData KEINEN Content-Type setzen!
                // Der Browser setzt automatisch den korrekten Boundary.
                'Authorization': `Bearer ${apiKey}`
            },
            body: formData
        });

        if (!sttResponse.ok) {
            const errData = await sttResponse.json().catch(() => ({}));
            throw new Error(`Whisper Fehler: ${errData.error?.message || sttResponse.status}`);
        }

        // Rohtext aus der Antwort lesen (response_format="text" gibt reinen Text zurueck)
        const transkript = await sttResponse.text();

        if (!transkript || transkript.trim().length === 0) {
            throw new Error('Whisper hat keinen Text erkannt. War das Audio verstaendlich?');
        }

        // ---- STAGE 2: Text -> Markdown-Protokoll (GPT) ----
        onProgress?.('Protokoll wird erstellt (GPT)...');

        const promptText = getPromptForTemplate(template);

        // System-Prompt: Sagt GPT, welche Rolle es spielt
        const systemPrompt = 'Du bist ein professioneller Protokoll-Assistent fuer Technik-Teams. ' +
                             'Du erstellst aus einem Transkript ein strukturiertes Markdown-Protokoll. ' +
                             'Verwende ausschliesslich Schweizer Rechtschreibung (ss statt sz, echte Umlaute).';

        const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: this.llmModel,
                temperature: 0.3,  // Niedrige Temperatur = sachliche, konsistente Ausgabe
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Aus diesem Transkript erstelle ein Protokoll:\n\n${transkript}\n\n${promptText}` }
                ]
            })
        });

        if (!llmResponse.ok) {
            const errData = await llmResponse.json().catch(() => ({}));
            throw new Error(`GPT Fehler: ${errData.error?.message || llmResponse.status}`);
        }

        const data = await llmResponse.json();
        const markdownText = data.choices?.[0]?.message?.content || '';

        if (!markdownText) {
            throw new Error('GPT hat keinen Text zurueckgegeben.');
        }

        return markdownText;
    }
}
