// ============================================================
// DOCX-EXPORT SERVICE
// ============================================================
// Erstellt aus einem Markdown-Protokoll eine echte .docx-Datei,
// die in Microsoft Word, LibreOffice oder Google Docs geoeffnet
// werden kann.
//
// Nutzt die "docx" Bibliothek (pure JS, kein Server noetig).
// Geladen via jsDelivr CDN als ES-Module.
// ============================================================

// docx-Bibliothek laden (Version 9.x, kompatibel mit ESM-Import)
import {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, convertInchesToTwip
} from 'https://cdn.jsdelivr.net/npm/docx@9.0.0/build/index.js';

/**
 * Wandelt einen Markdown-Text in ein Array von docx-Paragraphen um.
 *
 * Unterstützt:
 *   - Ueberschriften (#, ##, ###)
 *   - Aufzaehlungslisten (- oder *)
 *   - Checkboxen (- [ ] / - [x])
 *   - Fettdruck (**text**)
 *   - Normale Absaetze
 *
 * @param {string} markdown - Der Markdown-Text
 * @returns {Array} Array von docx-Paragraphen
 */
function markdownToParagraphs(markdown) {
    const paragraphs = [];
    const lines = markdown.split('\n');
    let inList = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Leere Zeile: Absatz-Abstand
        if (trimmed === '') {
            if (inList) inList = false;
            paragraphs.push(new Paragraph({ text: '' }));
            continue;
        }

        // Ueberschriften
        if (trimmed.startsWith('### ')) {
            paragraphs.push(new Paragraph({
                heading: HeadingLevel.HEADING_3,
                children: [new TextRun({ text: trimmed.substring(4), bold: true })]
            }));
            continue;
        }
        if (trimmed.startsWith('## ')) {
            paragraphs.push(new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [new TextRun({ text: trimmed.substring(3), bold: true })]
            }));
            continue;
        }
        if (trimmed.startsWith('# ')) {
            paragraphs.push(new Paragraph({
                heading: HeadingLevel.HEADING_1,
                children: [new TextRun({ text: trimmed.substring(2), bold: true, size: 32 })]
            }));
            continue;
        }

        // Checkbox: - [ ] oder - [x]
        const checkboxMatch = trimmed.match(/^[-*]\s+\[([x ]?)\]\s+(.*)/i);
        if (checkboxMatch) {
            const checked = checkboxMatch[1].toLowerCase() === 'x';
            const text = checkboxMatch[2];
            // Fett-Markierungen verarbeiten (**text**)
            const runs = parseBoldText(text);
            paragraphs.push(new Paragraph({
                bullet: { level: 0 },
                children: [
                    new TextRun({ text: checked ? '[x] ' : '[ ] ', bold: true }),
                    ...runs
                ]
            }));
            continue;
        }

        // Aufzaehlungsliste: - oder *
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const text = trimmed.substring(2);
            const runs = parseBoldText(text);
            paragraphs.push(new Paragraph({
                bullet: { level: 0 },
                children: runs
            }));
            continue;
        }

        // Fettdruck am Zeilenanfang: **text**
        if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
            paragraphs.push(new Paragraph({
                children: [new TextRun({ text: trimmed.substring(2, trimmed.length - 2), bold: true })]
            }));
            continue;
        }

        // Normaler Absatz
        const runs = parseBoldText(trimmed);
        paragraphs.push(new Paragraph({ children: runs }));
    }

    return paragraphs;
}

/**
 * Verarbeitet Fett-Markierungen (**text**) in einem Text.
 * Gibt ein Array von TextRun-Objekten zurueck.
 *
 * @param {string} text - Text mit moeglichen **Markierungen**
 * @returns {Array<TextRun>}
 */
function parseBoldText(text) {
    const runs = [];
    // Regex: erfasst **text** und einfache Textteile dazwischen
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Text vor dem Match
        if (match.index > lastIndex) {
            runs.push(new TextRun({ text: text.substring(lastIndex, match.index) }));
        }
        // Der fette Text
        runs.push(new TextRun({ text: match[1], bold: true }));
        lastIndex = regex.lastIndex;
    }

    // Rest nach dem letzten Match
    if (lastIndex < text.length) {
        runs.push(new TextRun({ text: text.substring(lastIndex) }));
    }

    return runs.length > 0 ? runs : [new TextRun({ text: text })];
}

/**
 * Erstellt eine DOCX-Datei aus einem Markdown-Bericht und loest den Download aus.
 *
 * @param {string} markdown   - Der Markdown-Text
 * @param {string} title      - Dateiname (ohne .docx)
 * @returns {Promise<void>}
 */
export async function exportMarkdownToDocx(markdown, title = 'Protokoll') {
    // 1. Markdown zu Paragraphen umwandeln
    const paragraphs = markdownToParagraphs(markdown);

    // 2. Dokument erstellen
    const doc = new Document({
        creator: 'Asetronics Meeting-Minuten AI',
        title: title,
        description: 'Meeting-Protokoll',
        styles: {
            default: {
                document: {
                    run: {
                        font: 'Calibri',
                        size: 22  // 11pt
                    }
                }
            }
        },
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: convertInchesToTwip(1),
                        right: convertInchesToTwip(1),
                        bottom: convertInchesToTwip(1),
                        left: convertInchesToTwip(1)
                    }
                }
            },
            children: paragraphs
        }]
    });

    // 3. DOCX als Blob erzeugen
    const blob = await Packer.toBlob(doc);

    // 4. Download ausloesen
    const safeTitle = title.replace(/[^a-zA-Z0-9äöüÄÖÜ\-_ ]/g, '').trim() || 'Protokoll';
    const filename = `${safeTitle}.docx`;
    triggerDownload(blob, filename);
}

/**
 * Loest einen Dateidownload aus.
 *
 * @param {Blob} blob     - Die Dateidaten
 * @param {string} filename - Der Dateiname
 */
function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // URL nach kurzer Zeit freigeben (Speicher sparen)
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
