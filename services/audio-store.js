// ============================================================
// AUDIO-STORE SERVICE — Verschluesselte Audiospeicherung (v2.2)
// ============================================================
// Speichert Audiodateien lokal in IndexedDB - AES-GCM verschluesselt
// mit dem Master-Passwort des Vaults.
//
// PERFORMANCE-HINWEIS (v2.2.1 Fix):
// Native Blobs/ArrayBuffers werden direkt in IndexedDB gespeichert
// (keine Base64-Konvertierung). Grund: Base64-Aufbau bei 20MB Audio
// ist O(n²) und crasht Mobile-Safari wegen RAM-Ueberlauf.
// IndexedDB unterstuetzt structured clone von Blobs nativ.
//
// Schema:
//   ObjectStore "audios"
//     keyPath: "reportId"
//     value:   { reportId, ivBlob, ciphertextBlob, mimeType, size, createdAt }
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

    // 2. Verschluesseln - gibt native Blobs zurueck (kein Base64!)
    const { ivBlob, ciphertextBlob } = await encryptWithVaultKey(arrayBuffer);

    // 3. In IndexedDB speichern - Blobs werden von IDB nativ unterstuetzt
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const record = {
            reportId: reportId,
            ivBlob: ivBlob,
            ciphertextBlob: ciphertextBlob,
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

    // 2. Daten entschluesseln (akzeptiert jetzt Blobs direkt)
    const decrypted = await decryptWithVaultKey(record.ivBlob, record.ciphertextBlob);

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

/**
 * Loescht die komplette Audio-Datenbank (z.B. beim Vault-Reset).
 * @returns {Promise<void>}
 */
export async function clearAllAudios() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => resolve();  // auch wenn blockiert, OK
    });
}
