// ============================================================
// ASETRONICS MEETING-MINUTEN AI — Haupt-Logik (app.js)
import { db, auth, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, orderBy, signInAnonymously, onAuthStateChanged } from './firebase-config.js';
// ============================================================
// Diese Datei steuert:
//   1. IndexedDB-Datenbank (Berichte speichern, laden, loeschen)
//   2. Einstellungen (API-Key, Vorlage)
//   3. Mikrofon-Aufnahme mit Wake Lock (Bildschirm bleibt an)
//   4. Audio-Datei-Import (Sprachmemos hochladen)
//   5. Gemini-API-Verarbeitung (Audio → Protokoll)
//   6. Anzeige und Interaktion (Berichte anzeigen, kopieren, loeschen)
// ============================================================

// ============================================================
// ABSCHNITT 0: Konstanten und globale Variablen
// ============================================================

// Name der Datenbank (nur fuer Doku, Firebase verwaltet das)
const DB_NAME = 'AsetronicsMeetingDB';
const DB_VERSION = 1;

// Firebase User
let currentUser = null;

// Der MediaRecorder nimmt Audio auf
let mediaRecorder;

// Hier werden die aufgenommenen Audio-Stuecke (Chunks) zwischengespeichert
let audioChunks = [];

// Timer-Intervall fuer die Aufnahme-Anzeige (alle Sekunde aktualisiert)
let recordTimerInterval;

// Startzeit der aktuellen Aufnahme
let startTime;

// Ist gerade eine Aufnahme aktiv?
let isRecording = false;

// Wake Lock Referenz — haelt den Bildschirm an (wird nicht dunkel)
let wakeLock = null;

// Referenz auf den aktiven Audio-Stream (Mikrofon)
let activeStream = null;

// ============================================================
// ABSCHNITT 1: DOM-Elemente (Verweise auf HTML-Elemente)
// ============================================================

// Aufnahme-Bereich
const recordBtn = document.getElementById('record-btn');
const pulseRing = document.getElementById('pulse-ring');
const micIcon = document.getElementById('mic-icon');
const stopIcon = document.getElementById('stop-icon');
const statusText = document.getElementById('record-status');
const timerText = document.getElementById('record-timer');
const loadingContainer = document.getElementById('loading-container');
const loadingText = document.getElementById('loading-text');
const reportsList = document.getElementById('reports-list');
const emptyState = document.getElementById('empty-state');

// Hinweis-Banner (wird waehrend Aufnahme angezeigt)
const recordingHint = document.getElementById('recording-hint');

// Audio-Import-Button
const importBtn = document.getElementById('import-btn');
const audioFileInput = document.getElementById('audio-file-input');

// Einstellungs-Modal
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const apiKeyInput = document.getElementById('api-key-input');
const promptSelect = document.getElementById('prompt-select');

// Detail-Modal (Bericht-Ansicht)
const detailModal = document.getElementById('detail-modal');
const closeDetailBtn = document.getElementById('close-detail-btn');
const detailTitle = document.getElementById('detail-title');
const detailBodyContent = document.getElementById('detail-body-content');
const copyReportBtn = document.getElementById('copy-report-btn');
const deleteReportBtn = document.getElementById('delete-report-btn');

// ID des aktuell geoeffneten Berichts
let currentActiveReportId = null;

// ============================================================
// ABSCHNITT 2: App-Initialisierung
// ============================================================

// Wenn die Seite vollstaendig geladen ist, wird die App initialisiert
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Gespeicherte Einstellungen laden (API-Key, Vorlage)
        loadSettings();

        // 2. Hintergrund-Schutz einrichten (Audio sichern bei Unterbrechung)
        setupBackgroundProtection();

        // 3. Firebase Auth: Anonym einloggen, damit Daten geschuetzt sind
        await signInAnonymously(auth);
        
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                console.log("Firebase Auth erfolgreich. User ID:", user.uid);
                // 4. Vorhandene Berichte aus Firestore laden
                await displayReportsList();
            }
        });

    } catch (err) {
        console.error('Initialisierungsfehler:', err);
    }
});

// ============================================================
// ABSCHNITT 3: DATENBANK-FUNKTIONEN (Firebase Firestore)
// ============================================================

/**
 * Speichert einen Bericht in der Firestore-Datenbank.
 */
async function saveReportToDB(report) {
    if (!currentUser) throw new Error("Nicht eingeloggt");
    try {
        const docRef = doc(db, `users/${currentUser.uid}/reports`, report.id.toString());
        await setDoc(docRef, report);
    } catch (e) {
        console.error("Fehler beim Speichern in Firebase:", e);
        throw e;
    }
}

/**
 * Holt alle Berichte aus der Firestore-Datenbank.
 * Sortiert nach ID absteigend (neueste zuerst).
 */
async function getAllReportsFromDB() {
    if (!currentUser) return [];
    try {
        const reportsRef = collection(db, `users/${currentUser.uid}/reports`);
        const q = query(reportsRef, orderBy("id", "desc"));
        const querySnapshot = await getDocs(q);
        
        const reports = [];
        querySnapshot.forEach((doc) => {
            reports.push(doc.data());
        });
        return reports;
    } catch (e) {
        console.error("Fehler beim Laden aus Firebase:", e);
        return [];
    }
}

/**
 * Loescht einen Bericht anhand seiner ID aus Firestore.
 */
async function deleteReportFromDB(id) {
    if (!currentUser) throw new Error("Nicht eingeloggt");
    try {
        const docRef = doc(db, `users/${currentUser.uid}/reports`, id.toString());
        await deleteDoc(docRef);
    } catch (e) {
        console.error("Fehler beim Loeschen in Firebase:", e);
        throw e;
    }
}

// ============================================================
// ABSCHNITT 4: EINSTELLUNGEN-FUNKTIONEN
// ============================================================

/**
 * Laedt die gespeicherten Einstellungen aus dem localStorage.
 * Wenn noch kein API-Key gespeichert ist, oeffnet sich automatisch
 * das Einstellungs-Modal.
 */
function loadSettings() {
    // localStorage speichert einfache Text-Werte dauerhaft im Browser
    const apiKey = localStorage.getItem('gemini_api_key') || '';
    const template = localStorage.getItem('prompt_template') || 'standard';

    // Werte in die Eingabefelder schreiben
    apiKeyInput.value = apiKey;
    promptSelect.value = template;

    // Falls kein API-Key: Einstellungen automatisch oeffnen
    if (!apiKey) {
        showModal(settingsModal);
    }
}

/**
 * Speichert die Einstellungen und schliesst das Modal.
 */
function saveSettings() {
    const apiKey = apiKeyInput.value.trim();
    const template = promptSelect.value;

    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('prompt_template', template);

    hideModal(settingsModal);

    // Status-Text aktualisieren
    if (apiKey) {
        statusText.textContent = 'Bereit zum Aufnehmen';
    } else {
        statusText.textContent = 'Bitte API-Key in den Einstellungen eintragen';
    }
}

// Modal oeffnen und schliessen
function showModal(modalElement) {
    modalElement.classList.remove('hidden');
}

function hideModal(modalElement) {
    modalElement.classList.add('hidden');
}

// Event-Listeners fuer Modals
settingsBtn.addEventListener('click', () => showModal(settingsModal));
closeSettingsBtn.addEventListener('click', () => hideModal(settingsModal));
saveSettingsBtn.addEventListener('click', saveSettings);
closeDetailBtn.addEventListener('click', () => hideModal(detailModal));

// ============================================================
// ABSCHNITT 5: WAKE LOCK (Bildschirm bleibt an)
// ============================================================
// Die Wake Lock API verhindert, dass der Bildschirm waehrend
// der Aufnahme automatisch dunkel wird und sich sperrt.
// Das ist wichtig, weil iOS das Mikrofon stoppt, wenn der
// Bildschirm gesperrt wird.

/**
 * Aktiviert den Wake Lock (Bildschirm bleibt an).
 * Falls die API nicht unterstuetzt wird, zeigt es eine Warnung.
 */
async function requestWakeLock() {
    // Pruefen ob die Wake Lock API verfuegbar ist
    if ('wakeLock' in navigator) {
        try {
            // Wake Lock anfordern — Typ 'screen' = Bildschirm bleibt an
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock aktiviert — Bildschirm bleibt an');

            // Wenn der Wake Lock aus irgendeinem Grund freigegeben wird
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock wurde freigegeben');
            });
        } catch (err) {
            // Kann passieren wenn z.B. Batterie zu niedrig ist
            console.warn('Wake Lock konnte nicht aktiviert werden:', err);
        }
    } else {
        // Falls die API nicht verfuegbar ist (aeltere Browser)
        console.warn('Wake Lock API nicht unterstuetzt in diesem Browser');
    }
}

/**
 * Gibt den Wake Lock wieder frei (Bildschirm darf sich wieder sperren).
 */
async function releaseWakeLock() {
    if (wakeLock !== null) {
        try {
            await wakeLock.release();
            wakeLock = null;
            console.log('Wake Lock freigegeben');
        } catch (err) {
            console.warn('Fehler beim Freigeben des Wake Lock:', err);
        }
    }
}

// ============================================================
// ABSCHNITT 6: HINTERGRUND-SCHUTZ (Audio nie verlieren)
// ============================================================
// Diese Funktionen sorgen dafuer, dass das aufgenommene Audio
// NICHT verloren geht, selbst wenn:
//   - Der Nutzer zu einer anderen App wechselt
//   - Der Browser geschlossen wird
//   - iOS das Mikrofon stoppt

/**
 * Richtet alle Schutz-Massnahmen ein.
 * Wird einmal beim App-Start aufgerufen.
 */
function setupBackgroundProtection() {

    // 1. visibilitychange: Wird ausgeloest, wenn der Nutzer
    //    zu einer anderen App wechselt oder den Tab verlässt
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && isRecording) {
            // Die App ist im Hintergrund, aber die Aufnahme laeuft noch
            console.log('App im Hintergrund — Aufnahme wird geschuetzt');
            // Hinweis: Wir stoppen die Aufnahme NICHT automatisch.
            // Auf iOS wird das Mikrofon vom System gestoppt.
            // Der onerror-Handler unten faengt das ab.
        }

        // Wenn der Nutzer zurueckkommt, Wake Lock erneuern
        if (document.visibilityState === 'visible' && isRecording) {
            requestWakeLock();
        }
    });

    // 2. beforeunload: Warnung wenn der Nutzer die Seite schliesst
    //    waehrend eine Aufnahme laeuft
    window.addEventListener('beforeunload', (event) => {
        if (isRecording) {
            // Standard-Warnung des Browsers anzeigen
            event.preventDefault();
            // Einige Browser brauchen returnValue (Kompatibilitaet)
            event.returnValue = '';
        }
    });
}

// ============================================================
// ABSCHNITT 7: MIKROFON-AUFNAHME (MediaRecorder)
// ============================================================

// Klick auf den Aufnahme-Button: Start oder Stopp
recordBtn.addEventListener('click', () => {
    // Pruefen ob ein API-Key hinterlegt ist
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert('Bitte tragen Sie zuerst Ihren Gemini API-Key in den Einstellungen ein.');
        showModal(settingsModal);
        return;
    }

    // Aufnahme starten oder stoppen (umschalten)
    if (isRecording) {
        stopAudioRecording();
    } else {
        startAudioRecording();
    }
});

/**
 * Startet die Mikrofon-Aufnahme.
 *
 * Ablauf:
 * 1. Mikrofon-Berechtigung abfragen
 * 2. Wake Lock aktivieren (Bildschirm bleibt an)
 * 3. MediaRecorder starten
 * 4. Timer starten
 * 5. Hinweis-Banner anzeigen
 */
async function startAudioRecording() {
    // Audio-Chunks zuruecksetzen (neuer Start)
    audioChunks = [];
    statusText.textContent = 'Frage Mikrofon-Berechtigung ab...';

    try {
        // 1. Mikrofon-Zugriff anfordern
        // getUserMedia fragt den Nutzer, ob die App das Mikrofon benutzen darf
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        activeStream = stream;

        // 2. Wake Lock aktivieren — Bildschirm bleibt an
        await requestWakeLock();

        // 3. Audioformat erkennen
        // iOS Safari unterstuetzt 'audio/mp4', Chrome unterstuetzt 'audio/webm'
        let options = {};
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
            options.mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            options.mimeType = 'audio/webm';
        }

        // 4. MediaRecorder erstellen
        mediaRecorder = new MediaRecorder(stream, options);

        // 5. Event: Neue Audio-Daten sind verfuegbar
        // Wird alle 250ms ausgeloest (timeslice in start())
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        // 6. Event: Aufnahme wurde gestoppt (normal oder durch Fehler)
        mediaRecorder.onstop = async () => {
            // Pruefen ob Audio-Daten vorhanden sind
            if (audioChunks.length > 0) {
                // Audio zusammenfuegen und an Gemini schicken
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
                await processAudioWithGemini(audioBlob);
            } else {
                statusText.textContent = 'Keine Audiodaten aufgenommen.';
            }

            // Mikrofon-Stream stoppen (Akku sparen)
            cleanupStream();
        };

        // 7. Event: Fehler beim Aufnehmen
        // Das passiert z.B. wenn iOS das Mikrofon im Hintergrund stoppt
        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder Fehler:', event.error);

            // Aufnahme als beendet markieren
            isRecording = false;
            updateRecordingUI(false);

            // Trotzdem das bisher aufgenommene Audio verarbeiten!
            if (audioChunks.length > 0) {
                statusText.textContent = 'Aufnahme wurde unterbrochen — verarbeite vorhandenes Audio...';
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/mp4' });
                processAudioWithGemini(audioBlob);
            } else {
                statusText.textContent = 'Aufnahme wurde unterbrochen. Kein Audio vorhanden.';
            }

            cleanupStream();
        };

        // 8. Aufnahme starten
        // timeslice: 250 = alle 250 Millisekunden werden Daten gesammelt
        // Das bedeutet: Selbst wenn die Aufnahme ploetzlich stoppt,
        // gehen maximal 250ms Audio verloren
        mediaRecorder.start(250);
        isRecording = true;

        // 9. UI aktualisieren
        updateRecordingUI(true);
        statusText.textContent = 'Aufnahme laeuft...';

        // 10. Timer starten (zeigt vergangene Zeit an)
        startTime = Date.now();
        updateTimer();
        recordTimerInterval = setInterval(updateTimer, 1000);

    } catch (err) {
        console.error('Fehler beim Mikrofonzugriff:', err);
        statusText.textContent = 'Fehler: Mikrofon-Zugriff verweigert.';
        alert('Mikrofonzugriff fehlgeschlagen. Bitte erlauben Sie den Zugriff in den iOS-Einstellungen fuer Safari.');
        await releaseWakeLock();
    }
}

/**
 * Stoppt die Mikrofon-Aufnahme.
 */
async function stopAudioRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    // MediaRecorder stoppen — loest das 'onstop'-Event aus
    mediaRecorder.stop();
    isRecording = false;

    // UI zuruecksetzen
    updateRecordingUI(false);
    clearInterval(recordTimerInterval);
    timerText.textContent = '00:00';
    statusText.textContent = 'Aufnahme beendet. Verarbeitung gestartet...';

    // Wake Lock freigeben — Bildschirm darf sich wieder sperren
    await releaseWakeLock();
}

/**
 * Aktualisiert die Benutzeroberflaeche je nach Aufnahme-Status.
 * @param {boolean} recording - true = Aufnahme laeuft, false = gestoppt
 */
function updateRecordingUI(recording) {
    if (recording) {
        // Aufnahme laeuft: roter Puls, Stopp-Icon zeigen
        recordBtn.classList.add('recording');
        micIcon.classList.add('hidden');
        stopIcon.classList.remove('hidden');
        // Hinweis-Banner einblenden
        if (recordingHint) {
            recordingHint.classList.remove('hidden');
        }
    } else {
        // Aufnahme gestoppt: Mikrofon-Icon zeigen
        recordBtn.classList.remove('recording');
        micIcon.classList.remove('hidden');
        stopIcon.classList.add('hidden');
        // Hinweis-Banner ausblenden
        if (recordingHint) {
            recordingHint.classList.add('hidden');
        }
    }
}

/**
 * Stoppt den Mikrofon-Stream und raeumt auf.
 */
function cleanupStream() {
    if (activeStream) {
        // Alle Tracks des Streams stoppen (gibt das Mikrofon frei)
        activeStream.getTracks().forEach(track => track.stop());
        activeStream = null;
    }
}

/**
 * Aktualisiert die Timer-Anzeige (Minuten:Sekunden).
 */
function updateTimer() {
    const elapsedMs = Date.now() - startTime;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    timerText.textContent = `${minutes}:${seconds}`;
}

// ============================================================
// ABSCHNITT 8: AUDIO-DATEI-IMPORT (Sprachmemos hochladen)
// ============================================================
// Damit kann der Nutzer eine bereits aufgenommene Audio-Datei
// (z.B. eine Sprachmemo vom iPhone oder von der Apple Watch)
// direkt hochladen und von Gemini analysieren lassen.

// Klick auf den Import-Button oeffnet den Datei-Waehler
if (importBtn) {
    importBtn.addEventListener('click', () => {
        // Pruefen ob ein API-Key hinterlegt ist
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            alert('Bitte tragen Sie zuerst Ihren Gemini API-Key in den Einstellungen ein.');
            showModal(settingsModal);
            return;
        }
        // Datei-Waehler oeffnen
        audioFileInput.click();
    });
}

// Wenn eine Datei ausgewaehlt wurde
if (audioFileInput) {
    audioFileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Pruefen ob es eine Audio-Datei ist
        if (!file.type.startsWith('audio/')) {
            alert('Bitte waehlen Sie eine Audio-Datei aus (z.B. .m4a, .mp3, .wav).');
            return;
        }

        // Dateigroesse pruefen (Gemini akzeptiert maximal ~20MB inline)
        const maxSizeMB = 20;
        if (file.size > maxSizeMB * 1024 * 1024) {
            alert(`Die Datei ist zu gross (maximal ${maxSizeMB} MB).`);
            return;
        }

        statusText.textContent = `Datei "${file.name}" wird verarbeitet...`;

        // Audio-Datei an Gemini schicken
        await processAudioWithGemini(file);

        // Datei-Input zuruecksetzen (damit man die gleiche Datei nochmal waehlen kann)
        audioFileInput.value = '';
    });
}

// ============================================================
// ABSCHNITT 9: GEMINI API VERARBEITUNG
// ============================================================
// Hier wird das aufgenommene oder importierte Audio an die
// Google Gemini API geschickt. Gemini transkribiert den Ton
// und erstellt daraus ein strukturiertes Protokoll.

/**
 * Sendet eine Audio-Datei (Blob oder File) an die Gemini-API
 * und speichert das Ergebnis als Bericht.
 *
 * @param {Blob|File} audioBlob - Die Audio-Daten (aus Aufnahme oder Import)
 */
async function processAudioWithGemini(audioBlob) {
    // Lade-UI einblenden
    loadingContainer.classList.remove('hidden');
    loadingText.textContent = 'Audio wird fuer die KI vorbereitet...';
    recordBtn.disabled = true;

    try {
        // 1. Audio-Blob in Base64-Text umwandeln
        // Base64 ist ein Textformat, das Binaerdaten (wie Audio) als Text darstellt
        const base64Audio = await blobToBase64(audioBlob);
        const apiKey = localStorage.getItem('gemini_api_key');
        const template = localStorage.getItem('prompt_template') || 'standard';

        loadingText.textContent = 'Gemini transkribiert und analysiert...';

        // 2. Prompt (Anweisung an die KI) basierend auf der gewaehlten Vorlage
        const promptText = getPromptForTemplate(template);

        // 3. MIME-Type bestimmen (welches Audioformat es ist)
        const mimeType = audioBlob.type || 'audio/mp4';

        // 4. API-Anfrage an Google Gemini senden
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    // Audio-Daten als Base64
                                    inlineData: {
                                        mimeType: mimeType,
                                        data: base64Audio
                                    }
                                },
                                {
                                    // Anweisung an die KI
                                    text: promptText
                                }
                            ]
                        }
                    ]
                })
            }
        );

        // 5. Fehlerbehandlung fuer die API-Antwort
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'Gemini API Fehler');
        }

        // 6. Antwort auswerten
        const data = await response.json();
        let markdownText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!markdownText) {
            throw new Error('Kein Text von der Gemini-API zurueckgegeben.');
        }

        // 7. Schweizer Rechtschreibungs-Korrektur (Sicherheitsnetz)
        // Gemini schreibt manchmal "ß" — das wird automatisch zu "ss" korrigiert
        markdownText = korrigiereSchweizerRechtschreibung(markdownText);

        // 8. Titel aus dem Markdown extrahieren (erste Ueberschrift)
        let title = 'Unbenanntes Protokoll';
        const lines = markdownText.split('\n');
        for (const line of lines) {
            if (line.startsWith('#')) {
                title = line.replace(/[#*]/g, '').trim();
                break;
            }
        }

        // 9. Bericht-Objekt erstellen
        const timestamp = Date.now();
        const dateStr = new Date().toLocaleDateString('de-CH', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const newReport = {
            id: timestamp,
            title: title,
            date: dateStr,
            content: markdownText
        };

        // 10. Bericht in der Datenbank speichern
        await saveReportToDB(newReport);

        // 11. Liste aktualisieren und Bericht oeffnen
        await displayReportsList();
        statusText.textContent = 'Protokoll erfolgreich erstellt!';
        openReportDetail(newReport);

    } catch (err) {
        console.error('Verarbeitungsfehler:', err);
        statusText.textContent = 'Verarbeitung fehlgeschlagen.';
        alert(`Fehler bei der AI-Analyse: ${err.message}`);
    } finally {
        // Lade-UI immer ausblenden (auch bei Fehler)
        loadingContainer.classList.add('hidden');
        recordBtn.disabled = false;
    }
}

/**
 * Gibt den passenden Prompt-Text fuer die gewaehlte Vorlage zurueck.
 *
 * @param {string} template - 'standard', 'detailed' oder 'technical'
 * @returns {string} Der Prompt-Text fuer Gemini
 */
function getPromptForTemplate(template) {
    // Gemeinsame Anweisung fuer alle Vorlagen:
    // Schweizer Rechtschreibung verwenden (ss statt ß, echte Umlaute)
    const schweizerHinweis = `
Wichtig: Verwende ausschliesslich Schweizer Rechtschreibung. Das bedeutet: Schreibe immer 'ss' statt 'ß' (kein scharfes S!). Verwende Umlaute (ä, ö, ü) korrekt und keine Ersatzschreibweisen wie 'ae' oder 'ue'.`;

    if (template === 'detailed') {
        return `Du bist ein professioneller Sekretär für ein Technik-Team. Transkribiere diese Tonaufnahme und erstelle ein ausführliches Protokoll auf Deutsch.
Halte dich zwingend an folgende Struktur:
# [Titel des Meetings]
**Datum:** [Heutiges Datum]
**Thema:** [Kurze Zusammenfassung des Hauptthemas]

## Zusammenfassung
[Detaillierte Beschreibung der besprochenen Inhalte]

## Beschlossene Aufgaben (To-Do Liste)
[Liste alle Aufgaben auf. Nenne immer: Wer macht was bis wann]

## Entscheidungen
[Wichtige Entscheidungen, die getroffen wurden]

## Risiken und offene Punkte
[Was muss noch abgeklärt werden? Welche Risiken gibt es?]
${schweizerHinweis}`;
    }

    if (template === 'technical') {
        return `Du bist ein erfahrener Systemtechniker und Protokollführer. Transkribiere die Tonaufnahme und erstelle ein technisches Protokoll.
Halte dich an folgende Struktur:
# Technischer Bericht: [Thema]
**Datum:** [Heutiges Datum]

## Technische Probleme / Diagnose
[Welche Maschinen oder Software haben Probleme? Was wurde beobachtet?]

## Lösungen und Massnahmen
[Wie werden die Probleme behoben?]

## Offene Aufgaben
[Wer muss welches Bauteil bestellen, austauschen oder prüfen? Bis wann?]
${schweizerHinweis}`;
    }

    // Standard-Vorlage
    return `Du bist ein Protokoll-Assistent. Transkribiere diese Tonaufnahme und erstelle eine übersichtliche Zusammenfassung auf Deutsch.
Nutze diese Struktur:
# Protokoll: [Thema]
**Datum:** [Heutiges Datum]

## Wichtigste Punkte
[Zusammenfassung der wichtigsten Gesprächsinhalte]

## Aufgabenliste (To-Dos)
[Wer macht was bis wann]

## Nächste Termine
[Nächste Absprachen oder Deadlines]
${schweizerHinweis}`;
}

// ============================================================
// ABSCHNITT 10: HILFSFUNKTIONEN
// ============================================================

/**
 * Wandelt einen Blob (Binaerdaten) in einen Base64-String um.
 * Base64 ist noetig, weil die Gemini-API Audio als Text erwartet.
 *
 * @param {Blob} blob - Die Binaerdaten (Audio)
 * @returns {Promise<string>} Base64-kodierter String (ohne Header)
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // Ergebnis sieht so aus: "data:audio/mp4;base64,XXXX..."
            // Wir brauchen nur den Teil nach dem Komma (die eigentlichen Daten)
            const base64String = reader.result;
            const base64Data = base64String.substring(base64String.indexOf(',') + 1);
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Korrigiert Schweizer Rechtschreibung: ersetzt alle "ß" durch "ss".
 * Gemini schreibt manchmal trotz Anweisung "ß".
 *
 * @param {string} text - Der zu korrigierende Text
 * @returns {string} Text mit "ss" statt "ß"
 */
function korrigiereSchweizerRechtschreibung(text) {
    return text.replace(/ß/g, 'ss');
}

/**
 * Maskiert HTML-Sonderzeichen, um XSS-Angriffe zu verhindern.
 * XSS = Jemand koennte schaedlichen Code in die App einschleusen.
 *
 * @param {string} str - Der zu maskierende String
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

// ============================================================
// ABSCHNITT 11: ANZEIGE- UND INTERAKTIONS-FUNKTIONEN
// ============================================================

/**
 * Zeigt alle gespeicherten Berichte in der Liste an.
 * Holt die Daten aus IndexedDB und erstellt fuer jeden Bericht
 * ein anklickbares Element.
 */
async function displayReportsList() {
    const reports = await getAllReportsFromDB();

    // Liste leeren (alte Eintraege entfernen)
    reportsList.innerHTML = '';

    // Leeren Zustand anzeigen wenn keine Berichte vorhanden
    if (reports.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    // Fuer jeden Bericht ein Listenelement erstellen
    reports.forEach(report => {
        const item = document.createElement('div');
        item.className = 'report-item';
        item.innerHTML = `
            <div class="report-info">
                <div class="report-title">${escapeHTML(report.title)}</div>
                <div class="report-meta">${report.date}</div>
            </div>
            <!-- Pfeil nach rechts SVG -->
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted)"><polyline points="9 18 15 12 9 6"></polyline></svg>
        `;

        // Klick: Bericht oeffnen
        item.addEventListener('click', () => openReportDetail(report));
        reportsList.appendChild(item);
    });
}

/**
 * Oeffnet die Detailansicht eines Berichts.
 * Rendert den Markdown-Inhalt als HTML.
 */
function openReportDetail(report) {
    currentActiveReportId = report.id;
    detailTitle.textContent = report.title;

    // Markdown in HTML umwandeln und anzeigen
    detailBodyContent.innerHTML = renderMarkdownToHTML(report.content);

    showModal(detailModal);
}

// Bericht in die Zwischenablage kopieren
copyReportBtn.addEventListener('click', async () => {
    if (!currentActiveReportId) return;

    const reports = await getAllReportsFromDB();
    const report = reports.find(r => r.id === currentActiveReportId);

    if (report) {
        try {
            await navigator.clipboard.writeText(report.content);
            alert('Protokoll in die Zwischenablage kopiert!');
        } catch (err) {
            console.error('Kopierfehler:', err);
            alert('Kopieren fehlgeschlagen.');
        }
    }
});

// Bericht loeschen
deleteReportBtn.addEventListener('click', async () => {
    if (!currentActiveReportId) return;

    if (confirm('Moechten Sie dieses Protokoll wirklich loeschen?')) {
        await deleteReportFromDB(currentActiveReportId);
        hideModal(detailModal);
        await displayReportsList();
    }
});

// ============================================================
// ABSCHNITT 12: EINFACHER MARKDOWN-PARSER
// ============================================================
// Wandelt Markdown-Text in HTML um, damit er im Browser
// schoen formatiert angezeigt werden kann.
// Unterstuetzt: Ueberschriften, Listen, Checkboxen, Fettdruck.

/**
 * Wandelt Markdown-Text in HTML um.
 *
 * @param {string} markdown - Der Markdown-Text
 * @returns {string} HTML-String
 */
function renderMarkdownToHTML(markdown) {
    // Zuerst HTML-Tags maskieren (Sicherheit gegen XSS)
    let html = escapeHTML(markdown);

    // Zeile fuer Zeile verarbeiten
    const lines = html.split('\n');

    const renderedLines = lines.map(line => {
        let trimmed = line.trim();

        // Ueberschriften erkennen (### vor ## vor #)
        if (trimmed.startsWith('### ')) {
            return `<h3>${trimmed.substring(4)}</h3>`;
        }
        if (trimmed.startsWith('## ')) {
            return `<h2>${trimmed.substring(3)}</h2>`;
        }
        if (trimmed.startsWith('# ')) {
            return `<h1>${trimmed.substring(2)}</h1>`;
        }

        // Checkboxen erkennen (To-Do-Listen)
        const openCheckboxMatch = trimmed.match(/^[-*]\s+\[\s*\]\s+(.*)/);
        if (openCheckboxMatch) {
            return `<li><input type="checkbox" disabled> ${openCheckboxMatch[1]}</li>`;
        }
        const checkedCheckboxMatch = trimmed.match(/^[-*]\s+\[x\]\s+(.*)/i);
        if (checkedCheckboxMatch) {
            return `<li><input type="checkbox" checked disabled> ${checkedCheckboxMatch[1]}</li>`;
        }

        // Listenpunkte erkennen
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return `<li>${trimmed.substring(2)}</li>`;
        }

        // Leere Zeile = Absatz
        if (trimmed === '') {
            return '<br>';
        }

        // Normaler Text
        return trimmed;
    });

    html = renderedLines.join('\n');

    // Fett-Formatierung: **text** wird zu <strong>text</strong>
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    return html;
}
