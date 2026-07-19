# Projekt-Memory: Meeting-Minuten AI v2.0

Dieses Dokument dient als Gedaechtnis fuer zukuenftige Chats. Es erklaert den aktuellen Stand, getroffene Entscheidungen und die naechsten Schritte fuer die App **Asetronics Meeting-Minuten AI**.

---

## 1. Projekt-Ziel (SMART)

Eine schnelle, private und **anbieterunabhaengige** PWA, mit der Mohamad Meeting-Audio aufnehmen, transkribieren und als strukturiertes Markdown-Protokoll speichern kann - auf iPhone, Mac oder anderen Geraeten.

Neu in v2.0: Die App unterstuetzt **7 verschiedene KI-Anbieter**, zwischen denen der Nutzer frei wechseln kann.

---

## 2. Architektur v2.0 (EVA-Prinzip)

### Eingabe (E)
- Mikrofon-Aufnahme direkt im Browser (MediaRecorder)
- Audio-Datei-Import (z.B. Sprachmemos vom iPhone/Apple Watch)
- Wake Lock: Bildschirm bleibt waehrend Aufnahme an
- Hintergrund-Schutz: Aufnahme geht bei Unterbrechung nicht verloren

### Verarbeitung (V)
- **Multi-Provider-System**: 7 KI-Anbieter, frei umschaltbar
- 1-Stage-Provider (Audio direkt): Gemini
- 2-Stage-Provider (Whisper + LLM): OpenAI, Anthropic, Ollama, MiniMax, GLM, NVIDIA
- Einheitliches Interface in `providers/base.js`

### Ausgabe (A)
- Markdown-Bericht mit Schweizer Rechtschreibung
- Speicherung in Firebase Firestore (pro User isoliert)
- PDF-Export (Browser-Druckdialog)
- Teilen via Web Share API (WhatsApp, Mail, AirDrop)
- Zwischenablage

---

## 3. KI-Anbieter (Provider)

| Provider | Datei | Stages | Auth | Bemerkung |
|---|---|---|---|---|
| Google Gemini | `providers/gemini.js` | 1 | API-Key | Standard, schnell, Audio direkt |
| OpenAI | `providers/openai.js` | 2 | API-Key | Whisper + GPT-4o-mini, präzise |
| Anthropic Claude | `providers/anthropic.js` | 2 | 2 Keys | Whisper + Claude, hochwertige Protokolle |
| Ollama Cloud | `providers/ollama.js` | 2 | Token/Key | https://signin.ollama.com |
| MiniMax | `providers/minimax.js` | 2 | Bearer | Chinesischer Anbieter |
| GLM/ZhipuAI | `providers/glm.js` | 2 | API-Key | glm-4-flash, kostenloses Kontingent |
| NVIDIA NIM | `providers/nvidia.js` | 2 | API-Key | Llama 3.1 70B |

Neue Provider hinzufuegen: in `providers/` neue Datei anlegen, in `providers/base.js` Registry aufnehmen.

---

## 4. Sicherheit (v2.0 - professionell)

### Master-Passwort & Verschluesselung
- **AES-GCM 256** fuer alle API-Keys
- **PBKDF2 mit 600.000 Iterationen** (OWASP 2023 Standard)
- Pro Passwort: frischer 128-Bit Salt
- Pro Verschluesselung: frischer 96-Bit IV
- Implementierung: `services/crypto.js` + `services/keyvault.js`

### Sicherheitsmerkmale
- Master-Passwort min. 12 Zeichen + Bestaetigungsfeld beim Setup
- AES-Key **nur im RAM** (nie sessionStorage/localStorage - XSS-Schutz)
- Bei App-Start: Passwort-Eingabe erforderlich
- Reset-Funktion bei vergessem Passwort (loescht alle Keys)

### API-Key-Schutz
- Gemini: Key im Header (`x-goog-api-key`), nicht in URL (Server-Log-Schutz)
- OpenAI-kompatibel: `Authorization: Bearer` Header
- Keys werden nur entschluesselt, wenn ein Provider sie braucht

### Firestore-Rules (scharf)
- Default-Deny: Alles verboten ausser explizit erlaubt
- Nur eigene User-Daten sichtbar (`request.auth.uid == userId`)
- Schema-Validierung: nur erlaubte Felder (id, title, date, content, provider, createdAt)
- Groessenbeschraenkung: Titel max 200 Zeichen, Content max 50KB
- Implementierung: `firestore.rules`

---

## 5. Dateistruktur v2.0

```
70_Meeting-Minutes-PWA/
├── index.html                # UI-Struktur (v2 mit Modals)
├── styles.css                # Dunkles Premium-Design + Toasts + Provider-Badges
├── print.css                 # PDF-Export-Layout
├── app.js                    # Haupt-Logik (UI-Koordination)
├── firebase-config.js        # Firebase-Initialisierung
├── manifest.json             # PWA-Manifest
├── sw.js                     # Service Worker v3 (Cache)
├── firestore.rules           # Sicherheitsregeln (Default-Deny + Schema)
├── firestore.indexes.json    # Index-Konfiguration
├── firebase.json             # Firebase-Konfiguration
├── providers/
│   ├── base.js               # Provider-Interface + Registry
│   ├── gemini.js             # 1-Stage
│   ├── openai.js             # 2-Stage
│   ├── anthropic.js          # 2-Stage
│   ├── ollama.js             # 2-Stage (Cloud)
│   ├── minimax.js            # 2-Stage
│   ├── glm.js                # 2-Stage
│   └── nvidia.js             # 2-Stage
├── services/
│   ├── crypto.js             # AES-GCM + PBKDF2
│   ├── keyvault.js           # Vault-Verwaltung (RAM-only Key)
│   ├── db.js                 # Firestore-Wrapper
│   └── notify.js             # Toast-Benachrichtigungen
├── utils/
│   ├── markdown.js           # Markdown-Parser (XSS-sicher)
│   ├── format.js             # Datum/Zeit/Dateigroesse-Formatierung
│   └── prompts.js            # Prompt-Vorlagen (3 Varianten)
├── icon-192.png, icon-512.png  # PWA-Icons
├── cert.pem, key.pem         # SSL-Zertifikat (lokal)
├── run_secure_server.py      # Lokaler HTTPS-Server
└── PROJECT_MEMORY.md         # Dieses Dokument
```

---

## 6. Migrations-Pfad v1 -> v2

Beim ersten Start nach dem Update:
1. App erkennt alten Gemini-Key in `localStorage["gemini_api_key"]`
2. Nutzer wird aufgefordert, ein Master-Passwort (mind. 12 Zeichen) einzurichten
3. Nach Bestaetigung: alter Key wird verschluesselt im Vault abgelegt
4. Alter Klartext-Key wird geloescht
5. Migrations-Flag `v2_migration_done` wird gesetzt

Bestehende Protokolle in Firestore bleiben voll lesbar (Schema ist abwaertskompatibel).

---

## 7. Build & Test

### Lokaler Test
```bash
cd "/Users/momu/Asetronics_Projekte/70_Meeting-Minutes-PWA"
python3 run_secure_server.py
# Mac:  https://localhost:8443
# iPhone (gleiches WLAN): https://<Mac-IP>:8443
```

### Audit-Ergebnisse (Stand 19. Juli 2026)
- 18 JS-Module: alle syntaktisch korrekt
- 12 Module per HTTP erreichbar
- Security-Review: P0 alle behoben
  - PBKDF2 auf 600k Iterationen erhoeht
  - AES-Key nicht mehr in sessionStorage (nur RAM)
  - Passwort-Bestaetigung beim Setup
  - Firestore-Rules mit Default-Deny + Schema-Validierung
  - Gemini API-Key im Header statt URL

---

## 8. Naechste Schritte (Backlog)

### Prioritaet: Must (naechste Sessions)
- [ ] Editierbare Protokolle (Markdown-Editor im Detail-Modal)
- [ ] DOCX-Export (zusatzlich zu PDF, fuer Word-Nutzer)
- [ ] Audio-Wiedergabe im Detail-Modal
- [ ] Suche & Filter in der Berichts-Liste

### Prioritaet: Should
- [ ] To-Dos als eigene Ansicht (Kanban-Style)
- [ ] Sprecher-Erkennung (Diarization) fuer Meetings mit mehreren Personen
- [ ] Login mit Google-Account statt anonym (Persistenz bei Geraetewechsel)
- [ ] Dark/Light-Mode-Umschalter

### Prioritaet: Could
- [ ] Firebase App Check (zusatzlicher Schutz)
- [ ] Offline-Transkription lokal (whisper.cpp via WebAssembly)
- [ ] Teams-Anbindung (Microsoft Graph)

---

## 9. Lessons Learned

- **Multi-Provider von Anfang an** haette vieles leichter gemacht. Jetzige Loesung ist aber sauber nachgetragen.
- **Sicherheit vs. Komfort**: Master-Passwort bei jedem Start nervt, ist aber fuer echte Sicherheit noetig. Reset-Funktion als Notausgang eingebaut.
- **2-Stage-Provider** brauchen 2 API-Calls - sind teurer als Gemini. User-Warnung beim Wechsel auf 2-Stage waere sinnvoll.

---

## 10. Git-Status

- Branch: `feature/multi-provider`
- Tag-Backup: `v1.0-stable` (Stand vor Refactoring)
- Zum Zurueckrollen: `git checkout v1.0-stable`

Stand: 19. Juli 2026
