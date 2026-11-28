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

/** CSS-Klasse je Fahrt-Zuweisung — Zeilenfarbe der Einsatzstation, geteilt
 *  mit der Lotsen-Liste der Einsatzplanung (siehe dortige CSS-Definition
 *  in Einsatzstation.css). "" (Bereitschaft) bleibt ungefärbt. */
export const FAHRT_ZEILE_KLASSE: Record<string, string> = {
  MoFa: "fahrt-zeile--mofa",
  MiFa: "fahrt-zeile--mifa",
  AFA: "fahrt-zeile--afa",
};

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

/** Kürzeste Abrufzeit: 20 Minuten. Gerechnet wird überall in Stunden,
 *  deshalb als Drittelstunde — angezeigt wird sie in Minuten, weil "0,3"
 *  auf der Tafel niemand liest. */
export const ABRUF_20_MIN = 1 / 3;

/** true, wenn der Wert die 20-Minuten-Option ist (Fließkomma-Toleranz:
 *  1/3 lässt sich nicht exakt speichern). */
function ist20Min(stunden: number): boolean {
  return Math.abs(stunden - ABRUF_20_MIN) < 0.01;
}

/** Anzeige der Abrufzeit: undefined und 1,0 Std. (der Standardwert für die
 *  Berechnung) werden beide als leer dargestellt. */
export function formatAbrufzeit(stunden: number | undefined): string {
  if (stunden === undefined || stunden === 1) return "";
  if (ist20Min(stunden)) return "20 m";
  return stunden.toFixed(1).replace(".", ",");
}

/** Auswählbare Abrufzeiten (20 Min., danach 0,5er-Schritte); undefined =
 *  Standard 1,0 Std. Geteilt zwischen dem Lotsen-Formular und dem
 *  Quick-Edit der Einsatzstation, damit beide dieselben Werte anbieten. */
export const ABRUF_OPTIONEN = [undefined, ABRUF_20_MIN, 0.5, 1, 1.5, 2, 2.5] as const;

/** Beschriftung einer Abruf-Option im Auswahlfeld (dort wird auch der
 *  Standard 1,0 Std. ausgeschrieben — anders als in der Listenanzeige). */
export function formatAbrufOption(stunden: number | undefined): string {
  if (stunden === undefined) return "–";
  if (ist20Min(stunden)) return "20 min";
  return `${stunden.toFixed(1).replace(".", ",")} Std`;
}

/** Auswählbare Fahrt-Zuweisungen inkl. Bereitschaft ("") — Reihenfolge der
 *  Dropdowns in Formular und Quick-Edit. */
export const FAHRT_OPTIONEN: Fahrt[] = ["", "MoFa", "MiFa", "AFA"];

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

/**
 * Fügt einen neuen Lotsen in die Liste ein — Gegenstück zu verschiebeHinter,
 * nur für einen noch nicht enthaltenen Eintrag statt einen bestehenden.
 * nachIndex bezieht sich auf den ORIGINAL-Index aus der übergebenen Liste:
 * -1 = ganz an den Anfang, undefined = ans Ende, sonst direkt dahinter.
 */
export function fuegeLotseEin(lotsen: LotsenEintrag[], lotse: LotsenEintrag, nachIndex: number | undefined): LotsenEintrag[] {
  if (nachIndex === undefined) return [...lotsen, lotse];
  const liste = [...lotsen];
  liste.splice(nachIndex + 1, 0, lotse);
  return liste;
}

/** Neuer Lotse, Position "Am Ende": ans Ende der Liste, keine Fahrtzuordnung. */
export function positionAmEnde(): { nachIndex: number | undefined; fahrt: Fahrt } {
  return { nachIndex: undefined, fahrt: "" };
}

/**
 * Neuer Lotse, Position "Aus §30": wird KEIN Mitglied der aktuellen Fahrt,
 * sondern der erste Bereitschaftslotse direkt im Anschluss daran (daher
 * fahrt: "", nicht aktuelleFahrt). Ankerpunkt ist der letzte Lotse der
 * aktuellen Fahrt-Gruppe (sortiert); ist die Gruppe leer, der Anfang der
 * ganzen Liste — so zählt der neue Lotse in jedem Fall als erster
 * Bereitschaftslotse, nie als letzter.
 *
 * Stehen dort bereits ein oder mehrere frühere "Aus §30"-Einfügungen
 * (gleiches Muster: fahrt "" + Bemerkung exakt "Aus §30"), reiht sich der
 * neue Lotse dahinter ein — eine erneute Berechnung nach jeder Einfügung
 * läuft die bestehende Kette automatisch bis zu ihrem Ende durch, die
 * Einfüge-Reihenfolge bleibt dadurch erhalten (zuerst eingefügt = steht
 * vorn in der Warteschlange).
 */
export function positionAusParagraph30(
  lotsen: LotsenEintrag[],
  aktuelleFahrt: AktuelleFahrt,
): { nachIndex: number | undefined; fahrt: Fahrt } {
  const geordnet = sortiereUndNummeriere(lotsen, aktuelleFahrt);
  let ankerPos = -1;
  for (let i = 0; i < geordnet.length; i += 1) {
    if (geordnet[i].eintrag.fahrt === aktuelleFahrt) ankerPos = i;
  }
  let i = ankerPos + 1;
  while (i < geordnet.length && geordnet[i].eintrag.fahrt === "" && geordnet[i].eintrag.bemerkung === "Aus §30") {
    i += 1;
  }
  return { nachIndex: i > 0 ? geordnet[i - 1].index : -1, fahrt: "" };
}

/**
 * Neuer Lotse, Position "5. Mann": wird so eingefügt, dass er absolut
 * (über alle Fahrt-Gruppen hinweg) die 5. Position der Liste einnimmt.
 * Fahrtzuordnung entspricht der aktuellen Fahrt — außer der bisherige
 * Besetzer der 5. Position hat keine Fahrtzuordnung, dann ebenfalls keine.
 * Stehen noch keine 4 Lotsen in der Liste (Position 5 gibt es noch gar
 * nicht), wird wie bei "Am Ende" angehängt.
 */
export function positionFuenfterMann(
  lotsen: LotsenEintrag[],
  aktuelleFahrt: AktuelleFahrt,
): { nachIndex: number | undefined; fahrt: Fahrt } {
  const geordnet = sortiereUndNummeriere(lotsen, aktuelleFahrt);
  if (geordnet.length < 4) return { nachIndex: geordnet.at(-1)?.index, fahrt: "" };
  const vierter = geordnet[3];
  const bisherFuenfter = geordnet[4];
  const fahrt: Fahrt = bisherFuenfter && bisherFuenfter.eintrag.fahrt === "" ? "" : aktuelleFahrt;
  return { nachIndex: vierter.index, fahrt };
}
