// ============================================================
// TAGS SERVICE — Kategorien fuer Protokolle (v2.2)
// ============================================================
// Verwaltet eine Liste aller jemals benutzten Tags.
// Wird im localStorage gespeichert (nicht sensitiv).
//
// Schema:
//   localStorage["user_tags"] = ["Meeting", "SMT", "Wartung", ...]
//
// Tags sind Strings mit maximal 30 Zeichen.
// Frei erweiterbar durch den Nutzer.
// ============================================================

const STORAGE_KEY = 'user_tags';
const MAX_TAG_LENGTH = 30;
const MAX_TAGS = 50;  // Schutz vor Endlosliste

/**
 * Laedt die Liste aller Tags aus dem localStorage.
 * @returns {Array<string>}
 */
export function getAllTags() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * Speichert die Tag-Liste.
 * @param {Array<string>} tags
 */
function saveTags(tags) {
    // Deduplizieren + auf MAX_TAGS beschraenken
    const unique = [...new Set(tags)].slice(0, MAX_TAGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
}

/**
 * Fuegt einen neuen Tag hinzu (falls noch nicht vorhanden).
 *
 * @param {string} tag - Der neue Tag
 * @returns {boolean} true wenn hinzugefuegt, false wenn schon vorhanden
 */
export function addTag(tag) {
    const clean = sanitizeTag(tag);
    if (!clean) return false;

    const tags = getAllTags();
    if (tags.includes(clean)) return false;

    tags.push(clean);
    saveTags(tags);
    return true;
}

/**
 * Entfernt einen Tag aus der Liste.
 * @param {string} tag
 */
export function removeTag(tag) {
    const tags = getAllTags().filter(t => t !== tag);
    saveTags(tags);
}

/**
 * Bereinigt einen Tag-String:
 *   - trim (Leerzeichen am Anfang/Ende)
 *   - max. MAX_TAG_LENGTH Zeichen
 *   - keine Steuerzeichen
 *
 * @param {string} tag
 * @returns {string} Bereinigter Tag oder '' wenn ungueltig
 */
function sanitizeTag(tag) {
    if (typeof tag !== 'string') return '';
    // Steuerzeichen entfernen
    const cleaned = tag.replace(/[\x00-\x1F\x7F]/g, '').trim();
    return cleaned.substring(0, MAX_TAG_LENGTH);
}

/**
 * Validiert einen Tag-String (fuer UI-Feedback).
 * @param {string} tag
 * @returns {boolean}
 */
export function isValidTag(tag) {
    return sanitizeTag(tag).length > 0;
}

export const TAG_LIMITS = {
    MAX_TAG_LENGTH,
    MAX_TAGS
};
