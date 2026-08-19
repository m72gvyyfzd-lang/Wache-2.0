/**
 * Bört-Vorschau (Fahrt-Planung Phase 2): reine Vorschau, welche Lotsen aus
 * der Einsatzstations-Liste der NÄCHSTEN Fahrt zugeordnet werden sollen.
 * Nichts hiervon verändert echte Lotsen-Datensätze — alles lebt nur in
 * dieser Vorschau (localStorage), bis es an anderer Stelle übernommen wird.
 *
 * Kandidaten sind die bestehende, sortierte Lotsenliste (siehe
 * lotsenOrdnung.ts) plus manuell über "Einzufügen" ergänzte Platzhalter,
 * an einer gewählten Position eingefügt. Die "Grenze" markiert das Ende
 * der aktuellen Fahrt-Gruppe in dieser Reihenfolge — ab dort beginnt der
 * natürliche Vorschlag für die nächste Fahrt (analog zur WR-Gruppe der
 * Listenvergaben, siehe listenvergabe.ts).
 *
 * Das "Fenster" (boertFenster) ist der aktuell vorgeschlagene Bereich: die
 * ersten `fensterLaenge` Kandidaten ab der Grenze — rein positionsbasiert
 * (ein Ausschnitt der Kandidatenliste), nicht als Menge von IDs geführt.
 * Das macht zwei Automatiken zu einem einzeiligen Nebeneffekt statt einer
 * eigenen Nachrück-/Verdrängungs-Logik:
 * - Ablehnen (Häkchen weg bei einem Fenster-Mitglied): Fenster wird um 1
 *   länger — der dadurch neu ins Fenster rutschende Kandidat ist automatisch
 *   bestätigt (er steht nicht in "abgelehnt").
 * - Einfügen (neuer "Einzufügen"-Kandidat LANDET im Fenster): die Kandidaten
 *   ab da verschieben sich um 1 nach hinten — bei GLEICHBLEIBENDER
 *   Fensterlänge fällt der bisher letzte Fenster-Kandidat automatisch aus
 *   dem Fenster (ganz normale, unmarkierte Zeile — siehe boertFenster).
 * Häkchen AUSSERHALB des Fensters (manuelle Extra-Bestätigung) sind rein
 * additiv: sie zählen zur Bilanz, lösen aber nie ein automatisches
 * Nachrücken/Verdrängen aus und werden nie durchgestrichen dargestellt.
 */
import type { AktuelleFahrt, Fahrt, LotsenEintrag } from "../data/types";
import { FAHRT_ZEILE_KLASSE } from "./lotsenOrdnung";
import type { LotseMitOrdnung } from "./lotsenOrdnung";

export interface EinzufuegenEintrag {
  id: string;
  name: string;
  kategorie: string;
  bemerkung: string;
  /** Original-Index (aus `lotsen`) des Lotsen, HINTER dem der Eintrag in
   *  der Vorschau erscheinen soll; undefined = ans Ende der Liste. */
  nachIndex?: number;
}

export type KandidatZeile =
  | { art: "lotse"; id: string; index: number; eintrag: LotsenEintrag; fahrtNr?: number; bb?: number }
  | { art: "einfuegung"; id: string; eintrag: EinzufuegenEintrag };

/** Fügt die "Einzufügen"-Platzhalter an ihrer gewählten Position in die
 *  sortierte Lotsenliste ein. */
export function mergeKandidaten(geordnet: LotseMitOrdnung[], einfuegungen: EinzufuegenEintrag[]): KandidatZeile[] {
  const ergebnis: KandidatZeile[] = [];
  const nachIndexEinfuegen = (index: number) => {
    for (const e of einfuegungen) {
      if (e.nachIndex === index) ergebnis.push({ art: "einfuegung", id: `n${e.id}`, eintrag: e });
    }
  };
  for (const g of geordnet) {
    ergebnis.push({ art: "lotse", id: `l${g.index}`, index: g.index, eintrag: g.eintrag, fahrtNr: g.fahrtNr, bb: g.bb });
    nachIndexEinfuegen(g.index);
  }
  for (const e of einfuegungen) {
    if (e.nachIndex === undefined) ergebnis.push({ art: "einfuegung", id: `n${e.id}`, eintrag: e });
  }
  return ergebnis;
}

/** Index der ersten Zeile NACH der aktuellen Fahrt-Gruppe — ab hier beginnt
 *  der natürliche Kandidatenpool für die nächste Fahrt. */
export function boertGrenze(kandidaten: KandidatZeile[], aktuelleFahrt: AktuelleFahrt): number {
  let i = 0;
  while (i < kandidaten.length) {
    const zeile = kandidaten[i];
    if (zeile.art !== "lotse" || zeile.eintrag.fahrt !== aktuelleFahrt) break;
    i += 1;
  }
  return i;
}

/** Das aktuell vorgeschlagene Fenster: die ersten `fensterLaenge`
 *  Kandidaten ab der Grenze (Positions-Ausschnitt, keine ID-Menge — siehe
 *  Modulkommentar für die Konsequenzen bei Ablehnen/Einfügen). */
export function boertFenster(kandidaten: KandidatZeile[], grenze: number, fensterLaenge: number): KandidatZeile[] {
  return kandidaten.slice(grenze, grenze + fensterLaenge);
}

/**
 * Leitet die Menge der bestätigten Kandidaten-IDs ab: alle Fenster-
 * Mitglieder außer den abgelehnten, plus die manuellen Extra-Bestätigungen
 * außerhalb des Fensters.
 */
export function berechneBestaetigt(
  fenster: KandidatZeile[],
  abgelehnt: ReadonlySet<string>,
  manuelleExtras: ReadonlySet<string>,
): Set<string> {
  const ergebnis = new Set<string>(manuelleExtras);
  for (const zeile of fenster) {
    if (!abgelehnt.has(zeile.id)) ergebnis.add(zeile.id);
  }
  return ergebnis;
}

/**
 * Zeilenfarbe der Bört-Vorschau-Tabelle: rein visuelle Vorschau, ändert
 * nichts an der echten Fahrt-Zuweisung. Bestätigte Kandidaten zeigen die
 * Farbe der NÄCHSTEN Fahrt (Vorschau, wohin sie wechseln würden);
 * abgelehnte Fenster-Mitglieder zeigen "Bereitschaft" (keine Farbe, das
 * Fahrt-Feld würde dort zurückgesetzt); alle anderen zeigen unverändert
 * ihre eigene, echte Fahrt-Farbe.
 */
export function vorschauFahrtKlasse(
  zeile: KandidatZeile,
  bestaetigt: ReadonlySet<string>,
  istAbgelehntImFenster: boolean,
  naechste: AktuelleFahrt,
): string {
  if (bestaetigt.has(zeile.id)) return FAHRT_ZEILE_KLASSE[naechste] ?? "";
  if (istAbgelehntImFenster) return "";
  const fahrt: Fahrt = zeile.art === "lotse" ? zeile.eintrag.fahrt : "";
  return FAHRT_ZEILE_KLASSE[fahrt] ?? "";
}
