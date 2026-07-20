# STATUS.md - Asetronics Meeting-Minuten AI

> Diese Datei wird nach jeder Session aktualisiert.
> Sie zeigt: Was ist live? Was ist in Arbeit? Was kommt als naechstes?

**Letzte Aktualisierung:** 2026-07-20
**Live-URL:** https://momu-m.github.io/meeting-minutes-pwa/
**Aktuelle Version:** v2.1.1 (produktionsklar)
**Backup-Tags:** `v1.0-stable`, `v2.0`, `v2.1`, `v2.1.1`

---

## Live-Status

| Umgebung | URL | Status |
|---|---|---|
| Produktion (GitHub Pages) | https://momu-m.github.io/meeting-minutes-pwa/ | LIVE v2.1.1 |
| Git-Repo | https://github.com/momu-m/meeting-minutes-pwa | Public |
| Audit-Status | Produktionsklar (P0 alle behoben) | Grun |

---

## Funktionsumfang v2.1.1 (live)

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
- PBKDF2 600.000 Iterationen (OWASP 2023)
- Master-Passwort mit Bestaetigung (min. 12 Zeichen)
- AES-Key NUR im RAM (XSS-Schutz, kein sessionStorage)
- Firestore-Rules: Default-Deny + Schema-Validierung + Groessenlimit
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
- Audio-Wiedergabe im Detail-Modal (IndexedDB)
- Audio-Download
- Suche/Filter in Berichts-Liste (Live-Suche)
- Toast-Notifications
- Teilen via Web Share API
- Zwischenablage-Kopie

### Technische Speicherung
- Protokolle: Firebase Firestore (Cloud, pro User isoliert)
- Audios: IndexedDB (lokal, bis zu GB gross)
- API-Keys: localStorage verschluesselt (AES-GCM)
- Settings: localStorage (Provider, Vorlage)

---

## Erledigt (Done)

### v2.1.1 - 20. Juli 2026 (Security-Fixes)
- [x] P0 #1: lastEdited-Feld in Firestore-Rules ergaenzt
- [x] P0 #2: SESSION_KEY ReferenceError in resetVault() behoben
- [x] P0 #3: DOCX dynamisch laden (CDN-Ausfall-Schutz)
- [x] P1 #5: jsdelivr/unpkg zu NEVER_CACHE im Service Worker

### v2.1 - 20. Juli 2026 (Features)
- [x] Editierbare Protokolle (Titel + Markdown-Inhalt)
- [x] DOCX-Export (Word-Datei)
- [x] Audio-Wiedergabe im Detail-Modal
- [x] Audio-Download als .m4a
- [x] Suche/Filter in Berichts-Liste (Live)
- [x] Live auf GitHub Pages deployed

### v2.0 - 19./20. Juli 2026 (Architektur)
- [x] Multi-Provider-Architektur (7 KI-Anbieter)
- [x] AES-GCM Verschluesselung mit Master-Passwort
- [x] Security-Hardening (PBKDF2 600k, RAM-only Key)
- [x] UI: Provider-Dropdown, Toast-System, Badges
- [x] Migration v1 -> v2
- [x] Live-Deployment auf GitHub Pages

---

## Backlog (v2.2+)

### Must
- [ ] Sprecher-Erkennung (Diarization) fuer Meetings mit mehreren Personen
- [ ] Login mit Google-Account statt anonym (Persistenz bei Geraetewechsel)
- [ ] Audio verschluesselt in IndexedDB (aktuell Klartext)

### Should
- [ ] To-Dos als eigene Ansicht (Kanban)
- [ ] Tags/Kategorien fuer Protokolle
- [ ] Sortierung (nach Datum, Titel, Provider)
- [ ] Dark/Light-Mode-Umschalter

### Could
- [ ] Firebase App Check (zusatzlicher Schutz)
- [ ] Offline-Transkription lokal (whisper.cpp via WebAssembly)
- [ ] Microsoft Teams Integration
- [ ] Multi-User Sharing (Protokolle mit Team teilen)

---

## Rollback-Anleitung

```bash
cd "/Users/momu/Asetronics_Projekte/70_Meeting-Minutes-PWA"

# Zurueck zu einer bestimmten Version:
git checkout v1.0-stable     # v1 (vor Multi-Provider)
git checkout v2.0            # v2.0 (Multi-Provider, ohne Edit/DOCX/Audio/Suche)
git checkout v2.1            # v2.1 (alle Features, mit kleinen P0-Bugs)
git checkout v2.1.1          # v2.1.1 (empfohlen - produktionsklar)

# Zurueck auf Live pushen:
git push origin main --force
```

---

## Test-Credentials

- Master-Passwort: selbst gewaehlt (mindestens 12 Zeichen)
- API-Keys: verschluesselt gespeichert, nur im RAM entschluesselt
- Firebase: anonyme UID pro Geraet
