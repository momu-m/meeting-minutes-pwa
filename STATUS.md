# STATUS.md - Asetronics Meeting-Minuten AI

> Diese Datei wird nach jeder Session aktualisiert.
> Sie zeigt: Was ist live? Was ist in Arbeit? Was kommt als naechstes?

**Letzte Aktualisierung:** 2026-07-20
**Live-URL:** https://momu-m.github.io/meeting-minutes-pwa/
**Aktuelle Version:** v2.2.1 (produktionsklar)
**Backup-Tags:** `v1.0-stable`, `v2.0`, `v2.1`, `v2.1.1`, `v2.2`, `v2.2.1`

---

## Live-Status

| Umgebung | URL | Status |
|---|---|---|
| Produktion (GitHub Pages) | https://momu-m.github.io/meeting-minutes-pwa/ | LIVE v2.2.1 |
| Git-Repo | https://github.com/momu-m/meeting-minutes-pwa | Public |
| Audit-Status | Produktionsklar (alle P0/P1 behoben) | Grun |

---

## Funktionsumfang v2.2.1 (live)

### KI-Anbieter (7 frei umschaltbar)
- Google Gemini (1-Stage, Audio direkt)
- OpenAI (Whisper + GPT-4o-mini)
- Anthropic Claude (Whisper + Claude)
- Ollama Cloud
- MiniMax
- GLM/ZhipuAI
- NVIDIA NIM

### Sicherheit
- AES-GCM 256 Verschluesselung aller API-Keys
- AES-GCM 256 Verschluesselung aller Audios (IndexedDB)
- PBKDF2 600.000 Iterationen (OWASP 2023)
- Master-Passwort mit Bestaetigung (min. 12 Zeichen)
- AES-Key NUR im RAM (XSS-Schutz)
- Firestore-Rules: Default-Deny + Schema-Validierung + Groessenlimits
- Native Blobs statt Base64 (Mobile-RAM-Schutz)
- Mutex bei Tag-Updates (Race-Condition-Schutz)
- Gemini API-Key im Header (nicht URL)
- Dynamischer DOCX-Import (CDN-Fehler isoliert)

### Features
- Audio-Aufnahme + Import
- Wake Lock (Bildschirm bleibt an)
- 3 Analyse-Vorlagen (Standard, Ausfuehrlich, Technisch)
- Schweizer Rechtschreibung (auto-korrigiert)
- Markdown-Rendering mit XSS-Schutz
- Editierbare Protokolle (Titel + Inhalt)
- PDF-Export (Browser-Druckdialog)
- DOCX-Export (echte Word-Datei)
- Audio-Wiedergabe im Detail-Modal (verschluesselt)
- Audio-Download
- Suche/Filter in Berichts-Liste (Live-Suche)
- Sortierung (Datum, Titel, Provider - 5 Modi)
- Tags/Kategorien fuer Protokolle
- Toast-Notifications
- Teilen via Web Share API
- Zwischenablage-Kopie

### Technische Speicherung
- Protokolle: Firebase Firestore (Cloud, pro User isoliert)
- Audios: IndexedDB (lokal, AES-GCM verschluesselt)
- API-Keys: localStorage verschluesselt (AES-GCM)
- Settings + Tag-Liste: localStorage (Klartext, nicht sensitiv)

---

## Erledigt (Done)

### v2.2.1 - 20. Juli 2026 (Security-Audit Fixes)
- [x] P0 #1: Base64-Konvertierung durch native Blobs ersetzt (Mobile-RAM-Crash verhindert)
- [x] P0 #2: Race-Condition bei Tag-Updates (Mutex eingefuehrt)
- [x] P0 #3: resetVault loescht jetzt auch Audio-DB (clearAllAudios)
- [x] P1 #4: Firestore-Rules fuer Tags typ-strenger (Strings < 50 Zeichen)

### v2.2 - 20. Juli 2026 (Features + Security)
- [x] Audio-Verschluesselung (AES-GCM in IndexedDB)
- [x] Tags/Kategorien fuer Protokolle
- [x] Sortierung der Berichts-Liste (5 Modi)

### v2.1.1 - 20. Juli 2026 (Security Fixes)
- [x] lastEdited in Firestore-Rules ergaenzt
- [x] SESSION_KEY ReferenceError in resetVault behoben
- [x] DOCX dynamisch laden
- [x] jsdelivr zu NEVER_CACHE hinzugefuegt

### v2.1 - 20. Juli 2026 (Features)
- [x] Editierbare Protokolle
- [x] DOCX-Export
- [x] Audio-Wiedergabe im Detail-Modal
- [x] Suche/Filter

### v2.0 - 19./20. Juli 2026 (Architektur)
- [x] Multi-Provider-Architektur (7 KI-Anbieter)
- [x] AES-GCM Verschluesselung mit Master-Passwort
- [x] Security-Hardening
- [x] Migration v1 -> v2
- [x] Live-Deployment auf GitHub Pages

---

## Backlog (v2.3+)

### Must (naechste Session)
- [ ] Sprecher-Erkennung (Diarization) fuer Meetings mit mehreren Personen
- [ ] Login mit Google-Account statt anonym (Persistenz bei Geraetewechsel)
- [ ] To-Dos als eigene Ansicht (Kanban)

### Should
- [ ] Firebase App Check
- [ ] Dark/Light-Mode-Umschalter
- [ ] Microsoft Teams Integration

### Could
- [ ] Offline-Transkription lokal (whisper.cpp via WASM)
- [ ] Multi-User Sharing (Protokolle mit Team teilen)

---

## Rollback-Anleitung

```bash
cd "/Users/momu/Asetronics_Projekte/70_Meeting-Minutes-PWA"

# Zurueck zu einer bestimmten Version:
git checkout v2.2.1          # Empfohlen - produktionsklar
git checkout v2.2            # Vor Performance-Fixes
git checkout v2.1.1          # Vor Audio-Verschluesselung/Tags/Sortierung
git checkout v2.0            # Multi-Provider, ohne Edit/DOCX/Audio/Suche

# Zurueck auf Live pushen:
git push origin main --force
```

---

## Test-Credentials

- Master-Passwort: selbst gewaehlt (mindestens 12 Zeichen)
- API-Keys: verschluesselt gespeichert, nur im RAM entschluesselt
- Firebase: anonyme UID pro Geraet
