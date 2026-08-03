/** Berechnet die beiden Laufnummern der Lotsenliste, die an der Position in
 *  der Liste hängen statt am einzelnen Lotsen: "Fahrt #" je Fahrt-Gruppe und
 *  "BB" innerhalb der Gruppe mit fahrt === "" (die Bereitschafts-Lotsen an
 *  der Einsatzstation). Gruppenreihenfolge: MoFa vor MiFa vor AFA vor "" —
 *  innerhalb einer Gruppe bleibt die bestehende Listenreihenfolge erhalten. */
import type { Fahrt, LotsenEintrag } from "../data/types";

const FAHRT_RANG: Record<Fahrt, number> = { MoFa: 1, MiFa: 2, AFA: 3, "": 4 };

export interface LotseMitOrdnung {
  eintrag: LotsenEintrag;
  /** ursprünglicher Index in der Liste — stabiler Bezug für Bearbeiten/Löschen */
  index: number;
  /** Fahrt # innerhalb der Fahrt-Gruppe (MoFa/MiFa/AFA); undefined bei fahrt === "" */
  fahrtNr?: number;
  /** BB innerhalb der Gruppe fahrt === ""; undefined sonst */
  bb?: number;
}

export function sortiereUndNummeriere(lotsen: LotsenEintrag[]): LotseMitOrdnung[] {
  const indiziert = lotsen.map((eintrag, index) => ({ eintrag, index }));
  const sortiert = [...indiziert].sort((a, b) => {
    const rang = FAHRT_RANG[a.eintrag.fahrt] - FAHRT_RANG[b.eintrag.fahrt];
    return rang !== 0 ? rang : a.index - b.index;
  });

  const zaehler: Record<Exclude<Fahrt, "">, number> = { MoFa: 0, MiFa: 0, AFA: 0 };
  let bbZaehler = 0;

  return sortiert.map(({ eintrag, index }) => {
    if (eintrag.fahrt === "") {
      bbZaehler += 1;
      return { eintrag, index, bb: bbZaehler };
    }
    zaehler[eintrag.fahrt] += 1;
    return { eintrag, index, fahrtNr: zaehler[eintrag.fahrt] };
  });
}

/** Anzeige der Abrufzeit: undefined und 1,0 Std. (der Standardwert für die
 *  Berechnung) werden beide als leer dargestellt. */
export function formatAbrufzeit(stunden: number | undefined): string {
  if (stunden === undefined || stunden === 1) return "";
  return stunden.toFixed(1).replace(".", ",");
}
