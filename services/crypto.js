// ============================================================
// CRYPTO SERVICE — Verschluesselung fuer API-Keys
// ============================================================
// Nutzt die Web Crypto API (in allen modernen Browsern verfuegbar).
//
// Verfahren:
//   1. Master-Passwort -> PBKDF2 (250k Durchlaeufe) -> AES-Key
//   2. AES-GCM (moderne authentifizierte Verschluesselung)
//   3. Pro Wert: Zufaelliger IV (96 Bit) + Salt (128 Bit)
//
// Vorteile:
//   - Brute-Force sehr aufwendig (250k Iterationen)
//   - AES-GCM erkennt Manipulation (Integritaetsschutz)
//   - Komplett im Browser, kein Server noetig
//
// Speicherung in localStorage (verschluesselt!):
//   keyvault = { iv, salt, ciphertext } (jeweils Base64)
// ============================================================

// Konfiguration
// OWASP 2023 empfiehlt mind. 600k Iterationen fuer PBKDF2-SHA256.
// Hoher Wert = sicherer gegen Brute-Force, aber langsammer beim Entsperren.
const PBKDF2_ITERATIONS = 600000;  // Wie oft das Passwort gehasht wird
const SALT_LENGTH = 16;            // 128 Bit Salt (Zufall pro Passwort)
const IV_LENGTH = 12;              // 96 Bit IV (Zufall pro Verschluesselung)

/**
 * Hilfsfunktion: Wandelt einen String in einen Array-Puffer um (UTF-8).
 * Wird benoetigt, weil die Web Crypto API mit Arraybuffern arbeitet.
 *
 * @param {string} str - Der Text
 * @returns {Uint8Array}
 */
function strToArrayBuffer(str) {
    return new TextEncoder().encode(str);
}

/**
 * Hilfsfunktion: Wandelt einen Arraybuffer in einen Base64-String um.
 * Base64 ist die kompakte Text-Darstellung von Binaerdaten.
 *
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string} Base64-String
 */
function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Hilfsfunktion: Wandelt Base64 zurueck in einen Arraybuffer.
 *
 * @param {string} base64
 * @returns {ArrayBuffer}
 */
function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Erzeugt einen kryptografisch sicheren Zufallswert der angegebenen Laenge.
 * Nutzt crypto.getRandomValues (sicherer als Math.random()).
 *
 * @param {number} length - Anzahl Bytes
 * @returns {Uint8Array}
 */
function randomBytes(length) {
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return arr;
}

/**
 * Leitet aus einem Passwort einen AES-Schluessel ab.
 *
 * PBKDF2 = Password-Based Key Derivation Function 2
 * Es fuehrt das Hash-Verfahren viele Male aus, damit ein Angreifer
 * das Passwort nicht schnell erraten kann (Brute-Force).
 *
 * @param {string} password - Das Master-Passwort
 * @param {Uint8Array} salt - Ein eindeutiger Zufallswert
 * @returns {Promise<CryptoKey>} Der abgeleitete AES-Schluessel
 */
export async function deriveKeyFromPassword(password, salt) {
    // 1. Passwort als Arraybuffer
    const passwordBuffer = strToArrayBuffer(password);

    // 2. Rohe Schluessel-Material aus dem Passwort erzeugen
    const baseKey = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    // 3. Den endgueltigen AES-GCM Schluessel ableiten
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },  // AES mit 256-Bit-Schluessel
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Verschluesselt einen Text mit einem gegebenen AES-Schluessel.
 *
 * @param {string} plaintext - Der Klartext (z.B. ein API-Key)
 * @param {CryptoKey} key - Der AES-Schluessel
 * @returns {Promise<{iv: string, ciphertext: string}>} Base64-Werte
 */
export async function encryptString(plaintext, key) {
    // 1. Frischer IV (Zufall) fuer jede Verschluesselung
    // IV = Initialization Vector, verhindert dass gleiche Eingaben
    //      gleiche Verschluesselung ergeben
    const iv = randomBytes(IV_LENGTH);

    // 2. Verschluesseln
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        strToArrayBuffer(plaintext)
    );

    // 3. Rueckgabe als Base64 (fuer Speicherung)
    return {
        iv: bufferToBase64(iv),
        ciphertext: bufferToBase64(encrypted)
    };
}

/**
 * Entschluesselt einen zuvor verschluesselten Wert.
 *
 * @param {string} ciphertextB64 - Base64 verschluesselter Text
 * @param {string} ivB64 - Base64 IV
 * @param {CryptoKey} key - Der AES-Schluessel
 * @returns {Promise<string>} Der Klartext
 * @throws {Error} Wenn der Schluessel falsch oder Daten manipuliert wurden
 */
export async function decryptString(ciphertextB64, ivB64, key) {
    const iv = base64ToBuffer(ivB64);
    const ciphertext = base64ToBuffer(ciphertextB64);

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        ciphertext
    );

    return new TextDecoder().decode(decrypted);
}

/**
 * Generiert einen neuen Zufallssalt.
 * Wird einmalig beim Einrichten des Master-Passworts erzeugt.
 * @returns {string} Salt als Base64
 */
export function generateSalt() {
    return bufferToBase64(randomBytes(SALT_LENGTH));
}

/**
 * Wandelt Base64-Salt zurueck in einen Arraybuffer (fuer PBKDF2).
 * @param {string} saltB64
 * @returns {ArrayBuffer}
 */
export function saltFromBase64(saltB64) {
    return base64ToBuffer(saltB64);
}

export const CRYPTO_CONFIG = {
    PBKDF2_ITERATIONS,
    SALT_LENGTH,
    IV_LENGTH
};
