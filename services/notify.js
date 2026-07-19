// ============================================================
// NOTIFY SERVICE — Moderne Toast-Benachrichtigungen
// ============================================================
// Ersetzt die alten alert()-Aufrufe durch nicht-blockierende,
// moderne Toast-Notifications am unteren Bildschirmrand.
//
// Verwendung:
//   import { toast } from './services/notify.js';
//   toast.success('Erfolgreich gespeichert!');
//   toast.error('Etwas ist schiefgelaufen.');
//   toast.info('Bitte warten...');
//
// Der Toast verschwindet automatisch nach 3-4 Sekunden.
// ============================================================

// Toast-Container wird beim ersten Aufruf erzeugt
let container = null;

/**
 * Stellt sicher, dass der Container fuer Toasts existiert.
 * Er wird einmalig ins DOM eingefuegt.
 */
function ensureContainer() {
    if (container && document.body.contains(container)) return;

    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
}

/**
 * Zeigt einen Toast an.
 *
 * @param {string} message - Der anzuzeigende Text
 * @param {'success'|'error'|'info'|'warning'} type - Art des Toasts
 * @param {number} duration - Anzeige-Dauer in Millisekunden
 */
function showToast(message, type = 'info', duration = 3500) {
    ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Icon je nach Typ
    const icons = {
        success: '&#10003;',   // Haekchen
        error: '&#10007;',     // X
        info: '&#8505;',       // i
        warning: '&#9888;'     // Warndreieck
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    // Animiertes Einblenden
    requestAnimationFrame(() => {
        toast.classList.add('toast-show');
    });

    // Nach der Dauer automatisch entfernen
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Maskiert HTML-Sonderzeichen (Schutz vor XSS in Toasts).
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// Oeffentliche API mit kurzen Methodennamen
export const toast = {
    success: (msg, dur) => showToast(msg, 'success', dur),
    error: (msg, dur) => showToast(msg, 'error', dur || 5000),  // Fehler laenger
    info: (msg, dur) => showToast(msg, 'info', dur),
    warning: (msg, dur) => showToast(msg, 'warning', dur)
};
