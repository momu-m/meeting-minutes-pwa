// ============================================================
// FORMAT UTILS — Datums- und Textformatierung
// ============================================================
// Sammlung kleiner Hilfsfunktionen fuer einheitliche Formatierung.
// ============================================================

/**
 * Aktuelles Datum im Schweizer Format: "19.07.2026, 14:30"
 * @returns {string}
 */
export function formatSwissDateTime() {
    return new Date().toLocaleDateString('de-CH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formatiert eine Zeitdauer in Millisekunden als MM:SS.
 * @param {number} elapsedMs - Vergangene Zeit in Millisekunden
 * @returns {string} "MM:SS"
 */
export function formatDuration(elapsedMs) {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}

/**
 * Wandelt Bytes in eine lesbare Groesse um (z.B. "2.4 MB").
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Korrigiert Schweizer Rechtschreibung: ersetzt sz durch ss.
 * Manche KIs schreiben trotz Anweisung ein scharfes S.
 *
 * @param {string} text - Der zu korrigierende Text
 * @returns {string} Text mit ss statt sz
 */
export function korrigiereSchweizerRechtschreibung(text) {
    return text.replace(/\u00df/g, 'ss');  // \u00df = sz
}
