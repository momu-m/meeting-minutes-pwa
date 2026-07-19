// ============================================================
// MARKDOWN RENDERER — Markdown zu HTML
// ============================================================
// Wandelt Markdown-Text (aus der KI) in schoen formatiertes HTML um.
//
// Unterstuetzt:
//   - Ueberschriften (#, ##, ###)
//   - Listen (- oder *)
//   - Checkboxen ([ ] und [x])
//   - Fett (**text**)
//   - Zitate (> text)
//   - Code (`)
//
// Sicherheit: HTML-Sonderzeichen werden zuerst maskiert (XSS-Schutz).
// ============================================================

/**
 * Maskiert HTML-Sonderzeichen, um XSS-Angriffe zu verhindern.
 * XSS = Cross-Site Scripting (boesartiger Code in der App).
 *
 * @param {string} str
 * @returns {string} Sicherer String
 */
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Wandelt Markdown-Text in HTML um.
 *
 * @param {string} markdown - Der Markdown-Text
 * @returns {string} HTML-String
 */
export function renderMarkdownToHTML(markdown) {
    // 1. HTML maskieren (Sicherheit zuerst)
    let html = escapeHTML(markdown);

    // 2. Zeile fuer Zeile verarbeiten
    const lines = html.split('\n');
    const renderedLines = [];
    let inList = false;  // Merkt sich, ob wir gerade in einer Liste sind

    for (const line of lines) {
        const trimmed = line.trim();

        // --- Zitat (> text) ---
        if (trimmed.startsWith('&gt; ')) {
            if (inList) { renderedLines.push('</ul>'); inList = false; }
            renderedLines.push(`<blockquote>${trimmed.substring(5)}</blockquote>`);
            continue;
        }

        // --- Ueberschriften (### vor ## vor #) ---
        if (trimmed.startsWith('### ')) {
            if (inList) { renderedLines.push('</ul>'); inList = false; }
            renderedLines.push(`<h3>${trimmed.substring(4)}</h3>`);
            continue;
        }
        if (trimmed.startsWith('## ')) {
            if (inList) { renderedLines.push('</ul>'); inList = false; }
            renderedLines.push(`<h2>${trimmed.substring(3)}</h2>`);
            continue;
        }
        if (trimmed.startsWith('# ')) {
            if (inList) { renderedLines.push('</ul>'); inList = false; }
            renderedLines.push(`<h1>${trimmed.substring(2)}</h1>`);
            continue;
        }

        // --- Checkbox offen: - [ ] text ---
        const openCheckbox = trimmed.match(/^[-*]\s+\[\s*\]\s+(.*)/);
        if (openCheckbox) {
            if (!inList) { renderedLines.push('<ul class="todo-list">'); inList = true; }
            renderedLines.push(`<li><input type="checkbox" disabled> ${openCheckbox[1]}</li>`);
            continue;
        }

        // --- Checkbox erledigt: - [x] text ---
        const checkedCheckbox = trimmed.match(/^[-*]\s+\[x\]\s+(.*)/i);
        if (checkedCheckbox) {
            if (!inList) { renderedLines.push('<ul class="todo-list">'); inList = true; }
            renderedLines.push(`<li><input type="checkbox" checked disabled> ${checkedCheckbox[1]}</li>`);
            continue;
        }

        // --- Aufzaehlungsliste (- oder *) ---
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (!inList) { renderedLines.push('<ul>'); inList = true; }
            renderedLines.push(`<li>${trimmed.substring(2)}</li>`);
            continue;
        }

        // --- Leere Zeile = Absatz / Listenschluss ---
        if (trimmed === '') {
            if (inList) { renderedLines.push('</ul>'); inList = false; }
            renderedLines.push('<br>');
            continue;
        }

        // --- Normaler Text ---
        if (inList) { renderedLines.push('</ul>'); inList = false; }
        renderedLines.push(`<p>${trimmed}</p>`);
    }

    // Falls am Ende noch eine Liste offen ist, schliessen
    if (inList) renderedLines.push('</ul>');

    // 3. Zeilen zusammenfuegen
    html = renderedLines.join('\n');

    // 4. Inline-Formatierungen:
    //    Fett: **text** -> <strong>text</strong>
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    //    Kursiv: *text* -> <em>text</em> (aber nicht wenn es Teil von Fett ist)
    html = html.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    //    Inline-Code: `code` -> <code>code</code>
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    return html;
}

/**
 * Extrahiert den Titel (erste Ueberschrift) aus einem Markdown-Text.
 * Fallback: "Unbenanntes Protokoll".
 *
 * @param {string} markdown
 * @returns {string}
 */
export function extractTitle(markdown) {
    const lines = markdown.split('\n');
    for (const line of lines) {
        if (line.startsWith('#')) {
            return line.replace(/[#*]/g, '').trim();
        }
    }
    return 'Unbenanntes Protokoll';
}

// escapeHTML ebenfalls exportieren (wird von anderer Stelle benoetigt)
export { escapeHTML };
