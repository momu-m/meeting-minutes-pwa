// ============================================================
// AUDIO-STORE SERVICE — Verschluesselte Audiospeicherung (v2.2)
// ============================================================
// Speichert Audiodateien lokal in IndexedDB - AES-GCM verschluesselt
// mit dem Master-Passwort des Vaults.
//
// Warum Verschluesselung?
//   Audios enthalten oft sensible Meeting-Inhalte (Personalia,
//   Strategie, Kundendaten). IndexedDB ist dauerhaft lokal
//   gespeichert und unverschlusselt fuer jeden mit Browser-Zugriff
//   sichtbar.
//
// Schema:
//   ObjectStore "audios"
//     keyPath: "reportId"
//     value:   { reportId, ivBase64, ciphertextBase64, mimeType, size, createdAt }
//
// WICHTIG: Vor dem ersten Gebrauch muss der Vault entsperrt sein
//          (Master-Passwort-Eingabe). Sonst schlagen Save/Load fehl.
// ============================================================

import { encryptWithVaultKey, decryptWithVaultKey, isUnlocked } from './keyvault.js';

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
 * Hilfsfunktion: Wandelt einen Blob in einen ArrayBuffer um.
 */
function blobToArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
    });
}

/**
 * Speichert ein Audio-Blob verschluesselt lokal ab.
 *
 * @param {number|string} reportId - Die ID des zugehoerigen Protokolls
 * @param {Blob} audioBlob         - Die Audiodaten
 * @returns {Promise<void>}
 * @throws {Error} Wenn der Vault gesperrt ist
 */
export async function saveAudio(reportId, audioBlob) {
    if (!isUnlocked()) {
        throw new Error('Vault gesperrt - Audio kann nicht gespeichert werden.');
    }

    // 1. Blob in ArrayBuffer umwandeln (fuer Verschluesselung noetig)
    const arrayBuffer = await blobToArrayBuffer(audioBlob);

    // 2. Verschluesseln mit dem aktiven Vault-Key
    const { ivBase64, ciphertextBase64 } = await encryptWithVaultKey(arrayBuffer);

    // 3. In IndexedDB speichern (nur verschluesselte Daten!)
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const record = {
            reportId: reportId,
            ivBase64: ivBase64,
            ciphertextBase64: ciphertextBase64,
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
 * Holt das Audio-Blob fuer einen Bericht, entschluesselt es.
 *
 * @param {number|string} reportId
 * @returns {Promise<Blob|null>} Audio-Blob oder null wenn nicht vorhanden
 * @throws {Error} Wenn der Vault gesperrt ist
 */
export async function getAudio(reportId) {
    if (!isUnlocked()) {
        throw new Error('Vault gesperrt - Audio kann nicht geladen werden.');
    }

    // 1. Verschluesselten Record aus IndexedDB laden
    const db = await openDB();
    const record = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(reportId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    });

    if (!record) return null;

    // 2. Daten entschluesseln
    const decrypted = await decryptWithVaultKey(record.ivBase64, record.ciphertextBase64);

    // 3. Zurueck in ein Blob umwandeln
    return new Blob([decrypted], { type: record.mimeType });
}

/**
 * Prueft ob ein Audio fuer den Bericht vorhanden ist,
 * ohne das Blob zu laden (schneller, keine Verschluesselung noetig).
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
