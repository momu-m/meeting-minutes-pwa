// ============================================================
// PROVIDER: Anthropic Claude (mit Whisper-STT)
// ============================================================
// Claude hat keine eigene Audio-API, deshalb 2-Stage:
//   Audio -> Whisper (OpenAI) -> Text -> Claude -> Markdown
//
// Vorteil: Claude ist besonders gut darin, sachliche, gut
// strukturierte Protokolle aus unstrukturiertem Text zu machen.
//
// Nachteil: Braucht 2 API-Keys (OpenAI fuer Whisper + Anthropic)
//
// Modell: claude-3-5-haiku-20241022 (schnell + guenstig)
// Alternativ: claude-3-5-sonnet-20241022 (besser, teurer)
// ============================================================

import { BaseProvider } from './base.js';
import { getPromptForTemplate } from '../utils/prompts.js';

export class AnthropicProvider extends BaseProvider {
    constructor() {
        super('anthropic', 'Anthropic Claude', true);
        this.sttModel = 'whisper-1';
        this.llmModel = 'claude-3-5-haiku-20241022';
    }

    /**
     * Braucht 2 Keys: OpenAI fuer Whisper (STT) + Anthropic fuer Claude (LLM).
     */
    getRequiredKeys() {
        return [
            {
                id: 'openai_api_key',
                label: 'OpenAI API-Key (fuer Whisper-STT)',
                placeholder: 'sk-...'
            },
            {
                id: 'anthropic_api_key',
                label: 'Anthropic API-Key (fuer Claude)',
                placeholder: 'sk-ant-...'
            }
        ];
    }

    async processAudio(audioBlob, template, keys, onProgress) {
        const openaiKey = keys.openai_api_key;
        const anthropicKey = keys.anthropic_api_key;

        if (!openaiKey || !anthropicKey) {
            throw new Error('OpenAI- und Anthropic-Key noetig.');
        }

        // ---- STAGE 1: Whisper (gleich wie bei OpenAI-Provider) ----
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

        // ---- STAGE 2: Claude (Anthropic Messages API) ----
        onProgress?.('Protokoll wird erstellt (Claude)...');

        const promptText = getPromptForTemplate(template);

        // Anthropic nutzt x-api-key Header (nicht Bearer!)
        // und erwartet anthropic-version Header.
        const llmResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.llmModel,
                max_tokens: 2000,
                system: 'Du bist ein professioneller Protokoll-Assistent fuer ein Technik-Team. ' +
                        'Schweizer Rechtschreibung (ss statt sz, echte Umlaute).',
                messages: [
                    {
                        role: 'user',
                        content: `Erstelle ein Protokoll aus diesem Transkript:\n\n${transkript}\n\n${promptText}`
                    }
                ]
            })
        });

        if (!llmResponse.ok) {
            const errData = await llmResponse.json().catch(() => ({}));
            throw new Error(`Claude Fehler: ${errData.error?.message || llmResponse.status}`);
        }

        const data = await llmResponse.json();
        // Anthropic gibt ein "content"-Array zurueck, jedes Element hat einen Typ
        const markdownText = data.content?.[0]?.text || '';

        if (!markdownText) {
            throw new Error('Claude hat keinen Text zurueckgegeben.');
        }

        return markdownText;
    }
}
