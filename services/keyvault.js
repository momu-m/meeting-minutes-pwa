// ============================================================
// KEYVAULT SERVICE — Sichere Verwaltung aller API-Keys
// ============================================================
// Diese Schicht sits between UI und Crypto:
//   - Master-Passwort pruefen / einrichten
//   - API-Keys verschluesselt speichern
//   - API-Keys entschluesselt zurueckgeben (nur im RAM)
//   - Sicheres Logout (Schluessel aus RAM loeschen)
//
// WICHTIG (Security-Fix v2.0.1):
//   Der AES-Key wird NUR im Arbeitsspeicher (activeKey) gehalten.
//   Er wird NICHT in sessionStorage/localStorage geschrieben.
//   Grund: Ein XSS-Angriff koennte sonst den Key stehlen und die
//   ganze Verschluesselung waere wertlos.
//   Nachteil: Bei jedem App-Start / Tab-Reload Passwort neu eingeben.
//   Das ist ein bewusster Kompromiss: Sicherheit vor Komfort.
//
// Speicherorte:
//   localStorage["keyvault_meta"]  -> { salt, iterations } (keine Geheimnisse)
//   localStorage["keyvault_data"]  -> { provider_id: { key_id: {iv, ciphertext}, ... }, ... }
//   activeKey (im RAM)             -> CryptoKey (nur waehrend Session aktiv)
// ============================================================

import {
    deriveKeyFromPassword,
    encryptString,
    decryptString,
    generateSalt,
    saltFromBase64
} from './crypto.js';

const META_KEY = 'keyvault_meta';   // Salt + Status (keine Geheimnisse)
const DATA_KEY = 'keyvault_data';   // Verschluesselte Keys

// Aktueller AES-Key im Arbeitsspeicher (null = ausgeloggt)
// WICHTIG: Nie persistieren! Nur fuer Dauer der Session im RAM.
let activeKey = null;

// ============================================================
// HILFSFUNKTIONEN fuer localStorage-Zugriff
// ============================================================

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Exportiert den CryptoKey in Base64 - WIRD NICHT MEHR VERWENDET (Security-Fix).
 * Fruehere Version hat den Key in sessionStorage gespeichert. Das war ein
// Sicherheitsrisiko bei XSS. Jetzt nur noch RAM.
 */
// (Funktion komplett entfernt)

// ============================================================
// OEFFENTLICHE API
// ============================================================

/**
 * Prueft ob schon ein Master-Passwort eingerichtet wurde.
 * @returns {boolean}
 */
export function hasMasterPassword() {
    const meta = readJSON(META_KEY, null);
    return !!(meta && meta.salt);
}

/**
 * Prueft ob der KeyVault aktuell entsperrt ist (Key im RAM).
 * @returns {boolean}
 */
export function isUnlocked() {
    return activeKey !== null;
}

/**
 * Richtet ein neues Master-Passwort ein.
 * Wird beim allerersten Start der App aufgerufen.
 *
 * @param {string} password - Das neue Master-Passwort
 */
export async function setupMasterPassword(password) {
    // Mindestlaenge 12 Zeichen (empfohlen fuer Sicherheits-Schicht)
    if (password.length < 12) {
        throw new Error('Passwort muss mindestens 12 Zeichen lang sein (Sicherheit).');
    }

    // 1. Frischen Salt erzeugen
    const salt = generateSalt();

    // 2. AES-Key ableiten (im RAM, nie persistieren!)
    activeKey = await deriveKeyFromPassword(password, saltFromBase64(salt));

    // 3. Meta-Daten speichern (Salt ist kein Geheimnis)
    writeJSON(META_KEY, {
        salt,
        iterations: 600000,
        created: Date.now()
    });

    // 4. Leeren Vault anlegen
    writeJSON(DATA_KEY, {});
}

/**
 * Entsperrt den Vault mit einem Master-Passwort.
 *
 * @param {string} password - Das Master-Passwort
 * @returns {Promise<boolean>} true wenn erfolgreich, false bei falschem Passwort
 */
export async function unlock(password) {
    const meta = readJSON(META_KEY, null);
    if (!meta || !meta.salt) {
        throw new Error('Kein Master-Passwort eingerichtet. Bitte zuerst einrichten.');
    }

    try {
        // 1. Key aus Passwort ableiten (nur im RAM!)
        activeKey = await deriveKeyFromPassword(password, saltFromBase64(meta.salt));

        // 2. Sofort testen: versuchen wir eine Entschluesselung.
        //    Wenn der Vault noch leer ist, koennen wir nicht testen -
        //    dann akzeptieren wir das Passwort vorerst.
        const vault = readJSON(DATA_KEY, {});
        const allProviders = Object.keys(vault);

        if (allProviders.length > 0) {
            // Vault hat Daten: versuche eine beliebige Entschluesselung
            const firstProvider = allProviders[0];
            const firstKey = Object.keys(vault[firstProvider])[0];
            const entry = vault[firstProvider][firstKey];
            await decryptString(entry.ciphertext, entry.iv, activeKey);
        }

        return true;
    } catch (err) {
        // Entschluesselung schiefgelaufen = falsches Passwort
        activeKey = null;
        return false;
    }
}

/**
 * Sperrt den Vault (Logout).
 * Der AES-Schluessel wird aus dem RAM entfernt.
 */
export function lock() {
    activeKey = null;
}

/**
 * Versucht, den Vault automatisch zu entsperren.
 * Wird beim App-Start aufgerufen.
 *
 * SICHERHEITSHINWEIS: Gibt immer false zurueck, weil wir den
 * AES-Key aus Sicherheitsgruenden nicht persistent speichern.
 * Der Nutzer muss bei jedem App-Start das Passwort neu eingeben.
 *
 * @returns {Promise<boolean>} immer false
 */
export async function tryRestoreSession() {
    return false;
}

/**
 * Speichert einen einzelnen API-Key verschluesselt ab.
 *
 * @param {string} providerId - z.B. "openai"
 * @param {string} keyId      - z.B. "openai_api_key"
 * @param {string} value      - Der API-Key im Klartext
 */
export async function storeApiKey(providerId, keyId, value) {
    if (!activeKey) throw new Error('Vault ist gesperrt. Bitte erst entsperren.');

    const vault = readJSON(DATA_KEY, {});
    if (!vault[providerId]) vault[providerId] = {};

    const encrypted = await encryptString(value, activeKey);
    vault[providerId][keyId] = encrypted;
    writeJSON(DATA_KEY, vault);
}

/**
 * Holt einen einzelnen API-Key entschluesselt zurueck.
 *
 * @param {string} providerId
 * @param {string} keyId
 * @returns {Promise<string|null>} Key im Klartext oder null wenn nicht vorhanden
 */
export async function getApiKey(providerId, keyId) {
    if (!activeKey) return null;

    const vault = readJSON(DATA_KEY, {});
    const entry = vault[providerId]?.[keyId];
    if (!entry) return null;

    return decryptString(entry.ciphertext, entry.iv, activeKey);
}

/**
 * Holt alle API-Keys fuer einen bestimmten Provider.
 *
 * @param {string} providerId
 * @returns {Promise<Object>} { openai_api_key: "sk-...", ... }
 */
export async function getProviderKeys(providerId) {
    if (!activeKey) return {};

    const vault = readJSON(DATA_KEY, {});
    const providerVault = vault[providerId] || {};

    const result = {};
    for (const keyId of Object.keys(providerVault)) {
        try {
            result[keyId] = await decryptString(
                providerVault[keyId].ciphertext,
                providerVault[keyId].iv,
                activeKey
            );
        } catch (err) {
            console.error(`Fehler beim Entschlüsseln von ${providerId}.${keyId}:`, err);
        }
    }
    return result;
}

/**
 * Loescht einen einzelnen API-Key.
 */
export function deleteApiKey(providerId, keyId) {
    const vault = readJSON(DATA_KEY, {});
    if (vault[providerId]) {
        delete vault[providerId][keyId];
        writeJSON(DATA_KEY, vault);
    }
}

/**
 * Setzt den kompletten Vault zurueck (Passwort vergessen Funktion).
 * ACHTUNG: Alle gespeicherten API-Keys gehen verloren!
 */
export function resetVault() {
    localStorage.removeItem(META_KEY);
    localStorage.removeItem(DATA_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    activeKey = null;
}
