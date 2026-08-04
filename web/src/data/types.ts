import type { AnmeldungsTyp } from "@wache/core";

/** Zu welcher der drei Job-Listen ein Eintrag fest gehört. Ein Job wird in
 *  der Liste bearbeitet, in der er angelegt wurde — kein Wechsel über eine
 *  "Art"-Auswahl. */
export type JobListe = "hamburg" | "nok" | "andere";

/**
 * UI-Datentyp für einen Job, wie ihn der Einsatzleiter pflegt. Für die
 * Abteilzeit-Berechnung wird er über lib/coreJob.ts in den Berechnungstyp
 * `Job` aus @wache/core übersetzt.
 */
export interface JobEintrag {
  /** interne, eindeutige Job-ID (persistenter Zähler, wird auch nach
   *  Löschungen nicht wiederverwendet). Wird nicht angezeigt — die
   *  Nr-Spalte der Listen ist die laufende Position nach Sortierung. */
  id: number;
  liste: JobListe;
  schiffsname?: string;
  bemerkung?: string;
  /** Schiffskategorie als Text (z.B. "3", "AGF 3/7") — siehe core::SCHIFFS_KATEGORIEN */
  kategorie?: string;

  // Liste Hamburg
  /** Bützfleth statt Hamburger Hafen: HH/FkW entfallen, stattdessen gepl. Abgang */
  buetzfleth?: boolean;
  hh?: Date;
  fkw?: Date;
  stade?: Date;
  geplAbgang?: Date;

  // Liste NOK
  holt?: Date;
  ticker?: Date;
  kuden?: Date;

  // Liste Andere Jobs
  typ?: AnmeldungsTyp;
  /** AG: verknüpfter Job (interne Job-ID) aus Hamburg/NOK */
  agJobId?: number;
  /** AG: Anzahl der AG-Lotsen */
  agLotsenAnzahl?: number;
  /** EHF: bestätigter Abgang; Abt.Zeit wird im Formular als Abgang − 1h vorbelegt */
  ehfBestAbgang?: Date;
  ehfLotseBenoetigt?: boolean;
  /** BHF: Besetz-Zeit */
  bhfBesetzZeit?: Date;

  /** Hamburg/NOK: manueller Override der berechneten Abteilzeit.
   *  Andere Jobs: die direkt eingegebene Abteilzeit. */
  abtZeitManuell?: Date;

  /** Override für die Anzahl benötigter Lotsen (Einsatzplanung, Spalte
   *  "Lots."). undefined = automatisch berechnet, siehe
   *  lib/coreJob.ts::benoetigteLotsenAnzahl. */
  lotsenAnzahl?: number;
}

/**
 * Fahrt-Zuweisung: 3x täglich wird aus den Lotsen mit Zuweisung "" (leer)
 * eine Bereitschafts-Gruppe für die Einsatzstation gebildet. Wer stattdessen
 * MoFa (06–12 Uhr), MiFa (12–18 Uhr) oder AFA (18–06 Uhr) zugewiesen ist,
 * fährt in dieser Fahrt und steht nicht für die Einsatzplanung zur
 * Verfügung. Die Zuteilung erfolgt vorerst manuell.
 */
export type Fahrt = "" | "MoFa" | "MiFa" | "AFA";

/** Die Fahrt, in der wir uns gerade befinden — gibt vor, in welcher
 *  Reihenfolge die Fahrt-Gruppen in der Einsatzstation-Liste einsortiert
 *  werden (siehe lib/lotsenOrdnung.ts). Global für die Wache, nicht je Lotse. */
export type AktuelleFahrt = "MoFa" | "MiFa" | "AFA";

/**
 * UI-Datentyp für die rohe Lotsenliste (was der Dispatcher auf der Tafel
 * sieht).
 *
 * "Fahrt #" (Laufnummer je Fahrt-Gruppe) und "BB" (Laufnummer innerhalb der
 * Gruppe mit fahrt === "") hängen an der Position in dieser Liste, nicht am
 * einzelnen Lotsen — sie werden nicht gespeichert, sondern von
 * lib/lotsenOrdnung.ts aus der Reihenfolge berechnet.
 */
export interface LotsenEintrag {
  name: string;
  /** Lotsenkategorie als Text ("1"–"7", "3+"); "" = Volllotse */
  kategorie: string;
  fahrt: Fahrt;
  /** Abrufzeit in Std. (0,5er-Schritte). undefined = Standard, zählt für die
   *  Berechnung als 1,0 Std. und wird in der Liste wie 1,0 als leer angezeigt. */
  abrufStunden?: number;
  /** EH = Elbehafen */
  elbehafen: boolean;
  /** Törn-Zähler 2+2 und 1+1 zusammen */
  toern2Plus2: number;
  toernWb: number;
  toernWr: number;
  toernHulo: number;
  bemerkung: string;

  /** "Lotsen abrufen" (Einsatzplanung): true, sobald der Lotse abgerufen
   *  wurde — steuert die fette Namensdarstellung und ob "gepl. Abruf" noch
   *  berechnet oder als "–" angezeigt wird. */
  abgerufen?: boolean;
  /** "An Stn.": tatsächlicher Zeitpunkt, wann der Lotse an der
   *  Einsatzstation sein wird — gesetzt durch "Lotsen abrufen" (jetzt +
   *  Abrufzeit) oder manuell nachträglich korrigiert. undefined = noch
   *  nicht abgerufen. */
  anStationZeit?: Date;
}
