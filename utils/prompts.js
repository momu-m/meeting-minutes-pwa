// ============================================================
// PROMPTS — Vorlagen fuer die Protokoll-Erstellung
// ============================================================
// Diese Datei enthaelt die Anweisungen (Prompts) an die KI,
// wie das Protokoll aufgebaut sein soll.
//
// Es gibt 3 Vorlagen:
//   - "standard":  Zusammenfassung + Aufgaben
//   - "detailed":  Ausfuehrlich, mit Risiken
//   - "technical": Fokus auf technische Probleme
//
// Gemeinsam: Schweizer-Rechtschreibung-Hinweis an die KI.
// ============================================================

// Hinweis an die KI: Schweizer Rechtschreibung verwenden.
// Wird an alle Vorlagen angehaengt.
const SCHWEIZER_HINWEIS = `
Wichtig: Verwende ausschliesslich Schweizer Rechtschreibung.
Das bedeutet:
1. Schreibe immer 'ss' statt sz (kein scharfes S in der Schweiz!).
2. Verwende echte Umlaute: ae wird zu ä, oe zu ö, ue zu ü.
3. Keine Ersatzschreibweisen wie 'ae' oder 'ue'.`;

/**
 * Gibt den Prompt fuer die gewaehlte Vorlage zurueck.
 *
 * @param {string} template - "standard" | "detailed" | "technical"
 * @returns {string} Der fertige Prompt-Text fuer die KI
 */
export function getPromptForTemplate(template) {
    if (template === 'detailed') {
        return `Du bist ein professioneller Sekretaer fuer ein Technik-Team.
Transkribiere diese Tonaufnahme und erstelle ein ausfuehrliches Protokoll auf Deutsch.
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
[Was muss noch abgeklaert werden? Welche Risiken gibt es?]
${SCHWEIZER_HINWEIS}`;
    }

    if (template === 'technical') {
        return `Du bist ein erfahrener Systemtechniker und Protokollfuehrer.
Transkribiere die Tonaufnahme und erstelle ein technisches Protokoll.
Halte dich an folgende Struktur:

# Technischer Bericht: [Thema]
**Datum:** [Heutiges Datum]

## Technische Probleme / Diagnose
[Welche Maschinen oder Software haben Probleme? Was wurde beobachtet?]

## Loesungen und Massnahmen
[Wie werden die Probleme behoben?]

## Offene Aufgaben
[Wer muss welches Bauteil bestellen, austauschen oder pruefen? Bis wann?]
${SCHWEIZER_HINWEIS}`;
    }

    // Standard-Vorlage (wird auch beim Fallback verwendet)
    return `Du bist ein Protokoll-Assistent.
Transkribiere diese Tonaufnahme und erstelle eine uebersichtliche Zusammenfassung auf Deutsch.
Nutze diese Struktur:

# Protokoll: [Thema]
**Datum:** [Heutiges Datum]

## Wichtigste Punkte
[Zusammenfassung der wichtigsten Gespraechsinhalte]

## Aufgabenliste (To-Dos)
[Wer macht was bis wann]

## Naechste Termine
[Naechste Absprachen oder Deadlines]
${SCHWEIZER_HINWEIS}`;
}
