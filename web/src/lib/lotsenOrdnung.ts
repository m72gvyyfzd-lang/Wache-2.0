/** Berechnet die beiden Laufnummern der Lotsenliste, die an der Position in
 *  der Liste hängen statt am einzelnen Lotsen: "Fahrt #" je Fahrt-Gruppe und
 *  "BB" innerhalb der Gruppe mit fahrt === "" (die Bereitschafts-Lotsen an
 *  der Einsatzstation).
 *
 *  Gruppenreihenfolge rotiert mit der "aktuellen Fahrt": die laufende Fahrt
 *  kommt zuerst, danach die nächsten im Zyklus MoFa → MiFa → AFA → MoFa …
 *  "" (Bereitschaft) steht immer ganz hinten. Beispiel: aktuelle Fahrt AFA
 *  → Reihenfolge AFA, MoFa, MiFa, "" — ein neu auf MoFa gesetzter Lotse
 *  sortiert damit direkt hinter die letzten AFA-Einträge.
 *  Innerhalb einer Gruppe bleibt die bestehende Listenreihenfolge erhalten. */
import type { AktuelleFahrt, Fahrt, LotsenEintrag } from "../data/types";

const ZYKLUS: AktuelleFahrt[] = ["MoFa", "MiFa", "AFA"];

function fahrtRang(fahrt: Fahrt, aktuelleFahrt: AktuelleFahrt): number {
  if (fahrt === "") return ZYKLUS.length + 1;
  const start = ZYKLUS.indexOf(aktuelleFahrt);
  const ziel = ZYKLUS.indexOf(fahrt);
  return ((ziel - start + ZYKLUS.length) % ZYKLUS.length) + 1;
}

export interface LotseMitOrdnung {
  eintrag: LotsenEintrag;
  /** ursprünglicher Index in der Liste — stabiler Bezug für Bearbeiten/Löschen */
  index: number;
  /** Fahrt # innerhalb der Fahrt-Gruppe (MoFa/MiFa/AFA); undefined bei fahrt === "" */
  fahrtNr?: number;
  /** BB innerhalb der Gruppe fahrt === ""; undefined sonst */
  bb?: number;
}

export function sortiereUndNummeriere(lotsen: LotsenEintrag[], aktuelleFahrt: AktuelleFahrt): LotseMitOrdnung[] {
  // Abgeteilte Lotsen sind aus allen Listen ausgeblendet — der index bleibt
  // trotzdem der Original-Index der vollen Liste (für Bearbeiten/Löschen).
  const indiziert = lotsen.map((eintrag, index) => ({ eintrag, index })).filter(({ eintrag }) => !eintrag.abgeteilt);
  const sortiert = [...indiziert].sort((a, b) => {
    const rang = fahrtRang(a.eintrag.fahrt, aktuelleFahrt) - fahrtRang(b.eintrag.fahrt, aktuelleFahrt);
    return rang !== 0 ? rang : a.index - b.index;
  });

  const zaehler: Record<AktuelleFahrt, number> = { MoFa: 0, MiFa: 0, AFA: 0 };
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

/**
 * "Tauschen": Lotse A (indexA) und Lotse B (indexB) tauschen ihre Position
 * in der Liste — A landet an B's altem Platz und übernimmt dabei B's alten
 * Fahrt-Wert, B landet an A's altem Platz und übernimmt A's alten Fahrt-Wert.
 * Alle übrigen Felder (Name, Kat., Zähler, ...) bleiben an der jeweiligen
 * Person hängen.
 */
export function tauschePositionen(lotsen: LotsenEintrag[], indexA: number, indexB: number): LotsenEintrag[] {
  const liste = [...lotsen];
  const fahrtA = lotsen[indexA].fahrt;
  const fahrtB = lotsen[indexB].fahrt;
  liste[indexB] = { ...lotsen[indexA], fahrt: fahrtB };
  liste[indexA] = { ...lotsen[indexB], fahrt: fahrtA };
  return liste;
}

/**
 * "Verschieben": Der Lotse an quellIndex wird aus der Liste entfernt und
 * direkt hinter dem Lotsen an zielIndex wieder eingefügt — dabei übernimmt
 * er dessen Fahrt-Wert.
 */
export function verschiebeHinter(lotsen: LotsenEintrag[], quellIndex: number, zielIndex: number): LotsenEintrag[] {
  const liste = [...lotsen];
  const zielFahrt = lotsen[zielIndex].fahrt;
  const [bewegter] = liste.splice(quellIndex, 1);
  const zielNachEntfernen = zielIndex > quellIndex ? zielIndex - 1 : zielIndex;
  liste.splice(zielNachEntfernen + 1, 0, { ...bewegter, fahrt: zielFahrt });
  return liste;
}
