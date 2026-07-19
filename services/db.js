// ============================================================
// DATABASE SERVICE — Firestore-Wrapper
// ============================================================
// Kapselt alle Firebase-Zugriffe fuer Berichte.
// Dadurch muss der Rest der App nicht wissen, wie Firestore funktioniert.
//
// Schema (Firestore):
//   /users/{userId}/reports/{reportId}
//     { id, title, date, content, provider, createdAt }
// ============================================================

import {
    db, auth, collection, getDocs, doc, setDoc, deleteDoc,
    query, orderBy, onAuthStateChanged, signInAnonymously
} from '../firebase-config.js';

/**
 * Loggt den Nutzer anonym bei Firebase ein.
 * Wird beim App-Start aufgerufen.
 * @returns {Promise<Object>} User-Objekt
 */
export async function initAuth() {
    await signInAnonymously(auth);

    return new Promise((resolve) => {
        onAuthStateChanged(auth, (user) => {
            if (user) resolve(user);
        });
    });
}

/**
 * Gibt die aktuelle User-ID zurueck.
 * @returns {string|null}
 */
export function getCurrentUserId() {
    return auth.currentUser?.uid || null;
}

/**
 * Speichert einen Bericht in Firestore.
 * @param {Object} report - { id, title, date, content, provider }
 */
export async function saveReport(report) {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('Nicht bei Firebase eingeloggt.');

    const docRef = doc(db, `users/${userId}/reports`, report.id.toString());
    await setDoc(docRef, report);
}

/**
 * Lädt alle Berichte absteigend nach Erstellungsdatum.
 * @returns {Promise<Array>}
 */
export async function getAllReports() {
    const userId = getCurrentUserId();
    if (!userId) return [];

    try {
        const reportsRef = collection(db, `users/${userId}/reports`);
        const q = query(reportsRef, orderBy('id', 'desc'));
        const snapshot = await getDocs(q);

        const reports = [];
        snapshot.forEach((d) => reports.push(d.data()));
        return reports;
    } catch (err) {
        console.error('Fehler beim Laden der Berichte:', err);
        return [];
    }
}

/**
 * Loescht einen Bericht anhand seiner ID.
 * @param {string|number} id
 */
export async function deleteReport(id) {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('Nicht eingeloggt.');

    const docRef = doc(db, `users/${userId}/reports`, id.toString());
    await deleteDoc(docRef);
}
