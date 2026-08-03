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
}

/**
 * UI-Datentyp für die rohe Lotsenliste (was der Dispatcher auf der Tafel
 * sieht). Bewusst an das Schema aus tools/pdf-extraction angelehnt.
 */
export interface LotsenEintrag {
  positionHaupt: string;
  positionCuxhavenBoert: string;
  name: string;
  positionBrunsbuettelBoert: string;
  /** Lotsenkategorie als Text ("1"–"7", "3+"); "" = Volllotse */
  kategorie: string;
  bem: string;
}
