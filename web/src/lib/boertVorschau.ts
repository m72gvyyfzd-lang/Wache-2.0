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
 * Der bestätigte Zustand ist eine reine Ableitung aus drei Eingaben: den
 * Kandidaten, der Zielanzahl (Fahrtanforderung) und zwei User-Overrides
 * (forciert rein / forciert raus). Das macht "abwählen → nächster rutscht
 * nach" zu einer einfachen Neuberechnung statt einer eigenen Nachrück-Logik.
 */
import type { AktuelleFahrt, LotsenEintrag } from "../data/types";
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

/**
 * Leitet die Menge der bestätigten Kandidaten-IDs ab: erst die forciert
 * hinzugefügten (zählen immer, unabhängig von Position/Zielanzahl), dann
 * ab der Grenze der Reihe nach auffüllen bis zur Zielanzahl — forciert
 * abgewählte werden dabei übersprungen. Wird ein Kandidat abgewählt
 * (forciertRaus), rückt bei der nächsten Berechnung automatisch der
 * nächste in der Reihe nach — "Nachrücken" ist damit kein Sonderfall,
 * sondern folgt allein aus der Neuberechnung dieser reinen Funktion.
 */
export function berechneBestaetigt(
  kandidaten: KandidatZeile[],
  grenze: number,
  zielAnzahl: number,
  forciertRein: ReadonlySet<string>,
  forciertRaus: ReadonlySet<string>,
): Set<string> {
  const ergebnis = new Set<string>(forciertRein);
  for (let i = grenze; i < kandidaten.length && ergebnis.size < zielAnzahl; i += 1) {
    const id = kandidaten[i].id;
    if (forciertRaus.has(id) || ergebnis.has(id)) continue;
    ergebnis.add(id);
  }
  return ergebnis;
}
