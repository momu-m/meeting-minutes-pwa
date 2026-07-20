// ============================================================
// AUDIO-STORE SERVICE — Speichert Audiodateien lokal (IndexedDB)
// ============================================================
// Warum nicht Firestore?
//   Firestore-Dokumente sind auf 1 MB beschraenkt.
//   Audiodateien sind aber oft 5-20 MB.
//
// Warum nicht localStorage?
//   localStorage ist auf 5-10 MB total begrenzt und kann
//   keine Binaerdaten speichern (nur Strings).
//
// Loesung: IndexedDB - kann Gigabytes an Binaerdaten speichern.
//
// Schema:
//   ObjectStore "audios"
//     keyPath: "reportId" (gleich wie Bericht-ID)
//     value:   { reportId, blob, mimeType, size, createdAt }
// ============================================================

const DB_NAME = 'AsetronicsMeetingAudios';
const DB_VERSION = 1;
const STORE_NAME = 'audios';

/**
 * Oeffnet (oder erstellt) die IndexedDB-Datenbank.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // Wird beim ersten Oeffnen ausgeloest: erstellt den ObjectStore
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'reportId' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Speichert ein Audio-Blob lokal ab, verknuepft mit einer Report-ID.
 *
 * @param {number|string} reportId - Die ID des zugehoerigen Protokolls
 * @param {Blob} audioBlob         - Die Audiodaten
 * @returns {Promise<void>}
 */
export async function saveAudio(reportId, audioBlob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const record = {
            reportId: reportId,
            blob: audioBlob,
            mimeType: audioBlob.type || 'audio/mp4',
            size: audioBlob.size,
            createdAt: Date.now()
        };

        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    });
}

/**
 * Holt das Audio-Blob fuer einen bestimmten Bericht.
 *
 * @param {number|string} reportId
 * @returns {Promise<Blob|null>} Audio-Blob oder null wenn nicht vorhanden
 */
export async function getAudio(reportId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(reportId);

        request.onsuccess = () => {
            const result = request.result;
            resolve(result ? result.blob : null);
        };
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    });
}

/**
 * Prueft ob ein Audio fuer den Bericht vorhanden ist,
 * ohne das Blob zu laden (schneller).
 *
 * @param {number|string} reportId
 * @returns {Promise<boolean>}
 */
export async function hasAudio(reportId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.count(reportId);

        request.onsuccess = () => resolve(request.result > 0);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    });
}

/**
 * Loescht das Audio zu einem Bericht.
 * @param {number|string} reportId
 */
export async function deleteAudio(reportId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(reportId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    });
}
