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
 * Keine automatische Auffüll-/Nachrück-Logik: Häkchen setzen/entfernen
 * betrifft ausschließlich die angeklickte Zeile, nie eine andere. Die
 * Bestätigung ist reiner, direkt getoggelter Zustand (eine Menge von IDs).
 *
 * Durchgestrichen wird rein aus der aktuellen Bestätigung abgeleitet
 * (berechneDurchgestrichen) — jeder unbestätigte Kandidat, der POSITIONELL
 * zwischen dem ersten und dem letzten bestätigten Kandidaten liegt (nicht
 * an einer festen Anzahl/Fensterlänge festgemacht). Ändert sich die
 * Bestätigung, verschiebt sich diese Spanne automatisch mit — ohne eigenen
 * gespeicherten Zustand dafür.
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

/** Erst-Vorschlag für "Vorschau generieren": die ersten `anzahl` Kandidaten
 *  ab der Grenze — nur ein Startpunkt, danach rein manuell per Häkchen
 *  gepflegt (keine automatische Nachpflege). */
export function boertVorschlag(kandidaten: KandidatZeile[], grenze: number, anzahl: number): Set<string> {
  return new Set(kandidaten.slice(grenze, grenze + anzahl).map((z) => z.id));
}

/**
 * Durchgestrichen sind alle NICHT bestätigten Kandidaten, die positionell
 * zwischen dem ersten und dem letzten bestätigten Kandidaten liegen —
 * unabhängig von einer festen Anzahl. Ohne mindestens zwei bestätigte
 * Kandidaten gibt es keine Spanne und damit nichts Durchgestrichenes.
 */
export function berechneDurchgestrichen(kandidaten: KandidatZeile[], bestaetigt: ReadonlySet<string>): Set<string> {
  let erste = -1;
  let letzte = -1;
  for (let i = 0; i < kandidaten.length; i += 1) {
    if (!bestaetigt.has(kandidaten[i].id)) continue;
    if (erste === -1) erste = i;
    letzte = i;
  }
  const ergebnis = new Set<string>();
  for (let i = erste + 1; i < letzte; i += 1) {
    if (!bestaetigt.has(kandidaten[i].id)) ergebnis.add(kandidaten[i].id);
  }
  return ergebnis;
}

/**
 * Zeilenfarbe der Bört-Vorschau-Tabelle: rein visuelle Vorschau, ändert
 * nichts an der echten Fahrt-Zuweisung. Bestätigte Kandidaten zeigen die
 * Farbe der NÄCHSTEN Fahrt (Vorschau, wohin sie wechseln würden);
 * durchgestrichene (siehe berechneDurchgestrichen) zeigen "Bereitschaft"
 * (keine Farbe); alle anderen zeigen unverändert ihre eigene, echte
 * Fahrt-Farbe.
 */
export function vorschauFahrtKlasse(
  zeile: KandidatZeile,
  bestaetigt: ReadonlySet<string>,
  istDurchgestrichen: boolean,
  naechste: AktuelleFahrt,
): string {
  if (bestaetigt.has(zeile.id)) return FAHRT_ZEILE_KLASSE[naechste] ?? "";
  if (istDurchgestrichen) return "";
  const fahrt: Fahrt = zeile.art === "lotse" ? zeile.eintrag.fahrt : "";
  return FAHRT_ZEILE_KLASSE[fahrt] ?? "";
}
