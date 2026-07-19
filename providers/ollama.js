// ============================================================
// PROVIDER: Ollama Cloud
// ============================================================
// Ollama bietet zwei Auth-Methoden:
//   1. OAuth-Token (von signin.ollama.com)
//   2. API-Key (klassisch)
//
// Der Nutzer kann im UI waehlen, welche Methode er nutzt.
//
// Architektur: 2-Stage (Ollama hat keine eigene Audio-API)
//   Audio -> Whisper (OpenAI) -> Text -> Ollama-Modell -> Markdown
//
// Ollama-Cloud-Endpunkt: https://api.ollama.com/v1/chat/completions
// (OpenAI-kompatibles Format)
// ============================================================

import { BaseProvider } from './base.js';
import { getPromptForTemplate } from '../utils/prompts.js';

export class OllamaProvider extends BaseProvider {
    constructor() {
        super('ollama', 'Ollama Cloud', true);
        this.sttModel = 'whisper-1';
        // Ollama-Cloud Standardmodell (kann vom Nutzer spaeter geaendert werden)
        this.llmModel = 'llama3.1:70b';
        this.endpoint = 'https://api.ollama.com/v1/chat/completions';
    }

    getRequiredKeys() {
        return [
            {
                id: 'openai_api_key',
                label: 'OpenAI API-Key (fuer Whisper-STT)',
                placeholder: 'sk-...'
            },
            {
                id: 'ollama_api_key',
                label: 'Ollama API-Key oder OAuth-Token',
                placeholder: 'Token von signin.ollama.com'
            }
        ];
    }

    async processAudio(audioBlob, template, keys, onProgress) {
        const openaiKey = keys.openai_api_key;
        const ollamaKey = keys.ollama_api_key;

        if (!openaiKey || !ollamaKey) {
            throw new Error('OpenAI- und Ollama-Key noetig.');
        }

        // ---- STAGE 1: Whisper ----
        onProgress?.('Audio wird transkribiert (Whisper)...');

        const formData = new FormData();
        const audioFile = new File([audioBlob], 'aufnahme.mp4', { type: audioBlob.type });
        formData.append('file', audioFile);
        formData.append('model', this.sttModel);
        formData.append('language', 'de');
        formData.append('response_format', 'text');

        const sttResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}` },
            body: formData
        });

        if (!sttResponse.ok) {
            const errData = await sttResponse.json().catch(() => ({}));
            throw new Error(`Whisper Fehler: ${errData.error?.message || sttResponse.status}`);
        }

        const transkript = await sttResponse.text();
        if (!transkript || transkript.trim().length === 0) {
            throw new Error('Whisper hat nichts erkannt.');
        }

        // ---- STAGE 2: Ollama Cloud (OpenAI-kompatibel) ----
        onProgress?.('Protokoll wird erstellt (Ollama)...');

        const promptText = getPromptForTemplate(template);

        // Ollama Cloud ist OpenAI-kompatibel -> gleicher Body-Format
        const llmResponse = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ollamaKey}`
            },
            body: JSON.stringify({
                model: this.llmModel,
                temperature: 0.3,
                messages: [
                    {
                        role: 'system',
                        content: 'Du bist ein professioneller Protokoll-Assistent. Schweizer Rechtschreibung (ss statt sz, echte Umlaute).'
                    },
                    {
                        role: 'user',
                        content: `Erstelle ein Protokoll aus diesem Transkript:\n\n${transkript}\n\n${promptText}`
                    }
                ]
            })
        });

        if (!llmResponse.ok) {
            const errData = await llmResponse.json().catch(() => ({}));
            throw new Error(`Ollama Fehler: ${errData.error?.message || llmResponse.status}`);
        }

        const data = await llmResponse.json();
        const markdownText = data.choices?.[0]?.message?.content || '';

        if (!markdownText) {
            throw new Error('Ollama hat keinen Text zurueckgegeben.');
        }

        return markdownText;
    }
}
