import type { AnmeldungsTyp, Geschwindigkeitsklasse, SeeHerkunft } from "@wache/core";

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
  /** Geschwindigkeitsklasse für die Tiden-Matrizen (leer = "normal"):
   *  HH-Jobs → Brb-Abteilzeit + Brb>>SEE; NOK/EHF/BHF → nur Brb>>SEE.
   *  Siehe core::brbMatrix. */
  geschwindigkeitsklasse?: Geschwindigkeitsklasse;

  /** Bütz: Schiff bunkert geplant in Bützfleth — zählt dann trotz
   *  eingetragener Stade-Zeit nicht als "abgerufen" für Listenvergaben
   *  (siehe lib/listenvergabe.ts). Auch für NOK-Jobs (neben Kuden). */
  geplBunkern?: boolean;

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
  /** EHF-Wache: der abgeteilte Lotse ankert (bleibt auf dem Schiff) statt
   *  zur Seestation zu fahren — setzt beim Abteilen automatisch "Ankert"
   *  der entstehenden Abteilung (siehe lib/vorschau.ts, Versetzliste). */
  ehfWache?: boolean;
  /** BHF: Besetz-Zeit */
  bhfBesetzZeit?: Date;

  /** Hamburg/NOK: manueller Override der berechneten Abteilzeit.
   *  Andere Jobs: die direkt eingegebene Abteilzeit. */
  abtZeitManuell?: Date;
}

/** Vom Dispatcher eingegebenes HW-Paar Brunsbüttel (Settings). Solange
 *  HW_1 fehlt, rechnen HH-Jobs mit den festen Offsets statt der Matrix. */
export interface HwBrbEingabe {
  hw1?: Date;
  hw2?: Date;
}

/**
 * Fahrt-Zuweisung: MoFa (06–12 Uhr), MiFa (12–18 Uhr), AFA (18–06 Uhr)
 * oder "" (leer) = Bereitschaft an der Einsatzstation. Die Zuweisung
 * steuert die Reihenfolge der Lotsenliste (aktuelle Fahrt zuerst, dann der
 * Zyklus, Bereitschaft ganz hinten — siehe lib/lotsenOrdnung.ts); die
 * Planung Einsatzstation vergibt Jobs FIFO über die GESAMTE Liste in genau
 * dieser Reihenfolge. Die Zuteilung erfolgt vorerst manuell.
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

  /** true, sobald der Lotse einem Job "abgeteilt" wurde (siehe Abteilung).
   *  Der Datensatz bleibt erhalten, wird aber in Einsatzplanung und
   *  Einsatzstation ausgeblendet — Rückgängigmachen stellt alles wieder
   *  her. */
  abgeteilt?: boolean;
}

/**
 * "Abteilung": verbindet einen Job mit dem Lotsen, der ihn übernimmt.
 * Die Anzeige-Werte werden im Moment des Abteilens eingefroren
 * (insbesondere die sonst live berechnete V-Nr.), damit sich der Eintrag
 * auf der Versetzliste nachträglich nicht mehr verändert. Die
 * Originaldatensätze bleiben unangetastet und werden nur ausgeblendet.
 */
export interface Abteilung {
  /** eigene fortlaufende ID (unabhängig von der Job-ID) */
  id: number;
  /** interne ID des Jobs — für AG-Restzählung und Rückgängig */
  jobId: number;
  /** V-Nr. des Lotsen im Moment des Abteilens; undefined = Vergabe-Liste */
  vNr?: number;
  /** Kurzform der Von/Type-Spalte (SoRa, NeRa, HH, NOK, ...) */
  typLabel: string;
  schiffsname?: string;
  lotsenName: string;
  lotsenKategorie: string;
  elbehafen: boolean;
  /** Zeitpunkt des Abteilens (Klickzeit) */
  abteilZeit: Date;
  /** manueller Override für "Ankunft S-Stn"/"ETA Stn" (Standard-Berechnung:
   *  Brb>>SEE-Matrix bzw. Abteilzeit + 3,5 Std. als Fallback) */
  etaStnManuell?: Date;
  /** Herkunft für die Brb>>SEE-Matrix (HH +15 / NOK +20 / VNR +40 min bis
   *  Abfahrt Tn_59), beim Abteilen eingefroren. undefined = pauschale
   *  Anfahrt (z.B. Tender-AG, verwaiste AG, alte Datensätze). */
  seeHerkunft?: SeeHerkunft;
  /** Geschwindigkeitsklasse des Schiffs für die Brb>>SEE-Matrix, beim
   *  Abteilen eingefroren (leer = "normal"). */
  geschwindigkeitsklasse?: Geschwindigkeitsklasse;
  /** true, sobald der Lotse auf der Seestation angekommen ist ("Auf
   *  Station") — er verschwindet dann aus "Lotsen im Revier" und wird auf
   *  der Seestation fett dargestellt. */
  aufSeestation?: boolean;
  /** true, sobald der Lotse auf der Seestation "abgeschöpft" wurde — er
   *  verschwindet dann auch aus "Auf Seestation". Der Datensatz bleibt
   *  (wie abgeteilt/aufSeestation) erhalten, u.a. damit die AG-Restzählung
   *  und die Job-Ausblendung in Tafel Brb korrekt bleiben. */
  abgeschoepft?: boolean;
  /** true, solange der Lotse "ankert" — er kommt dann nicht an der
   *  Seestation an und wird aus "Auf Seestation" ausgeblendet. Reversibel:
   *  beim Zurückschalten erscheint er dort wieder mit seiner V-Nr. */
  ankert?: boolean;
  /** true, sobald der Lotse per Seestation-Abteilen einem See-Schiff
   *  zugewiesen wurde (siehe SeeAbteilung) — er verschwindet dann aus
   *  "Auf Seestation", der Datensatz bleibt erhalten. */
  seeAbgeteilt?: boolean;
}

/**
 * Schiff, das von See kommend an der Seestation mit Lotsen besetzt werden
 * muss (Liste "ETAs Seestation"). Eigenständige Datensätze, unabhängig von
 * den Jobs der Tafel Brb.
 */
export interface SeeSchiff {
  id: number;
  schiffsname: string;
  /** geplante Ankunftszeit an der Seestation */
  eta: Date;
  /** Schiffskategorie (siehe core::SCHIFFS_KATEGORIEN) */
  kategorie?: string;
  /** Zeile fett, wenn das Schiff angemeldet ist */
  angemeldet?: boolean;
  /** ETA-Zelle dezent rot */
  e3st?: boolean;
  /** Doppeldecker: braucht 2 Lotsen statt 1 */
  doppeldecker?: boolean;
  /** EHF-Lotse benötigt — gleiche Regel wie bei Jobs (ab Kat. 4 nur EH) */
  ehfLotseBenoetigt?: boolean;
}

/**
 * Manuell auf der Seestation hinzugefügter Lotse — existiert nur auf der
 * Liste "Auf Seestation", nicht in der Einsatzstation o.ä. Die V-Nr. wird
 * mit einem Zusatz (A–D) zwischen die bestehenden Nummern einsortiert,
 * z.B. 101 → 101 (A) → 101 (B) → 102.
 */
export interface SeestationLotse {
  id: number;
  vNr: number;
  /** Buchstaben-Zusatz beim manuellen Einfügen zwischen bestehende Nummern;
   *  per Wachbeginn-Import übernommene Lotsen haben meist keinen. */
  zusatz?: "A" | "B" | "C" | "D";
  name: string;
  /** Lotsenkategorie (siehe core::LOTSEN_KATEGORIEN) */
  kategorie: string;
  elbehafen: boolean;
  /** ETA Stn (Pflichtangabe beim Einfügen) */
  etaStn?: Date;
  /** true = vor Ort auf der Seestation */
  aufStation?: boolean;
  /** true, sobald der Lotse auf der Seestation "abgeschöpft" wurde — er
   *  verschwindet dann aus "Auf Seestation" und erscheint stattdessen auf
   *  der Liste "Abgeschöpfte Lotsen" (Tab Versetzliste Seestation). Der
   *  Datensatz bleibt erhalten (kein Löschen), damit er über die
   *  Rückgängig-Funktion wiederhergestellt werden kann. */
  abgeschoepft?: boolean;
  /** true, sobald der Lotse per Seestation-Abteilen einem See-Schiff
   *  zugewiesen wurde (siehe SeeAbteilung) — er verschwindet dann aus
   *  "Auf Seestation", der Datensatz bleibt erhalten. */
  seeAbgeteilt?: boolean;
}

/**
 * "SeeAbteilung": verbindet ein See-Schiff (Liste "ETA Seestation") mit dem
 * Lotsen der Seestation, der es übernimmt — das Gegenstück zu Abteilung,
 * nur für die Seestation. Erzeugt einen Eintrag auf der Liste "Versetz auf
 * Seestation" (Tab Versetzliste Seestation) mit eigener, fortlaufender
 * A-Nr. (nie wiederverwendet, unabhängig von der V-Nr.-Zählung). Der
 * Quell-Lotse (Abteilung oder SeestationLotse) wird nur ausgeblendet
 * (seeAbgeteilt), nicht gelöscht — Rückgängig macht beides sichtbar.
 */
export interface SeeAbteilung {
  /** eigene fortlaufende ID */
  id: number;
  seeSchiffId: number;
  schiffsname: string;
  /** A-Nr. im Moment des Abteilens, fortlaufend ab 1000 */
  aNr: number;
  /** woher der Lotse stammt — für Rückgängig */
  lotsenQuelle: "abteilung" | "manuell";
  /** ID des Quell-Datensatzes (Abteilung.id bzw. SeestationLotse.id) */
  lotsenId: number;
  lotsenName: string;
  lotsenKategorie: string;
  elbehafen: boolean;
  /** Zeitpunkt des Abteilens (Klickzeit) */
  abteilZeit: Date;
}
