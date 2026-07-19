# Projekt-Memory: Meeting-Minuten PWA

Dieses Dokument dient als Gedaechtnis fuer zukuenftige Chats. Es erklaert den aktuellen Stand, getroffene Entscheidungen und die naechsten Schritte fuer die App **Asetronics Meeting-Minuten AI**.

---

## 1. Projekt-Ziel (SMART)
Einrichtung einer schnellen, kostenlosen und privaten Loesung zur Transkription und Strukturierung von Sitzungen direkt auf Mohamads iPhone und Apple Watch bis zum 20. Juli 2026.

## 2. Architektur & Konzept (EVA-Prinzip)
Die Loesung laeuft komplett clientseitig als **Progressive Web App (PWA)** auf dem iPhone:

- **Eingabe (E):** Mikrofon-Aufnahme direkt im Safari-Browser des iPhones/Macs. Alternativ: Import einer Audio-Datei (z.B. Sprachmemo von iPhone oder Apple Watch).
- **Verarbeitung (V):** Umwandlung der Audio-Datei in Base64 direkt in JavaScript. Senden des Audios an die Google Gemini-API (`gemini-1.5-flash`), welche die Transkription und Strukturierung in einem einzigen schnellen Schritt erledigt.
- **Ausgabe (A):** Anzeige des Markdown-Berichts auf dem iPhone. Lokale Speicherung der Berichte und Aufgaben in der Browser-Datenbank (`IndexedDB`).

---

## 3. Getroffene Entscheidungen

- **Client-Side-First:** Kein eigener Server noetig. Das spart Ressourcen, erhoeht die Geschwindigkeit und vermeidet Verbindungsprobleme.
- **API-Key Sicherheit:** Der Gemini API-Schluessel wird lokal im Browser (`localStorage`) gespeichert und nie an Dritte uebertragen.
- **HTTPS-Anforderung:** Da iOS den Mikrofon-Zugriff im Browser nur ueber HTTPS erlaubt, wurde ein lokaler HTTPS-Server mit selbstsigniertem Zertifikat fuer Tests erstellt. Im Produktivbetrieb soll die App auf **GitHub Pages** (kostenlos mit HTTPS) hochgeladen werden.
- **Schweizer Rechtschreibung:** Ein programmatisches Sicherheitsnetz in der App korrigiert verbliebene "ss" automatisch zu "ss".

---

## 4. Bisherige Arbeiten

### Phase 1 (18. Juli 2026)
1. **index.html:** Benutzeroberflaeche mit Aufnahme-Timer, Einstellungs-Menue, Berichtsliste und Detailansicht.
2. **styles.css:** Dunkles Premium-Design mit Outfit-Schriftart, Glassmorphismus-Karten und Aufnahme-Puls-Animation.
3. **app.js:** Steuerung des `MediaRecorder`, Konvertierung in Base64, fetch-Aufruf an Gemini, IndexedDB-Schnittstelle und einfacher Markdown-Parser.
4. **manifest.json & sw.js:** PWA-Konfiguration fuer die Installation auf dem iPhone-Homescreen und Offline-Caching.
5. **App-Icons:** Icons in 192x192 und 512x512 Pixeln generiert und im Projektordner gespeichert.
6. **run_secure_server.py:** Python-Skript zur lokalen Bereitstellung der App ueber sicheres HTTPS (`https://localhost:8443`).

### Phase 2 (19. Juli 2026)
7. **Wake Lock API:** Bildschirm bleibt waehrend der Aufnahme aktiv (wird nicht dunkel). Verhindert, dass iOS das Mikrofon stoppt.
8. **Robuste Aufnahme:** Wenn die Aufnahme unterbrochen wird (z.B. iOS stoppt das Mikrofon), wird das bisher aufgenommene Audio trotzdem verarbeitet -- nichts geht verloren.
9. **Hintergrund-Schutz:** `visibilitychange`-Event (Wake Lock erneuern bei Rueckkehr), `beforeunload`-Warnung bei offener Aufnahme, `onerror`-Handler am MediaRecorder.
10. **Audio-Datei-Import:** Neuer Button "Audio-Datei importieren" zum Hochladen von Sprachmemos (z.B. von der iPhone Sprachmemos-App oder Apple Watch). Akzeptiert alle Audio-Formate bis 20 MB.
11. **Hinweis-Banner:** Waehrend der Aufnahme wird ein kleiner Hinweis angezeigt: "Bildschirm bleibt an waehrend der Aufnahme".
12. **Service Worker v2:** Cache-Version erhoeht, damit Browser die neuen Dateien laden.

---

## 5. Dateistruktur

| Datei | Zweck |
|---|---|
| `index.html` | HTML-Struktur der App (UI) |
| `styles.css` | Dunkles Premium-Design (CSS) |
| `app.js` | Gesamte App-Logik (JS) |
| `manifest.json` | PWA-Manifest (Name, Icons, Display) |
| `sw.js` | Service Worker (Offline-Cache) |
| `icon-192.png` | App-Icon 192x192 |
| `icon-512.png` | App-Icon 512x512 |
| `cert.pem / key.pem` | SSL-Zertifikat fuer lokales HTTPS |
| `run_secure_server.py` | Lokaler HTTPS-Server |
| `PROJECT_MEMORY.md` | Dieses Dokument |

---

## 6. Status & Naechste Schritte (Stand: 19. Juli 2026)

- **Lokaler Testlauf:** Den sicheren HTTPS-Server starten mit `python3 run_secure_server.py` (Port 8443).
- **Aufrufen auf Geraeten:**
  - Auf dem Mac: `https://localhost:8443`
  - Auf dem iPhone (im selben WLAN/Tailscale): `https://<Mac-IP>:8443`
- **Naechste Aufgaben:**
  1. Den Link auf dem iPhone in Safari oeffnen und die Sicherheitswarnung ueberspringen.
  2. Den eigenen Google Gemini API-Schluessel in den App-Einstellungen eintragen.
  3. Eine Testaufnahme machen und pruefen, ob das Protokoll erstellt und gespeichert wird.
  4. Die App auf dem iPhone ueber das Teilen-Menue zum Home-Bildschirm hinzufuegen.
  5. Optional: Eine Sprachmemo hochladen und pruefen, ob der Import funktioniert.
  6. Spaeter: Deployment auf GitHub Pages fuer permanentes HTTPS.
