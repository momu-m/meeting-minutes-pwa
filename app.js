// ============================================================
// ASETRONICS MEETING-MINUTEN AI — Haupt-Logik (app.js) v2.0
// ============================================================
// Diese Datei ist das "Hirn" der App. Sie koordiniert:
//
//   1. Initialisierung (Auth, Settings, Migration alter Daten)
//   2. UI-Ereignisse (Aufnahme, Import, Buttons)
//   3. Provider-System (welcher KI-Anbieter ist aktiv?)
//   4. Sicherheit (Vault mit Master-Passwort)
//
// Die eigentliche Arbeit machen die Module in /services und /providers.
// Diese Datei hier ist nur noch fuer die UI-Zusammenhaltung zustaendig.
// ============================================================

// --- Externe Module ---
import { db, auth, collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, signInAnonymously, onAuthStateChanged } from './firebase-config.js';

// --- Eigene Services ---
import { getAllProviders, getProviderById, getDefaultProvider, getProviderMeta } from './providers/base.js';
import { saveReport, getAllReports, deleteReport, initAuth, getCurrentUserId, updateReport } from './services/db.js';
import { toast } from './services/notify.js';
import { renderMarkdownToHTML, extractTitle, escapeHTML } from './utils/markdown.js';
import { formatSwissDateTime, formatDuration, korrigiereSchweizerRechtschreibung } from './utils/format.js';
import { exportMarkdownToDocx } from './services/docx-export.js';
import { saveAudio, getAudio, hasAudio, deleteAudio, clearAllAudios } from './services/audio-store.js';
import { getAllTags, addTag, isValidTag, TAG_LIMITS } from './services/tags.js';
import {
    hasMasterPassword, isUnlocked, setupMasterPassword,
    unlock, lock, tryRestoreSession,
    storeApiKey, getApiKey, getProviderKeys, resetVault
} from './services/keyvault.js';

// ============================================================
// ABSCHNITT 0: GLOBALE ZUSTAENDE
// ============================================================

let mediaRecorder = null;       // Nimmt Audio auf
let audioChunks = [];           // Audio-Stuecke zwischenspeichern
let recordTimerInterval = null; // Timer-Intervall
let startTime = null;           // Startzeit der Aufnahme
let isRecording = false;        // Aufnahme aktiv?
let wakeLock = null;            // Bildschirm bleibt an
let activeStream = null;        // Mikrofon-Stream
let currentUser = null;         // Firebase-User
let currentActiveReportId = null;  // Aktuell offener Bericht
let currentProvider = getDefaultProvider();  // Aktiver KI-Anbieter

// === localStorage-Schluessel fuer Settings (nicht verschluesselt) ===
const LS_SELECTED_PROVIDER = 'selected_provider';   // Welcher Provider ist aktiv
const LS_PROMPT_TEMPLATE = 'prompt_template';        // Welche Vorlage

// ============================================================
// ABSCHNITT 1: DOM-ELEMENTE (Verweise auf HTML)
// ============================================================

const recordBtn = document.getElementById('record-btn');
const micIcon = document.getElementById('mic-icon');
const stopIcon = document.getElementById('stop-icon');
const statusText = document.getElementById('record-status');
const timerText = document.getElementById('record-timer');
const loadingContainer = document.getElementById('loading-container');
const loadingText = document.getElementById('loading-text');
const reportsList = document.getElementById('reports-list');
const emptyState = document.getElementById('empty-state');
const recordingHint = document.getElementById('recording-hint');
const importBtn = document.getElementById('import-btn');
const audioFileInput = document.getElementById('audio-file-input');

// Einstellungen
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const providerSelect = document.getElementById('provider-select');
const providerHelp = document.getElementById('provider-help');
const apiKeysContainer = document.getElementById('api-keys-container');
const promptSelect = document.getElementById('prompt-select');
const passwordStatus = document.getElementById('password-status');
const lockVaultBtn = document.getElementById('lock-vault-btn');
const resetVaultBtn = document.getElementById('reset-vault-btn');
const activeProviderBadge = document.getElementById('active-provider-badge');

// Provider-Switcher (Startseite)
const providerSwitcher = document.getElementById('provider-switcher');
const switcherProviderIcon = document.getElementById('switcher-provider-icon');
const switcherProviderName = document.getElementById('switcher-provider-name');
const switcherProviderStatus = document.getElementById('switcher-provider-status');
const providerSheet = document.getElementById('provider-sheet');
const providerSheetBody = document.getElementById('provider-sheet-body');
const closeProviderSheetBtn = document.getElementById('close-provider-sheet-btn');

// Vault-Status-Indikator im Header
const vaultStatusIndicator = document.getElementById('vault-status-indicator');

// Schallwellen-Animation
const waveBars = document.getElementById('wave-bars');

// Unlock-Modal
const unlockModal = document.getElementById('unlock-modal');
const unlockTitle = document.getElementById('unlock-title');
const unlockHint = document.getElementById('unlock-hint');
const masterPasswordInput = document.getElementById('master-password-input');
const unlockBtn = document.getElementById('unlock-btn');

// Detail-Modal
const detailModal = document.getElementById('detail-modal');
const closeDetailBtn = document.getElementById('close-detail-btn');
const detailTitle = document.getElementById('detail-title');
const detailBodyContent = document.getElementById('detail-body-content');
const copyReportBtn = document.getElementById('copy-report-btn');
const shareReportBtn = document.getElementById('share-report-btn');
const pdfReportBtn = document.getElementById('pdf-report-btn');
const docxReportBtn = document.getElementById('docx-report-btn');
const editReportBtn = document.getElementById('edit-report-btn');
const deleteReportBtn = document.getElementById('delete-report-btn');

// Edit-Modal
const editModal = document.getElementById('edit-modal');
const editTitleInput = document.getElementById('edit-title-input');
const editContentInput = document.getElementById('edit-content-input');
const saveEditBtn = document.getElementById('save-edit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Audio-Player
const audioPlayerContainer = document.getElementById('audio-player-container');
const audioPlayer = document.getElementById('audio-player');
const downloadAudioBtn = document.getElementById('download-audio-btn');

// Suche
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const reportCountBadge = document.getElementById('report-count');

// Tags
const addTagBtn = document.getElementById('add-tag-btn');
const tagInputArea = document.getElementById('tag-input-area');
const tagInput = document.getElementById('tag-input');
const tagSuggestions = document.getElementById('tag-suggestions');
const reportTagsDisplay = document.getElementById('report-tags-display');

// Sortierung
const sortBar = document.getElementById('sort-bar');
const sortSelect = document.getElementById('sort-select');
const LS_SORT_KEY = 'sort_preference';

/**
 * Holt die gespeicherte Sortier-Einstellung.
 * @returns {string} Sort-Key, z.B. "date-desc"
 */
function getSortPreference() {
    return localStorage.getItem(LS_SORT_KEY) || 'date-desc';
}

/**
 * Sortiert eine Kopie der Berichte nach der gewaehlten Methode.
 *
 * @param {Array} reports  - Die zu sortierenden Berichte
 * @param {string} sortKey - Sortier-Methode
 * @returns {Array} Neue sortierte Liste
 */
function sortReports(reports, sortKey) {
    const sorted = [...reports];
    switch (sortKey) {
        case 'date-asc':
            return sorted.sort((a, b) => (a.id || 0) - (b.id || 0));
        case 'date-desc':
            return sorted.sort((a, b) => (b.id || 0) - (a.id || 0));
        case 'title-asc':
            return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));
        case 'title-desc':
            return sorted.sort((a, b) => (b.title || '').localeCompare(a.title || '', 'de'));
        case 'provider-asc':
            return sorted.sort((a, b) => (a.provider || '').localeCompare(b.provider || '', 'de'));
        default:
            return sorted;
    }
}

// Bei Sortier-Aenderung: Preference speichern und Liste neu rendern
sortSelect.addEventListener('change', () => {
    localStorage.setItem(LS_SORT_KEY, sortSelect.value);
    const query = searchInput.value.trim().toLowerCase();
    const filtered = query ? filterReports(allReportsCache, query) : allReportsCache;
    const sorted = sortReports(filtered, sortSelect.value);
    renderReportsList(sorted);
});

// Cache aller Berichte (fuer Suche ohne Roundtrip zur DB)
let allReportsCache = [];

// Zuletzt verarbeitetes Audio-Blob (fuer spaetere Speicherung)
let lastProcessedAudioBlob = null;
let currentAudioURL = null;

// ============================================================
// ABSCHNITT 2: APP-INITIALISIERUNG
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Migration alter Daten (v1 -> v2)
        await migrateV1ToV2();

        // 2. Firebase-Auth initialisieren
        currentUser = await initAuth();
        console.log('Firebase Auth OK, UID:', currentUser.uid);

        // 3. Session wiederherstellen (wenn zuvor entsperrt)
        const restored = await tryRestoreSession();

        // 4. Settings in UI laden
        loadSettingsUI();

        // 5. Provider-Liste im Dropdown aufbauen
        buildProviderDropdown();

        // 6. Hintergrund-Schutz einrichten
        setupBackgroundProtection();

        // 7. Berichte anzeigen
        await displayReportsList();

        // 8. Wenn Vault noch gesperrt ist, aber Provider API-Keys braucht: Hinweis
        updateProviderStatus();

        if (!hasMasterPassword()) {
            // Erster Start: Setup direkt oeffnen
            toast.info('Willkommen! Bitte richte ein Master-Passwort ein (mindestens 12 Zeichen).');
            openUnlockModal(
                'Master-Passwort einrichten',
                'Bitte ein Master-Passwort waehlen (mindestens 12 Zeichen). Es schuetzt alle deine API-Keys. WICHTIG: Es kann nicht zurueckgesetzt werden - bei Verlust sind alle Keys geloescht.',
                true
            );
        } else {
            // Bestehender Nutzer: muss entsperren (Key nicht persistiert - Sicherheitsfeature)
            openUnlockModal(
                'Master-Passwort',
                'Bitte Master-Passwort eingeben, um deine API-Keys zu entsperren.'
            );
        }

    } catch (err) {
        console.error('Initialisierungsfehler:', err);
        toast.error('App konnte nicht gestartet werden: ' + err.message);
    }
});

// ============================================================
// ABSCHNITT 3: MIGRATION VON v1 AUF v2
// ============================================================
// Uebernimmt den alten Gemini-API-Key aus localStorage (v1)
// in den neuen verschluesselten Vault (v2).
// Wird nur beim ersten Start nach dem Update ausgefuehrt.

async function migrateV1ToV2() {
    const LEGACY_GEMINI_KEY = 'gemini_api_key';
    const oldKey = localStorage.getItem(LEGACY_GEMINI_KEY);
    const MIGRATION_FLAG = 'v2_migration_done';

    if (!oldKey || localStorage.getItem(MIGRATION_FLAG)) {
        // Entweder kein alter Key vorhanden, oder Migration schon erledigt
        return;
    }

    // Migration nur moeglich wenn schon ein Vault existiert und entsperrt ist
    if (!hasMasterPassword()) {
        // Wir koennen nicht migrieren bevor der Vault existiert.
        // Behalte den alten Key erstmal. Setup-Master-Passwort-Flow
        // wird das abholen.
        return;
    }

    try {
        if (!isUnlocked()) {
            // Vault existiert aber gesperrt - User muss erst entsperren
            // Migration spaeter automatisch nach Entsperren.
            return;
        }

        // Key verschluesselt speichern
        await storeApiKey('gemini', 'gemini_api_key', oldKey);

        // Alten Klartext-Key loeschen (Sicherheit!)
        localStorage.removeItem(LEGACY_GEMINI_KEY);

        // Migration als erledigt markieren
        localStorage.setItem(MIGRATION_FLAG, Date.now().toString());

        toast.success('Alter API-Key wurde sicher migriert.');
    } catch (err) {
        console.error('Migration fehlgeschlagen:', err);
        // Bei Fehler bleibt der alte Key erhalten, keine Datenzerstoerung
    }
}

// ============================================================
// ABSCHNITT 4: EINSTELLUNGEN & PROVIDER-UI
// ============================================================

/**
 * Fuellt das Provider-Dropdown mit allen verfuegbaren Anbietern.
 */
function buildProviderDropdown() {
    providerSelect.innerHTML = '';
    getAllProviders().forEach(provider => {
        const opt = document.createElement('option');
        opt.value = provider.id;
        opt.textContent = provider.name + (provider.multiStage ? ' (2-Stage)' : '');
        providerSelect.appendChild(opt);
    });

    // Gespeicherte Auswahl laden
    const savedId = localStorage.getItem(LS_SELECTED_PROVIDER) || getDefaultProvider().id;
    providerSelect.value = savedId;
    currentProvider = getProviderById(savedId) || getDefaultProvider();

    updateProviderStatus();
}

/**
 * Aktualisiert die provider-spezifischen Eingabefelder (API-Keys).
 * Wird aufgerufen, wenn der Provider gewechselt wird oder Vault entsperrt.
 */
async function refreshApiKeyFields() {
    apiKeysContainer.innerHTML = '';

    if (!isUnlocked()) {
        // Vault gesperrt: Hinweis anzeigen
        const hint = document.createElement('div');
        hint.className = 'help-text';
        hint.textContent = 'Bitte Master-Passwort eingeben, um API-Keys zu verwalten.';
        apiKeysContainer.appendChild(hint);
        providerHelp.textContent = 'Vault gesperrt.';
        return;
    }

    // Fuer jeden benoetigten Key ein Eingabefeld erzeugen
    const requiredKeys = currentProvider.getRequiredKeys();
    const savedKeys = await getProviderKeys(currentProvider.id);

    requiredKeys.forEach(k => {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.innerHTML = `
            <label for="key-${k.id}">${k.label}</label>
            <input type="password" id="key-${k.id}" data-key-id="${k.id}" placeholder="${k.placeholder}" value="${escapeHTML(savedKeys[k.id] || '')}">
        `;
        apiKeysContainer.appendChild(group);
    });

    // Help-Text: Info zum Provider
    if (currentProvider.multiStage) {
        providerHelp.textContent = 'Dieser Anbieter nutzt 2 Stufen (Whisper-STT + LLM). Dafuer sind 2 API-Calls noetig.';
    } else {
        providerHelp.textContent = '1-Stage: Audio wird direkt verarbeitet (schneller, guenstiger).';
    }
}

/**
 * Laedt die allgemeinen Settings (Vorlage, Provider) ins UI.
 */
function loadSettingsUI() {
    promptSelect.value = localStorage.getItem(LS_PROMPT_TEMPLATE) || 'standard';
    updatePasswordStatus();
}

/**
 * Aktualisiert die Sicherheits-Status-Anzeige.
 * Setzt auch den kleinen Vault-Punkt im Header (gruen = entsperrt).
 */
function updatePasswordStatus() {
    if (!hasMasterPassword()) {
        passwordStatus.innerHTML = '<span class="status-warning">Kein Master-Passwort eingerichtet.</span>';
        lockVaultBtn.classList.add('hidden');
        setVaultIndicator('locked');
    } else if (isUnlocked()) {
        passwordStatus.innerHTML = '<span class="status-success">Vault entsperrt. Keys sind zugreifbar.</span>';
        lockVaultBtn.classList.remove('hidden');
        setVaultIndicator('unlocked');
    } else {
        passwordStatus.innerHTML = '<span class="status-error">Vault gesperrt. Bitte entsperren.</span>';
        lockVaultBtn.classList.add('hidden');
        setVaultIndicator('locked');
    }
}

/**
 * Setzt den Vault-Punkt im Header.
 * @param {'unlocked'|'locked'} state
 */
function setVaultIndicator(state) {
    if (!vaultStatusIndicator) return;
    if (state === 'unlocked') {
        vaultStatusIndicator.classList.remove('vault-locked');
        vaultStatusIndicator.classList.add('vault-unlocked');
        vaultStatusIndicator.title = 'Vault entsperrt';
    } else {
        vaultStatusIndicator.classList.remove('vault-unlocked');
        vaultStatusIndicator.classList.add('vault-locked');
        vaultStatusIndicator.title = 'Vault gesperrt';
    }
}

/**
 * Aktualisiert den Status-Badge im Header sowie den Provider-Switcher.
 */
function updateProviderStatus() {
    if (activeProviderBadge) {
        activeProviderBadge.textContent = currentProvider.name;
    }
    updateProviderSwitcher();
}

/**
 * Rendert den aktiven Provider in den Switcher auf der Startseite.
 * Zeigt Icon (in Provider-Farbe) + Name + Status-Badge.
 * Status: "bereit" (gruen) wenn Vault offen und Keys vorhanden,
 *         "Key fehlt" (orange) sonst.
 */
async function updateProviderSwitcher() {
    if (!providerSwitcher) return;

    const meta = getProviderMeta(currentProvider.id);

    // Icon in der Provider-Farbe
    if (switcherProviderIcon) {
        switcherProviderIcon.innerHTML =
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${meta.icon}</svg>`;
        switcherProviderIcon.style.color = meta.color;
    }

    if (switcherProviderName) {
        switcherProviderName.textContent = currentProvider.name;
    }

    // Status pruefen (asynchron, weil Vault-Abfrage noetig ist)
    if (switcherProviderStatus) {
        switcherProviderStatus.textContent = 'pruefe...';
        switcherProviderStatus.className = 'provider-switcher-status status-checking';
        try {
            const ready = await checkCurrentProviderKeys();
            if (ready) {
                switcherProviderStatus.textContent = 'bereit';
                switcherProviderStatus.className = 'provider-switcher-status status-ready';
            } else {
                switcherProviderStatus.textContent = 'Key fehlt';
                switcherProviderStatus.className = 'provider-switcher-status status-missing';
            }
        } catch (err) {
            switcherProviderStatus.textContent = 'gesperrt';
            switcherProviderStatus.className = 'provider-switcher-status status-missing';
        }
    }
}

/**
 * Baut das Bottom-Sheet mit allen 7 Anbietern auf.
 * Tap auf einen Eintrag = sofort aktiv, Sheet schliesst.
 */
function renderProviderSheet() {
    if (!providerSheetBody) return;

    const allProviders = getAllProviders();
    providerSheetBody.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'provider-list';

    allProviders.forEach(provider => {
        const meta = getProviderMeta(provider.id);
        const isActive = provider.id === currentProvider.id;

        const item = document.createElement('button');
        item.className = 'provider-list-item' + (isActive ? ' active' : '');
        item.type = 'button';
        item.innerHTML = `
            <span class="provider-list-icon" style="color: ${meta.color}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${meta.icon}</svg>
            </span>
            <span class="provider-list-text">
                <span class="provider-list-name">${escapeHTML(provider.name)}</span>
                <span class="provider-list-tagline">${escapeHTML(meta.tagline)}${provider.multiStage ? ' &middot; 2-Stage' : ''}</span>
            </span>
            <span class="provider-list-check">${isActive ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}</span>
        `;

        item.addEventListener('click', () => selectProviderFromSheet(provider.id));
        list.appendChild(item);
    });

    providerSheetBody.appendChild(list);

    // Hinweistext unten
    const hint = document.createElement('p');
    hint.className = 'help-text';
    hint.style.marginTop = '12px';
    hint.innerHTML = 'API-Keys pro Anbieter unter <strong>Einstellungen</strong> verwalten. Ein Tap hier reicht zum Wechseln.';
    providerSheetBody.appendChild(hint);
}

/**
 * Waehlt einen Provider aus dem Sheet aus und speichert sofort.
 * @param {string} providerId
 */
async function selectProviderFromSheet(providerId) {
    const provider = getProviderById(providerId);
    if (!provider) return;

    currentProvider = provider;
    localStorage.setItem(LS_SELECTED_PROVIDER, providerId);

    // Auch im Settings-Dropdown synchronisieren (falls offen)
    if (providerSelect) providerSelect.value = providerId;

    await updateProviderSwitcher();
    renderProviderSheet(); // active-Check neu setzen
    hideModal(providerSheet);

    toast.info(`Anbieter: ${provider.name}`);
}

// === Provider-Switcher Events ===
if (providerSwitcher) {
    providerSwitcher.addEventListener('click', () => {
        renderProviderSheet();
        showModal(providerSheet);
    });
}
if (closeProviderSheetBtn) {
    closeProviderSheetBtn.addEventListener('click', () => hideModal(providerSheet));
}
if (providerSheet) {
    // Klick auf Hintergrund schliesst das Sheet
    providerSheet.addEventListener('click', (e) => {
        if (e.target === providerSheet) hideModal(providerSheet);
    });
}

/**
 * Speichert die Einstellungen: Provider-Auswahl, API-Keys, Vorlage.
 */
async function saveSettings() {
    // 1. Provider-Auswahl speichern
    const providerId = providerSelect.value;
    localStorage.setItem(LS_SELECTED_PROVIDER, providerId);
    currentProvider = getProviderById(providerId);

    // 2. Vorlage speichern
    localStorage.setItem(LS_PROMPT_TEMPLATE, promptSelect.value);

    // 3. API-Keys speichern (wenn Vault entsperrt)
    if (isUnlocked()) {
        const inputs = apiKeysContainer.querySelectorAll('input[data-key-id]');
        for (const input of inputs) {
            const keyId = input.dataset.keyId;
            const value = input.value.trim();
            if (value) {
                await storeApiKey(currentProvider.id, keyId, value);
            }
        }
        toast.success('Einstellungen gespeichert.');
    } else {
        toast.warning('Provider & Vorlage gespeichert. API-Keys brauchen entsperrten Vault.');
    }

    updateProviderStatus();
    hideModal(settingsModal);

    // Status-Text aktualisieren
    const hasKey = isUnlocked() && await checkCurrentProviderKeys();
    if (hasKey) {
        statusText.textContent = 'Bereit zum Aufnehmen';
    }
}

/**
 * Prueft ob der aktuelle Provider alle noetigen Keys hat.
 */
async function checkCurrentProviderKeys() {
    if (!isUnlocked()) return false;
    const keys = await getProviderKeys(currentProvider.id);
    return currentProvider.hasAllRequiredKeys(keys);
}

// ============================================================
// ABSCHNITT 5: VAULT-UI (Master-Passwort)
// ============================================================

/**
 * Oeffnet das Unlock-Modal mit beliebigem Titel/Hinweis.
 * @param {string} title    - Titel des Modals
 * @param {string} hint     - Hinweistext
 * @param {boolean} isSetup - true = Setup-Modus (mit Bestaetigungsfeld)
 */
function openUnlockModal(title, hint, isSetup = false) {
    unlockTitle.textContent = title;
    unlockHint.textContent = hint;
    masterPasswordInput.value = '';
    const confirmInput = document.getElementById('master-password-confirm');
    const confirmGroup = document.getElementById('password-confirm-group');
    if (confirmInput) confirmInput.value = '';

    if (isSetup) {
        confirmGroup.classList.remove('hidden');
        unlockBtn.textContent = 'Passwort speichern';
        masterPasswordInput.placeholder = 'Neues Passwort (mindestens 12 Zeichen)';
    } else {
        confirmGroup.classList.add('hidden');
        unlockBtn.textContent = 'Entsperren';
        masterPasswordInput.placeholder = 'Master-Passwort';
    }

    showModal(unlockModal);
    setTimeout(() => masterPasswordInput.focus(), 100);
}

/**
 * Behandlung des Unlock-Buttons.
 * - Wenn kein Vault existiert: Setup-Modus (Passwort neu erstellen)
 * - Wenn Vault existiert: Entsperren mit vorhandenem Passwort
 */
unlockBtn.addEventListener('click', async () => {
    const password = masterPasswordInput.value;
    const confirmInput = document.getElementById('master-password-confirm');
    const confirmGroup = document.getElementById('password-confirm-group');
    const isSetupMode = !confirmGroup.classList.contains('hidden');

    if (password.length < 12) {
        toast.error('Passwort muss mindestens 12 Zeichen lang sein.');
        return;
    }

    // Bei Setup: Bestaetigung pruefen
    if (isSetupMode) {
        const confirmation = confirmInput.value;
        if (password !== confirmation) {
            toast.error('Passwoerter stimmen nicht ueberein.');
            confirmInput.focus();
            return;
        }
    }

    try {
        if (!hasMasterPassword()) {
            // Setup-Modus: Neuen Vault erstellen
            await setupMasterPassword(password);
            toast.success('Master-Passwort eingerichtet.');

            // Alte v1-Daten migrieren (falls vorhanden)
            await migrateV1ToV2();

            hideModal(unlockModal);
            updatePasswordStatus();
            await refreshApiKeyFields();
        } else {
            // Entsperr-Modus
            const ok = await unlock(password);
            if (ok) {
                toast.success('Vault entsperrt.');
                hideModal(unlockModal);
                updatePasswordStatus();
                await refreshApiKeyFields();
                await migrateV1ToV2();
                updateProviderSwitcher();
            } else {
                toast.error('Falsches Passwort.');
                masterPasswordInput.value = '';
                masterPasswordInput.focus();
            }
        }
    } catch (err) {
        // Sichere Fehlermeldung: keine internen Details nach aussen
        console.error('Vault-Fehler:', err.name);
        toast.error('Aktion fehlgeschlagen. Bitte erneut versuchen.');
    }
});

// Enter-Taste im Passwort-Feld loest Unlock aus
masterPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        // Wenn Setup: ins Bestaetigungsfeld springen, sonst direkt unlock
        const confirmGroup = document.getElementById('password-confirm-group');
        if (!confirmGroup.classList.contains('hidden')) {
            document.getElementById('master-password-confirm').focus();
        } else {
            unlockBtn.click();
        }
    }
});

// Enter im Bestaetigungsfeld loest Unlock aus
const masterPasswordConfirm = document.getElementById('master-password-confirm');
if (masterPasswordConfirm) {
    masterPasswordConfirm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') unlockBtn.click();
    });
}

/**
 * Vault sperren (Logout).
 */
lockVaultBtn.addEventListener('click', () => {
    lock();
    toast.info('Vault gesperrt.');
    updatePasswordStatus();
    refreshApiKeyFields();
    updateProviderSwitcher();
});

/**
 * Kompletter Reset (Passwort vergessen).
 */
resetVaultBtn.addEventListener('click', async () => {
    if (!confirm('Wirklich alle API-Keys, Audios und das Master-Passwort loeschen? Diese Aktion kann nicht rueckgaengig gemacht werden.')) {
        return;
    }
    try {
        resetVault();
        // Auch verschluesselte Audios loeschen (sind ohne Master-Key unlesbar)
        await clearAllAudios();
    } catch (err) {
        console.warn('Audio-Loeschung fehlgeschlagen:', err.name);
    }
    toast.info('Vault zurueckgesetzt. Bitte neues Master-Passwort einrichten.');
    updatePasswordStatus();
    openUnlockModal(
        'Master-Passwort einrichten',
        'Bitte ein neues Master-Passwort waehlen (mindestens 12 Zeichen).',
        true
    );
});

// ============================================================
// ABSCHNITT 6: PROVIDER-WECHSEL
// ============================================================

providerSelect.addEventListener('change', async () => {
    const newId = providerSelect.value;
    currentProvider = getProviderById(newId);
    await refreshApiKeyFields();
    updateProviderStatus();
});

// ============================================================
// ABSCHNITT 7: WAKE LOCK (Bildschirm bleibt an)
// ============================================================

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock wurde freigegeben');
            });
        } catch (err) {
            console.warn('Wake Lock Fehler:', err);
        }
    } else {
        console.warn('Wake Lock API nicht unterstuetzt');
    }
}

async function releaseWakeLock() {
    if (wakeLock !== null) {
        try {
            await wakeLock.release();
            wakeLock = null;
        } catch (err) {
            console.warn('Fehler beim Freigeben des Wake Lock:', err);
        }
    }
}

// ============================================================
// ABSCHNITT 8: HINTERGRUND-SCHUTZ
// ============================================================

function setupBackgroundProtection() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && isRecording) {
            console.log('App im Hintergrund - Aufnahme geschuetzt');
        }
        if (document.visibilityState === 'visible' && isRecording) {
            requestWakeLock();
        }
    });

    window.addEventListener('beforeunload', (event) => {
        if (isRecording) {
            event.preventDefault();
            event.returnValue = '';
        }
    });
}

// ============================================================
// ABSCHNITT 9: MIKROFON-AUFNAHME
// ============================================================

recordBtn.addEventListener('click', async () => {
    // Pruefen: Vault entsperrt?
    if (!isUnlocked()) {
        toast.warning('Bitte erst Master-Passwort eingeben.');
        openUnlockModal('Master-Passwort', 'Bitte entsperren, um aufnehmen zu koennen.');
        return;
    }

    // Pruefen: API-Keys fuer aktuellen Provider vorhanden?
    const hasKeys = await checkCurrentProviderKeys();
    if (!hasKeys) {
        toast.warning(`${currentProvider.name} braucht noch API-Keys.`);
        showModal(settingsModal);
        await refreshApiKeyFields();
        return;
    }

    // Aufnahme starten/stoppen
    if (isRecording) {
        stopAudioRecording();
    } else {
        startAudioRecording();
    }
});

async function startAudioRecording() {
    audioChunks = [];
    statusText.textContent = 'Frage Mikrofon-Berechtigung ab...';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        activeStream = stream;

        await requestWakeLock();

        // Format erkennen (iOS Safari = mp4, Chrome = webm)
        let options = {};
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
            options.mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            options.mimeType = 'audio/webm';
        }

        mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            if (audioChunks.length > 0) {
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
                await processAudioWithProvider(audioBlob);
            } else {
                statusText.textContent = 'Keine Audiodaten aufgenommen.';
            }
            cleanupStream();
        };

        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder Fehler:', event.error);
            isRecording = false;
            updateRecordingUI(false);
            if (audioChunks.length > 0) {
                statusText.textContent = 'Aufnahme unterbrochen - verarbeite vorhandenes Audio...';
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/mp4' });
                processAudioWithProvider(audioBlob);
            } else {
                statusText.textContent = 'Aufnahme unterbrochen. Kein Audio vorhanden.';
            }
            cleanupStream();
        };

        mediaRecorder.start(250);
        isRecording = true;
        updateRecordingUI(true);
        statusText.textContent = 'Aufnahme laeuft...';

        startTime = Date.now();
        updateTimer();
        recordTimerInterval = setInterval(updateTimer, 1000);

    } catch (err) {
        console.error('Mikrofonzugriff fehlgeschlagen:', err);
        statusText.textContent = 'Fehler: Mikrofon verweigert.';
        toast.error('Mikrofonzugriff abgelehnt. Bitte in iOS-Einstellungen erlauben (Safari).');
        await releaseWakeLock();
    }
}

async function stopAudioRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    mediaRecorder.stop();
    isRecording = false;
    updateRecordingUI(false);
    clearInterval(recordTimerInterval);
    timerText.textContent = '00:00';
    statusText.textContent = 'Aufnahme beendet. Verarbeitung gestartet...';
    await releaseWakeLock();
}

function updateRecordingUI(recording) {
    if (recording) {
        recordBtn.classList.add('recording');
        micIcon.classList.add('hidden');
        stopIcon.classList.remove('hidden');
        if (recordingHint) recordingHint.classList.remove('hidden');
        if (waveBars) waveBars.classList.remove('hidden');
    } else {
        recordBtn.classList.remove('recording');
        micIcon.classList.remove('hidden');
        stopIcon.classList.add('hidden');
        if (recordingHint) recordingHint.classList.add('hidden');
        if (waveBars) waveBars.classList.add('hidden');
    }
}

function cleanupStream() {
    if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
        activeStream = null;
    }
}

function updateTimer() {
    timerText.textContent = formatDuration(Date.now() - startTime);
}

// ============================================================
// ABSCHNITT 10: AUDIO-IMPORT
// ============================================================

if (importBtn) {
    importBtn.addEventListener('click', async () => {
        if (!isUnlocked()) {
            openUnlockModal('Master-Passwort', 'Bitte entsperren, um Import zu nutzen.');
            return;
        }
        const hasKeys = await checkCurrentProviderKeys();
        if (!hasKeys) {
            toast.warning(`${currentProvider.name} braucht noch API-Keys.`);
            showModal(settingsModal);
            await refreshApiKeyFields();
            return;
        }
        audioFileInput.click();
    });
}

if (audioFileInput) {
    audioFileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('audio/')) {
            toast.error('Bitte eine Audio-Datei waehlen (.m4a, .mp3, .wav).');
            return;
        }

        const maxSizeMB = 20;
        if (file.size > maxSizeMB * 1024 * 1024) {
            toast.error(`Datei zu gross (max ${maxSizeMB} MB).`);
            return;
        }

        statusText.textContent = `Datei "${file.name}" wird verarbeitet...`;
        await processAudioWithProvider(file);
        audioFileInput.value = '';
    });
}

// ============================================================
// ABSCHNITT 11: AUDIO-VERARBEITUNG (UEBER PROVIDER)
// ============================================================
// Diese Funktion ist die zentrale Stelle: egal welcher Provider
// aktiv ist, hier laeuft alles zusammen.

async function processAudioWithProvider(audioBlob) {
    loadingContainer.classList.remove('hidden');
    loadingText.textContent = 'Audio wird vorbereitet...';
    recordBtn.disabled = true;

    try {
        // 1. API-Keys fuer aktuellen Provider holen
        const keys = await getProviderKeys(currentProvider.id);
        if (!currentProvider.hasAllRequiredKeys(keys)) {
            throw new Error(`Nicht alle API-Keys fuer ${currentProvider.name} gesetzt.`);
        }

        // 1b. Audio-Blob fuer spaetere Speicherung referenzieren
        lastProcessedAudioBlob = audioBlob;

        // 2. Vorlage laden
        const template = localStorage.getItem(LS_PROMPT_TEMPLATE) || 'standard';

        // 3. Fortschritts-Callback fuer UI-Updates
        const onProgress = (msg) => {
            loadingText.textContent = msg;
        };

        // 4. Provider aufrufen (hier passiert die Magie)
        let markdownText = await currentProvider.processAudio(audioBlob, template, keys, onProgress);

        // 5. Schweizer Rechtschreibung korrigieren (Sicherheitsnetz)
        markdownText = korrigiereSchweizerRechtschreibung(markdownText);

        // 6. Titel extrahieren
        const title = extractTitle(markdownText);

        // 7. Bericht-Objekt bauen
        const newReport = {
            id: Date.now(),
            title: title,
            date: formatSwissDateTime(),
            content: markdownText,
            provider: currentProvider.name,
            createdAt: Date.now()
        };

        // 8. In Firestore speichern
        await saveReport(newReport);

        // 8b. Audio lokal speichern (IndexedDB), damit man es wiederhoeren kann
        if (lastProcessedAudioBlob) {
            try {
                await saveAudio(newReport.id, lastProcessedAudioBlob);
                lastProcessedAudioBlob = null;  // Freigeben
            } catch (audioErr) {
                console.warn('Audio konnte nicht gespeichert werden:', audioErr.name);
                // kein harter Fehler - Audio ist optional
            }
        }

        // 9. UI aktualisieren
        await displayReportsList();
        statusText.textContent = 'Protokoll erfolgreich erstellt!';
        toast.success('Protokoll erstellt mit ' + currentProvider.name);
        openReportDetail(newReport);

    } catch (err) {
        console.error('Verarbeitungsfehler:', err);
        statusText.textContent = 'Verarbeitung fehlgeschlagen.';
        toast.error('Fehler bei ' + currentProvider.name + ': ' + err.message);
    } finally {
        loadingContainer.classList.add('hidden');
        recordBtn.disabled = false;
    }
}

// ============================================================
// ABSCHNITT 12: BERICHTE ANZEIGEN
// ============================================================

async function displayReportsList() {
    // Lade alle Berichte und cachen sie fuer die Suche
    allReportsCache = await getAllReports();

    // Such- und Sortier-Feld anzeigen, wenn es 3+ Berichte gibt
    if (allReportsCache.length >= 3) {
        searchBar.classList.remove('hidden');
        sortBar.classList.remove('hidden');
        // Gespeicherte Sortier-Preference laden
        sortSelect.value = getSortPreference();
    } else {
        searchBar.classList.add('hidden');
        sortBar.classList.add('hidden');
    }

    // Anzahl-Badge aktualisieren
    if (allReportsCache.length > 0) {
        reportCountBadge.textContent = allReportsCache.length;
        reportCountBadge.classList.remove('hidden');
    } else {
        reportCountBadge.classList.add('hidden');
    }

    // Aktuellen Such-Filter + Sortierung anwenden
    const query = searchInput.value.trim().toLowerCase();
    const filtered = query ? filterReports(allReportsCache, query) : allReportsCache;
    const sorted = sortReports(filtered, getSortPreference());

    renderReportsList(sorted);
}

/**
 * Filtert Berichte nach Suchbegriff (Titel, Inhalt, Datum, Provider).
 *
 * @param {Array} reports - Alle Berichte
 * @param {string} query  - Suchbegriff (kleingeschrieben)
 * @returns {Array} Gefilterte Berichte
 */
function filterReports(reports, query) {
    return reports.filter(r => {
        const haystack = [
            r.title || '',
            r.content || '',
            r.date || '',
            r.provider || ''
        ].join(' ').toLowerCase();
        return haystack.includes(query);
    });
}

/**
 * Rendert eine Liste von Berichten ins DOM.
 * @param {Array} reports - Die zu rendernden Berichte
 */
function renderReportsList(reports) {
    reportsList.innerHTML = '';

    if (allReportsCache.length === 0) {
        // Gar keine Berichte vorhanden
        emptyState.classList.remove('hidden');
        emptyState.querySelector('p').textContent = 'Noch keine Protokolle vorhanden.';
        emptyState.querySelector('.subtitle').textContent = 'Nehmen Sie Ihr erstes Meeting auf, um ein Protokoll zu erstellen.';
        return;
    }

    emptyState.classList.add('hidden');

    if (reports.length === 0) {
        // Berichte vorhanden, aber Suche liefert keine Treffer
        const noMatch = document.createElement('div');
        noMatch.className = 'empty-state';
        noMatch.innerHTML = `
            <p>Keine Treffer fuer "${escapeHTML(searchInput.value)}".</p>
            <p class="subtitle">Aendere die Suche oder loesche sie.</p>
        `;
        reportsList.appendChild(noMatch);
        return;
    }

    reports.forEach(report => {
        const item = document.createElement('div');
        item.className = 'report-item';

        // Provider-Farbe fuer den Avatars-Kreis bestimmen
        // (Suche in der Provider-Liste nach dem Namen, Fallback = Akzentfarbe)
        const providerMeta = guessProviderMetaByName(report.provider);

        // Avatars-Icon (kleines Mikrofon in Provider-Farbe)
        const avatarSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${providerMeta.icon}</svg>`;

        const providerBadge = report.provider
            ? `<span class="report-provider" style="color: ${providerMeta.color}; background: ${hexToRgba(providerMeta.color, 0.14)};">${escapeHTML(report.provider)}</span>`
            : '';

        // Vorschau: erste 1-2 Zeilen Inhalt (Markdown bereinigt)
        const previewText = buildPreview(report.content);

        // Tags als kleine Chips (max 3 anzeigen, Rest als "+N")
        const tags = report.tags || [];
        let tagsHTML = '';
        if (tags.length > 0) {
            const visibleTags = tags.slice(0, 3);
            const extraCount = tags.length - visibleTags.length;
            tagsHTML = '<div class="report-tags">' +
                visibleTags.map(t => `<span class="tag-chip-small">${escapeHTML(t)}</span>`).join('') +
                (extraCount > 0 ? `<span class="tag-more">+${extraCount}</span>` : '') +
                '</div>';
        }

        item.innerHTML = `
            <div class="report-avatar" style="background: ${hexToRgba(providerMeta.color, 0.15)}; color: ${providerMeta.color};">
                ${avatarSVG}
            </div>
            <div class="report-info">
                <div class="report-title">${escapeHTML(report.title)}</div>
                ${previewText ? `<div class="report-preview">${escapeHTML(previewText)}</div>` : ''}
                <div class="report-meta">${escapeHTML(report.date)} ${providerBadge}</div>
                ${tagsHTML}
            </div>
            <svg class="report-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        `;

        item.addEventListener('click', () => openReportDetail(report));
        reportsList.appendChild(item);
    });
}

/**
 * Versucht, anhand des gespeicherten Provider-Namens (im Report)
 * die Provider-Metadaten (Farbe, Icon) zu finden.
 *
 * Hintergrund: Reports speichern den Namen ("Google Gemini"),
 * nicht die Id. Darum vergleichen wir hier ueber den Namen.
 *
 * @param {string} providerName
 * @returns {{color: string, icon: string}}
 */
function guessProviderMetaByName(providerName) {
    if (!providerName) return getProviderMeta('__unknown__');
    const match = getAllProviders().find(p => p.name === providerName);
    if (match) return getProviderMeta(match.id);
    return getProviderMeta('__unknown__');
}

/**
 * Erzeugt eine kurze Vorschau aus dem Markdown-Inhalt.
 * Entfernt Markdown-Symbole und kuerzt auf ~100 Zeichen.
 *
 * @param {string} content - Markdown-Text
 * @returns {string} Vorschau-Text (max ~100 Zeichen)
 */
function buildPreview(content) {
    if (!content) return '';
    return content
        .replace(/^#{1,6}\s+/gm, '')      // Ueberschriften-Symbole entfernen
        .replace(/\*\*(.+?)\*\*/g, '$1')  // Fett-Kursiv
        .replace(/\*(.+?)\*/g, '$1')       // Kursiv
        .replace(/- (.+)/g, '$1')          // Listenpunkte
        .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
        .replace(/\s+/g, ' ')              // Leerzeichen normalisieren
        .trim()
        .slice(0, 100);
}

/**
 * Wandelt einen Hex-Farbwert in einen rgba()-String um.
 * Hilfsfunktion fuer transparenz-basierte Hintergruende.
 *
 * @param {string} hex - z.B. "#3B82F6"
 * @param {number} alpha - 0 bis 1
 * @returns {string} z.B. "rgba(59, 130, 246, 0.14)"
 */
function hexToRgba(hex, alpha) {
    if (!hex || !hex.startsWith('#')) return `rgba(148, 163, 184, ${alpha})`;
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Live-Suche: bei jeder Eingabe filtern + sortieren
searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    clearSearchBtn.classList.toggle('hidden', query.length === 0);

    const filtered = query ? filterReports(allReportsCache, query) : allReportsCache;
    const sorted = sortReports(filtered, getSortPreference());
    renderReportsList(sorted);
});

// Suche loeschen
clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    const sorted = sortReports(allReportsCache, getSortPreference());
    renderReportsList(sorted);
    searchInput.focus();
});

function openReportDetail(report) {
    currentActiveReportId = report.id;
    currentActiveReport = report;
    detailTitle.textContent = report.title;
    detailBodyContent.innerHTML = renderMarkdownToHTML(report.content);
    showModal(detailModal);

    // Audio-Player anzeigen, falls Audio vorhanden
    loadAudioForReport(report.id);

    // Tags rendern
    renderReportTags();
    hideTagInput();
}

/**
 * Laedt das verknuepfte Audio fuer einen Bericht und zeigt den Player.
 * @param {number|string} reportId
 */
async function loadAudioForReport(reportId) {
    // Vorherige URL freigeben
    if (currentAudioURL) {
        URL.revokeObjectURL(currentAudioURL);
        currentAudioURL = null;
    }

    try {
        const exists = await hasAudio(reportId);
        if (!exists) {
            audioPlayerContainer.classList.add('hidden');
            audioPlayer.src = '';
            return;
        }

        const blob = await getAudio(reportId);
        if (!blob) {
            audioPlayerContainer.classList.add('hidden');
            return;
        }

        currentAudioURL = URL.createObjectURL(blob);
        audioPlayer.src = currentAudioURL;
        audioPlayerContainer.classList.remove('hidden');
    } catch (err) {
        console.warn('Audio konnte nicht geladen werden:', err.name);
        audioPlayerContainer.classList.add('hidden');
    }
}

// Audio herunterladen
downloadAudioBtn.addEventListener('click', () => {
    if (!currentAudioURL || !currentActiveReport) return;
    const a = document.createElement('a');
    a.href = currentAudioURL;
    const safeTitle = (currentActiveReport.title || 'Audio').replace(/[^a-zA-Z0-9äöüÄÖÜ\-_ ]/g, '').trim();
    a.download = `${safeTitle}.m4a`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.info('Audio wird heruntergeladen.');
});

// ============================================================
// ABSCHNITT 13: EXPORT & TEILEN
// ============================================================

pdfReportBtn.addEventListener('click', () => {
    window.print();
});

// DOCX-Export: Lädt Markdown in eine echte Word-Datei um
docxReportBtn.addEventListener('click', async () => {
    if (!currentActiveReport) return;
    try {
        docxReportBtn.disabled = true;
        toast.info('Word-Dokument wird erstellt...');
        await exportMarkdownToDocx(currentActiveReport.content, currentActiveReport.title);
        toast.success('DOCX-Export fertig.');
    } catch (err) {
        console.error('DOCX-Fehler:', err.name);
        toast.error('DOCX-Export fehlgeschlagen.');
    } finally {
        docxReportBtn.disabled = false;
    }
});

shareReportBtn.addEventListener('click', async () => {
    if (!currentActiveReportId) return;
    const title = detailTitle.textContent;
    const text = detailBodyContent.innerText;
    const shareData = { title, text: title + "\n\n" + text };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            const mailto = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareData.text)}`;
            window.location.href = mailto;
        }
    } catch (err) {
        console.error('Teilen fehlgeschlagen:', err);
    }
});

copyReportBtn.addEventListener('click', async () => {
    if (!currentActiveReportId) return;
    const reports = await getAllReports();
    const report = reports.find(r => r.id === currentActiveReportId);
    if (report) {
        try {
            await navigator.clipboard.writeText(report.content);
            toast.success('In Zwischenablage kopiert.');
        } catch (err) {
            console.error('Kopierfehler:', err);
            toast.error('Kopieren fehlgeschlagen.');
        }
    }
});

deleteReportBtn.addEventListener('click', async () => {
    if (!currentActiveReportId) return;
    if (!confirm('Dieses Protokoll wirklich loeschen?')) return;
    try {
        // Zuerst Audio lokal loeschen (falls vorhanden)
        try { await deleteAudio(currentActiveReportId); } catch (_) {}
        await deleteReport(currentActiveReportId);
        hideModal(detailModal);
        await displayReportsList();
        toast.success('Protokoll geloescht.');
    } catch (err) {
        toast.error('Loeschen fehlgeschlagen: ' + err.message);
    }
});

// ============================================================
// ABSCHNITT 14b: PROTOKOLL BEARBEITEN (Edit)
// ============================================================
// Oeffnet ein Edit-Modal mit dem aktuellen Markdown-Inhalt.
// Der Nutzer kann Titel und Inhalt frei aendern.
// Beim Speichern wird das Dokument in Firestore aktualisiert.

/**
 * Aktuell geladener Bericht (fuer Edit-Modal).
 * Wird beim Oeffnen des Detail-Modals gesetzt.
 */
let currentActiveReport = null;

// Original-Funktion erweitern: Beim Oeffnen auch Bericht-Objekt merken
const originalOpenReportDetail = openReportDetail;

/**
 * Oeffnet die Detailansicht und merkt sich den Bericht fuer Edit.
 */
function openReportDetailExtended(report) {
    currentActiveReport = report;
    originalOpenReportDetail(report);
}

// Edit-Button: Oeffnet das Edit-Modal mit vorausgefuellten Werten
editReportBtn.addEventListener('click', () => {
    if (!currentActiveReport) return;
    editTitleInput.value = currentActiveReport.title || '';
    editContentInput.value = currentActiveReport.content || '';
    showModal(editModal);
    setTimeout(() => editTitleInput.focus(), 100);
});

// Abbrechen-Button
cancelEditBtn.addEventListener('click', () => hideModal(editModal));

// Speichern-Button: Aenderungen in Firestore schreiben
saveEditBtn.addEventListener('click', async () => {
    if (!currentActiveReportId) return;

    const newTitle = editTitleInput.value.trim();
    const newContent = editContentInput.value;

    if (!newTitle) {
        toast.error('Titel darf nicht leer sein.');
        return;
    }
    if (!newContent.trim()) {
        toast.error('Inhalt darf nicht leer sein.');
        return;
    }

    try {
        saveEditBtn.disabled = true;
        saveEditBtn.textContent = 'Speichere...';

        // Schweizer Rechtschreibung erneut korrigieren (falls manuell was mit sz eingegeben wurde)
        const correctedContent = korrigiereSchweizerRechtschreibung(newContent);

        // In Firestore aktualisieren
        await updateReport(currentActiveReportId, {
            title: newTitle,
            content: correctedContent,
            lastEdited: Date.now()
        });

        // UI aktualisieren
        currentActiveReport.title = newTitle;
        currentActiveReport.content = correctedContent;
        detailTitle.textContent = newTitle;
        detailBodyContent.innerHTML = renderMarkdownToHTML(correctedContent);

        hideModal(editModal);
        await displayReportsList();
        toast.success('Aenderungen gespeichert.');
    } catch (err) {
        console.error('Edit-Fehler:', err.name);
        toast.error('Speichern fehlgeschlagen.');
    } finally {
        saveEditBtn.disabled = false;
        saveEditBtn.textContent = 'Speichern';
    }
});

// ============================================================
// ABSCHNITT 14c: TAGS / KATEGORIEN (v2.2)
// ============================================================
// Jeder Bericht kann mehrere Tags bekommen (z.B. "SMT", "Wartung").
// Tags werden:
//   - In Firestore im Feld "tags" (Array) gespeichert
//   - In der Tag-Liste des Users (localStorage) fuer Vorschlaege gepflegt

/**
 * Rendert die Tags des aktuell geoeffneten Berichts.
 */
function renderReportTags() {
    if (!currentActiveReport) return;
    const tags = currentActiveReport.tags || [];
    reportTagsDisplay.innerHTML = '';

    if (tags.length === 0) {
        reportTagsDisplay.innerHTML = '<span class="no-tags">Keine Tags</span>';
        return;
    }

    tags.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.innerHTML = `
            <span class="tag-chip-label">${escapeHTML(tag)}</span>
            <button class="tag-remove" data-tag="${escapeHTML(tag)}" title="Entfernen">&times;</button>
        `;
        chip.querySelector('.tag-remove').addEventListener('click', () => removeTagFromReport(tag));
        reportTagsDisplay.appendChild(chip);
    });
}

/**
 * Fuegt dem aktuellen Bericht ein Tag hinzu.
 * @param {string} tag
 */
async function addTagToReport(tag) {
    if (!currentActiveReport) return;
    if (!isValidTag(tag)) {
        toast.warning('Tag ist ungueltig.');
        return;
    }

    const cleanTag = tag.trim();
    const currentTags = currentActiveReport.tags || [];

    if (currentTags.includes(cleanTag)) {
        toast.info('Tag ist bereits zugewiesen.');
        return;
    }
    if (currentTags.length >= TAG_LIMITS.MAX_TAGS) {
        toast.warning(`Maximal ${TAG_LIMITS.MAX_TAGS} Tags pro Bericht.`);
        return;
    }

    // Mutex: verhindert Race-Condition bei schnellem Doppelklick
    if (tagUpdateInProgress) {
        toast.info('Bitte kurz warten - letzte Aenderung wird gespeichert.');
        return;
    }
    tagUpdateInProgress = true;

    try {
        // In der globalen Tag-Liste merken (fuer Vorschlaege)
        addTag(cleanTag);

        // In Firestore updaten
        const newTags = [...currentTags, cleanTag];
        await updateReport(currentActiveReportId, { tags: newTags });

        // UI aktualisieren
        currentActiveReport.tags = newTags;
        renderReportTags();
        await displayReportsList();

        toast.success(`Tag "${cleanTag}" hinzugefuegt.`);
    } catch (err) {
        console.error('Tag-Fehler:', err.name);
        toast.error('Tag konnte nicht gespeichert werden.');
    } finally {
        tagUpdateInProgress = false;
    }
}

/**
 * Entfernt ein Tag vom aktuellen Bericht.
 * @param {string} tag
 */
async function removeTagFromReport(tag) {
    if (!currentActiveReport) return;

    // Mutex: verhindert Race-Condition
    if (tagUpdateInProgress) {
        toast.info('Bitte kurz warten.');
        return;
    }
    tagUpdateInProgress = true;

    try {
        const newTags = (currentActiveReport.tags || []).filter(t => t !== tag);
        await updateReport(currentActiveReportId, { tags: newTags });
        currentActiveReport.tags = newTags;
        renderReportTags();
        await displayReportsList();
        toast.info(`Tag "${tag}" entfernt.`);
    } catch (err) {
        console.error('Tag-Remove-Fehler:', err.name);
        toast.error('Tag konnte nicht entfernt werden.');
    } finally {
        tagUpdateInProgress = false;
    }
}

// Flag fuer Mutex (verhindert parallele Tag-Updates)
let tagUpdateInProgress = false;

/**
 * Zeigt die Vorschlagsliste fuer Tags an (vorhandene Tags).
 */
function renderTagSuggestions() {
    const query = (tagInput.value || '').toLowerCase();
    const allTags = getAllTags();
    const currentTags = currentActiveReport?.tags || [];
    const unused = allTags.filter(t => !currentTags.includes(t));
    const filtered = query ? unused.filter(t => t.toLowerCase().includes(query)) : unused.slice(0, 5);

    tagSuggestions.innerHTML = '';
    if (filtered.length === 0) {
        tagSuggestions.innerHTML = '<div class="tag-suggestion-empty">Keine Vorschlaege</div>';
        return;
    }

    filtered.forEach(tag => {
        const suggestion = document.createElement('div');
        suggestion.className = 'tag-suggestion';
        suggestion.textContent = tag;
        suggestion.addEventListener('click', () => {
            addTagToReport(tag);
            tagInput.value = '';
            hideTagInput();
        });
        tagSuggestions.appendChild(suggestion);
    });
}

/**
 * Zeigt das Tag-Eingabefeld.
 */
function showTagInput() {
    tagInputArea.classList.remove('hidden');
    tagInput.value = '';
    renderTagSuggestions();
    setTimeout(() => tagInput.focus(), 100);
}

/**
 * Versteckt das Tag-Eingabefeld.
 */
function hideTagInput() {
    tagInputArea.classList.add('hidden');
    tagSuggestions.innerHTML = '';
}

// Tag-Button klickt -> Eingabefeld oeffnen
addTagBtn.addEventListener('click', showTagInput);

// Tippen -> Vorschlaege filtern
tagInput.addEventListener('input', renderTagSuggestions);

// Enter -> neuen Tag hinzufuegen
tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const value = tagInput.value.trim();
        if (value) {
            addTagToReport(value);
            tagInput.value = '';
            hideTagInput();
        }
    } else if (e.key === 'Escape') {
        hideTagInput();
    }
});

// ============================================================
// ABSCHNITT 14: MODAL-HILFSFUNKTIONEN & EVENTS
// ============================================================

function showModal(m) { m.classList.remove('hidden'); }
function hideModal(m) { m.classList.add('hidden'); }

settingsBtn.addEventListener('click', async () => {
    showModal(settingsModal);
    await refreshApiKeyFields();
    updatePasswordStatus();
});
closeSettingsBtn.addEventListener('click', () => hideModal(settingsModal));
saveSettingsBtn.addEventListener('click', saveSettings);
closeDetailBtn.addEventListener('click', () => hideModal(detailModal));

// Klick auf Modal-Hintergrund schliesst das Modal (nicht aber das Unlock-Modal!)
[settingsModal, detailModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal(modal);
    });
});
