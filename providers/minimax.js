// ============================================================
// PROVIDER: MiniMax
// ============================================================
// Chinesischer KI-Anbieter mit eigener Audio- und LLM-API.
// MiniMax hat ein eigenes STT-Modell, wir nutzen aber der
// Einfachheit halber Whisper + MiniMax-LLM.
//
// Architektur: 2-Stage
//   Audio -> Whisper (OpenAI) -> Text -> MiniMax -> Markdown
//
// Endpoint: https://api.minimaxi.com/v1/text/chatcompletion_v2
// (OpenAI-kompatibel)
// ============================================================

import { BaseProvider } from './base.js';
import { getPromptForTemplate } from '../utils/prompts.js';

export class MiniMaxProvider extends BaseProvider {
    constructor() {
        super('minimax', 'MiniMax', true);
        this.sttModel = 'whisper-1';
        this.llmModel = 'MiniMax-Text-01';
        this.endpoint = 'https://api.minimaxi.com/v1/text/chatcompletion_v2';
    }

    getRequiredKeys() {
        return [
            {
                id: 'openai_api_key',
                label: 'OpenAI API-Key (fuer Whisper-STT)',
                placeholder: 'sk-...'
            },
            {
                id: 'minimax_api_key',
                label: 'MiniMax API-Key',
                placeholder: 'Bearer-Token von MiniMax'
            }
        ];
    }

    async processAudio(audioBlob, template, keys, onProgress) {
        const openaiKey = keys.openai_api_key;
        const minimaxKey = keys.minimax_api_key;

        if (!openaiKey || !minimaxKey) {
            throw new Error('OpenAI- und MiniMax-Key noetig.');
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

        // ---- STAGE 2: MiniMax ----
        onProgress?.('Protokoll wird erstellt (MiniMax)...');

        const promptText = getPromptForTemplate(template);

        const llmResponse = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${minimaxKey}`
            },
            body: JSON.stringify({
                model: this.llmModel,
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
            throw new Error(`MiniMax Fehler: ${errData.base_resp?.status_msg || errData.error?.message || llmResponse.status}`);
        }

        const data = await llmResponse.json();
        const markdownText = data.choices?.[0]?.message?.content || '';

        if (!markdownText) {
            throw new Error('MiniMax hat keinen Text zurueckgegeben.');
        }

        return markdownText;
    }
}
