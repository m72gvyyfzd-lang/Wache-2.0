/**
 * Potentielle V-Nrn der Einsatzstations-Lotsen: fortlaufend ab vNrStart,
 * aber Lotsen mit einer Zuweisung aus OHNE_V_NR_TYPEN bekommen keine — der
 * Zähler bleibt für sie stehen und geht an den nächsten Lotsen ohne diese
 * Restriktion (statt der V-Nr. zeigt die Einsatzplanung dann die Kurzform
 * des Job-Typs). Beim Abteilen vergebene Nummern sind dauerhaft verbraucht
 * (siehe verbrauchteVNrn) und werden übersprungen — auch wenn sich die vNr
 * einer Abteilung später ändert (z.B. durch Verschieben auf der Seestation)
 * oder rückgängig gemacht wird, wird die Nummer nicht wieder frei.
 *
 * Gemeinsame Grundlage für die V-Nr.-Spalte der Einsatzplanung und die
 * Einsortierung der Vorschau-Lotsen in der Seestation — beide müssen
 * dieselben Nummern zeigen.
 */
import type { LotsenEintrag } from "../data/types";
import { istOhneVNrJob, vonTypeLabel, type EintragMitAbteilzeit } from "./coreJob";
import type { LotseMitOrdnung } from "./lotsenOrdnung";

export interface VNrPlanung {
  /** Lotse -> potentielle V-Nr. (in Listenreihenfolge vergeben) */
  vNrProLotse: Map<LotsenEintrag, number>;
  /** Lotse -> Job-Typ-Kurzform statt V-Nr. (Vergabe-Typen) */
  typProLotse: Map<LotsenEintrag, string>;
  /** nächste noch nicht verplante Nummer (Fallback beim Abteilen) */
  naechsteFreieVNr: number;
}

export function berechnePotentielleVNrn(
  jobsSortiert: EintragMitAbteilzeit[],
  lotsenSortiert: LotseMitOrdnung[],
  zuweisungen: Map<number, LotsenEintrag[]>,
  vNrStart: number,
  verbrauchteVNrn: number[],
): VNrPlanung {
  const ohneVNr = new Set<LotsenEintrag>();
  const typProLotse = new Map<LotsenEintrag, string>();
  for (const { eintrag: job } of jobsSortiert) {
    if (istOhneVNrJob(job)) {
      for (const l of zuweisungen.get(job.id) ?? []) {
        ohneVNr.add(l);
        typProLotse.set(l, vonTypeLabel(job));
      }
    }
  }
  const vergebeneVNrn = new Set(verbrauchteVNrn);
  const vNrProLotse = new Map<LotsenEintrag, number>();
  let naechsteVNr = vNrStart;
  for (const { eintrag } of lotsenSortiert) {
    if (ohneVNr.has(eintrag)) continue;
    while (vergebeneVNrn.has(naechsteVNr)) naechsteVNr += 1;
    vNrProLotse.set(eintrag, naechsteVNr);
    naechsteVNr += 1;
  }
  while (vergebeneVNrn.has(naechsteVNr)) naechsteVNr += 1;
  return { vNrProLotse, typProLotse, naechsteFreieVNr: naechsteVNr };
}
