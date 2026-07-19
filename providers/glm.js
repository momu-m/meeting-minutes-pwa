// ============================================================
// PROVIDER: GLM (ZhipuAI)
// ============================================================
// GLM = General Language Model von ZhipuAI (China).
// Eigener Endpoint, eigenes API-Key-Format.
//
// Architektur: 2-Stage
//   Audio -> Whisper (OpenAI) -> Text -> GLM -> Markdown
//
// Endpoint: https://open.bigmodel.cn/api/paas/v4/chat/completions
// Modell: glm-4-flash (schnell + kostenloses Kontingent)
// ============================================================

import { BaseProvider } from './base.js';
import { getPromptForTemplate } from '../utils/prompts.js';

export class GLMProvider extends BaseProvider {
    constructor() {
        super('glm', 'GLM / ZhipuAI', true);
        this.sttModel = 'whisper-1';
        this.llmModel = 'glm-4-flash';
        this.endpoint = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    }

    getRequiredKeys() {
        return [
            {
                id: 'openai_api_key',
                label: 'OpenAI API-Key (fuer Whisper-STT)',
                placeholder: 'sk-...'
            },
            {
                id: 'glm_api_key',
                label: 'GLM / ZhipuAI API-Key',
                placeholder: 'xxxxxxxx.xxxxxxxx'
            }
        ];
    }

    async processAudio(audioBlob, template, keys, onProgress) {
        const openaiKey = keys.openai_api_key;
        const glmKey = keys.glm_api_key;

        if (!openaiKey || !glmKey) {
            throw new Error('OpenAI- und GLM-Key noetig.');
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

        // ---- STAGE 2: GLM ----
        onProgress?.('Protokoll wird erstellt (GLM)...');

        const promptText = getPromptForTemplate(template);

        const llmResponse = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${glmKey}`
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
            throw new Error(`GLM Fehler: ${errData.error?.message || llmResponse.status}`);
        }

        const data = await llmResponse.json();
        const markdownText = data.choices?.[0]?.message?.content || '';

        if (!markdownText) {
            throw new Error('GLM hat keinen Text zurueckgegeben.');
        }

        return markdownText;
    }
}
