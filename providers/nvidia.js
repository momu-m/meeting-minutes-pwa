// ============================================================
// PROVIDER: NVIDIA NIM (build.nvidia.com)
// ============================================================
// NVIDIA bietet OpenAI-kompatible Endpoints fuer Open-Source-Modelle
// wie Llama 3.1, Qwen, Mistral ueber die NIM-Plattform.
//
// Architektur: 2-Stage
//   Audio -> Whisper (OpenAI) -> Text -> NVIDIA-Modell -> Markdown
//
// Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
// Modell: meta/llama-3.1-70b-instruct (empfohlen fuer Protokolle)
// ============================================================

import { BaseProvider } from './base.js';
import { getPromptForTemplate } from '../utils/prompts.js';

export class NvidiaProvider extends BaseProvider {
    constructor() {
        super('nvidia', 'NVIDIA NIM', true);
        this.sttModel = 'whisper-1';
        this.llmModel = 'meta/llama-3.1-70b-instruct';
        this.endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
    }

    getRequiredKeys() {
        return [
            {
                id: 'openai_api_key',
                label: 'OpenAI API-Key (fuer Whisper-STT)',
                placeholder: 'sk-...'
            },
            {
                id: 'nvidia_api_key',
                label: 'NVIDIA NIM API-Key',
                placeholder: 'nvapi-...'
            }
        ];
    }

    async processAudio(audioBlob, template, keys, onProgress) {
        const openaiKey = keys.openai_api_key;
        const nvidiaKey = keys.nvidia_api_key;

        if (!openaiKey || !nvidiaKey) {
            throw new Error('OpenAI- und NVIDIA-Key noetig.');
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

        // ---- STAGE 2: NVIDIA NIM (OpenAI-kompatibel) ----
        onProgress?.('Protokoll wird erstellt (NVIDIA)...');

        const promptText = getPromptForTemplate(template);

        const llmResponse = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${nvidiaKey}`
            },
            body: JSON.stringify({
                model: this.llmModel,
                temperature: 0.3,
                max_tokens: 2000,
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
            throw new Error(`NVIDIA Fehler: ${errData.error?.message || llmResponse.status}`);
        }

        const data = await llmResponse.json();
        const markdownText = data.choices?.[0]?.message?.content || '';

        if (!markdownText) {
            throw new Error('NVIDIA hat keinen Text zurueckgegeben.');
        }

        return markdownText;
    }
}
