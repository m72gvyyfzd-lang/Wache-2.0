/**
 * Domänentypen für die Abteilzeit- und Anruf-Algorithmen.
 * Destilliert aus WachTool_V1.8.6.numbers (Blätter "MAIN" / "Settings").
 */

/** Bekannte Routentypen, die eine automatische Abteilzeit-Berechnung auslösen.
 *  Alles andere (z.B. "AG", "2+2", "1+1", "EHF (LNG)") läuft rein manuell. */
export type Routentyp = "NOK" | "HH" | "BÜTZ" | (string & {});

export interface Job {
  jobNr: number;
  routentyp: Routentyp;
  /** Anzeige-Bezeichnung (Schiffsname, oder bei Anmeldungen der Typ wie
   *  "Radar"/"EHF"). Rein informativ, fließt in keine Berechnung ein. */
  bezeichnung?: string;
  /** Freitext-Bemerkung. Rein informativ, fließt in keine Berechnung ein. */
  bemerkung?: string;
  /** Spalte E: Kategorie des Jobs. Zahl (1–8) für reguläre Lotsenkategorien,
   *  oder Text (z.B. "AGF3/7") für Sonderkategorien, die die Kat.-Prüfung
   *  nicht auslösen. */
  kategorie?: number | string;

  /** Spalte F: HH-Hafen verlassen (Route HH) bzw. Holtenau-Ausfahrt (Route NOK) */
  hhHoltenau?: Date;
  /** Spalte G: Finkenwerder-Passage/Ticker-Abgang (HH/BÜTZ) bzw. bereits geschätzte
   *  Abteilzeit (NOK) — für NOK gibt es keinen Offset-Aufschlag mehr, der Wert wird
   *  direkt übernommen. */
  fkwTickerAbgang?: Date;
  /** Spalte H: Stade-Passage (HH/BÜTZ) bzw. Kuden-Passage (NOK) */
  stadeKuden?: Date;
  /** Spalte I: manueller Override, sticht immer alles andere aus */
  abteilungManuell?: Date;

  /** Geschwindigkeitsklasse für die matrixbasierte Brb-Prognose (HH-Jobs).
   *  Leer = "normal". Siehe brbMatrix.ts / brbMatrixDaten.ts. */
  geschwindigkeitsklasse?: import("./brbMatrixDaten").Geschwindigkeitsklasse;
}

export interface Lotse {
  name: string;
  /** Spalte B/C: zugeordnete Job-Nr. (Standard: Reihenfolge, per "Alt." überschreibbar) */
  jobNr?: number;
  /** Spalte F (AZ): individueller Vorlauf in Dezimalstunden, z.B. 1.5 = 1h30. Leer = 1h. */
  vorlaufStunden?: number;
  /** Spalte E: eigene Kategorie (1–8). Leer = 8 (uneingeschränkt qualifiziert). */
  eigeneKategorie?: number;
  /** Spalte G: EHF/LNG-Qualifikation */
  ehfQualifiziert: boolean;
  /** Spalte K: Dispatcher hat tatsächlich angerufen */
  abgerufen: boolean;
}

export interface Zeitoffset {
  stunden: number;
  minuten: number;
}

export type TideModus = "Flut" | "Ebbe" | "Wechsel Tide";

export interface AbteilzeitSettings {
  /** Kuden → Abteilung, fest, nicht tideabhängig (Settings::B3/C3) */
  kudenAbteilung: Zeitoffset;
  /** HH → Abteilung, tideabhängig (Settings::B4/C4) */
  hhAbteilung: Zeitoffset;
  /** FkW → Abteilung, tideabhängig (Settings::B5/C5) */
  fkwAbteilung: Zeitoffset;
  /** Stade → Abteilung, tideabhängig (Settings::B6/C6) */
  stadeAbteilung: Zeitoffset;
  /** fester Zuschlag im BÜTZ-Fallback über FkW/Ticker (Settings-Formel: fest 29min) */
  buetzZuschlag: Zeitoffset;
}

export type Ampelstatus = "" | "✅" | "! abrufen !";
export type Katstatus = "" | "! ! !" | "EHF!";
