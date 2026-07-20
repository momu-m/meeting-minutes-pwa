# STATUS.md - Asetronics Meeting-Minuten AI

> Diese Datei wird nach jeder Session aktualisiert.
> Sie zeigt: Was ist live? Was ist in Arbeit? Was kommt als naechstes?

**Letzte Aktualisierung:** 2026-07-20
**Live-URL:** https://momu-m.github.io/meeting-minutes-pwa/
**Aktuelle Version:** v2.1 (Edit + DOCX in Arbeit)

---

## Live-Status

| Umgebung | URL | Status |
|---|---|---|
| Produktion (GitHub Pages) | https://momu-m.github.io/meeting-minutes-pwa/ | Live (v2.0) |
| Lokal (HTTPS-Testserver) | https://localhost:8443 | Verfuegbar auf Anforderung |
| Git-Repo | https://github.com/momu-m/meeting-minutes-pwa | Public |
| Backup-Tags | `v1.0-stable`, `v2.0` | Beide verfuegbar |

---

## Erledigt (Done)

### v2.0 - 19./20. Juli 2026
- [x] Multi-Provider-Architektur (7 KI-Anbieter)
- [x] AES-GCM Verschluesselung mit Master-Passwort
- [x] Security-Hardening (PBKDF2 600k, RAM-only Key, Firestore-Rules)
- [x] UI: Provider-Dropdown, Toast-System, Badges
- [x] Migration v1 -> v2 (alte Gemini-Keys verschluesselt uebernommen)
- [x] Live-Deployment auf GitHub Pages

### v1.0 - Vor dem Refactoring
- [x] Aufnahme + Audio-Import
- [x] Gemini 1-Stage-Integration
- [x] PDF-Export + Web Share API
- [x] Wake Lock + Hintergrund-Schutz
- [x] Firebase Firestore + anonyme Auth

---

## In Arbeit (v2.1)

| Feature | Status | Commit |
|---|---|---|
| Editierbare Protokolle | Offen | - |
| DOCX-Export | Offen | - |
| Audio-Wiedergabe im Detail | Offen | - |
| Suche/Filter | Offen | - |

---

## Backlog (v2.2+)

- [ ] To-Dos als eigene Ansicht (Kanban)
- [ ] Sprecher-Erkennung (Diarization)
- [ ] Login mit Google-Account statt anonym
- [ ] Firebase App Check
- [ ] Dark/Light-Mode-Umschalter
- [ ] Offline-Transkription lokal (whisper.cpp)

---

## Rollback-Anleitung

Falls etwas kaputt ist:

```bash
cd "/Users/momu/Asetronics_Projekte/70_Meeting-Minutes-PWA"
git checkout v1.0-stable     # Zurueck zu v1 (vor Refactoring)
# oder
git checkout v2.0            # Zurueck zu v2.0 (vor v2.1-Features)
git push origin main --force # Live-Version zuruecksetzen
```

---

## Test-Credentials (fuer Mohamad)

- Master-Passwort: selbst gewaehlt (mindestens 12 Zeichen)
- API-Keys: verschluesselt gespeichert im Browser
- Firebase: anonyme UID pro Geraet
