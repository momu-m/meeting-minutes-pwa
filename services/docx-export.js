// ============================================================
// DOCX-EXPORT SERVICE
// ============================================================
// Erstellt aus einem Markdown-Protokoll eine echte .docx-Datei,
// die in Microsoft Word, LibreOffice oder Google Docs geoeffnet
// werden kann.
//
// SECURITY-HINWEIS (v2.1.1):
// Die docx-Bibliothek wird LAZY geladen (dynamischer Import) - nicht
// beim App-Start. Grund: Bei einem CDN-Ausfall oder einer Kompromittierung
// von jsDelivr wuerde ein statischer Import die ganze App blockieren.
// Mit dynamischem Import betrifft ein Fehler nur den DOCX-Export,
// der Rest der App funktioniert weiter.
// ============================================================

// docx-Bibliothek wird erst beim ersten Export geladen (lazy loading)
let docxModule = null;
const DOCX_CDN_URL = 'https://cdn.jsdelivr.net/npm/docx@9.0.0/build/index.js';

/**
 * Laedt die docx-Bibliothek beim ersten Gebrauch.
 * Wirft einen sauberen Fehler, wenn das CDN nicht erreichbar ist.
 *
 * @returns {Promise<Object>} Das docx-Modul
 */
async function loadDocx() {
    if (docxModule) return docxModule;
    try {
        docxModule = await import(DOCX_CDN_URL);
        return docxModule;
    } catch (err) {
        throw new Error('DOCX-Bibliothek konnte nicht geladen werden. Internetverbindung pruefen.');
    }
}

/**
 * Wandelt einen Markdown-Text in ein Array von docx-Paragraphen um.
 *
 * Unterstuetzt:
 *   - Ueberschriften (#, ##, ###)
 *   - Aufzaehlungslisten (- oder *)
 *   - Checkboxen (- [ ] / - [x])
 *   - Fettdruck (**text**)
 *   - Normale Absaetze
 *
 * @param {string} markdown - Der Markdown-Text
 * @param {Object} docx     - Das geladene docx-Modul
 * @returns {Array} Array von docx-Paragraphen
 */
function markdownToParagraphs(markdown, docx) {
    const { Paragraph, TextRun, HeadingLevel } = docx;
    const paragraphs = [];
    const lines = markdown.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        // Leere Zeile: Absatz-Abstand
        if (trimmed === '') {
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
            const runs = parseBoldText(text, docx);
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
            const runs = parseBoldText(text, docx);
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
        const runs = parseBoldText(trimmed, docx);
        paragraphs.push(new Paragraph({ children: runs }));
    }

    return paragraphs;
}

/**
 * Verarbeitet Fett-Markierungen (**text**) in einem Text.
 * Gibt ein Array von TextRun-Objekten zurueck.
 *
 * @param {string} text - Text mit moeglichen **Markierungen**
 * @param {Object} docx - Das geladene docx-Modul
 * @returns {Array<TextRun>}
 */
function parseBoldText(text, docx) {
    const { TextRun } = docx;
    const runs = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            runs.push(new TextRun({ text: text.substring(lastIndex, match.index) }));
        }
        runs.push(new TextRun({ text: match[1], bold: true }));
        lastIndex = regex.lastIndex;
    }

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
    // 1. docx-Bibliothek lazy laden (nur beim ersten Export)
    const docx = await loadDocx();
    const { Document, Packer, convertInchesToTwip } = docx;

    // 2. Markdown zu Paragraphen umwandeln
    const paragraphs = markdownToParagraphs(markdown, docx);

    // 3. Dokument erstellen
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

    // 4. DOCX als Blob erzeugen
    const blob = await Packer.toBlob(doc);

    // 5. Download ausloesen
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
