/** Übersetzt den UI-Datentyp JobEintrag in den Berechnungstyp Job aus
 *  @wache/core und bündelt die darauf aufbauenden Helfer. */
import { berechneAbteilzeit, berechneBrbPrognose, berechneSeePrognose, istListenvergabeTyp } from "@wache/core";
import type {
  AbteilzeitSettings,
  BrbPrognose,
  Geschwindigkeitsklasse,
  HwBrb,
  Job,
  SeeHerkunft,
} from "@wache/core";
import type { HwBrbEingabe, JobEintrag } from "../data/types";

/** Aktuell gültiges HW-Paar Brunsbüttel für die matrixbasierte Brb-Prognose.
 *  Wird vom DataContext aus dem persistierten Settings-Wert gesetzt (Modul-
 *  Singleton, damit nicht jede der vielen abteilzeitVon-Aufrufstellen das
 *  HW-Paar durchreichen muss); undefined = Matrix aus, feste Offsets. */
let hwBrbAktuell: HwBrb | undefined;

export function setHwBrbAktuell(eingabe: HwBrbEingabe): void {
  hwBrbAktuell = eingabe.hw1 ? { hw1: eingabe.hw1, hw2: eingabe.hw2 } : undefined;
}

// --------------------------------------------------------- Zeitrechnung
// Modus + Session-Overrides der Settings-Kachel "Zeitrechnung".
// "automatisch" = Matrix-Rechnung (setzt ein HW-Paar voraus), "manuell" =
// feste Fallback-Offsets. Die Overrides ersetzen im manuellen Modus die
// FkW-/Stade-Offsets — NUR für die laufende Sitzung, nichts davon wird
// gespeichert. Wie hwBrbAktuell ein Modul-Singleton, damit die vielen
// Aufrufstellen nichts durchreichen müssen; der DataContext spiegelt
// seinen Zustand synchron hierher.

export type ZeitrechnungsModus = "automatisch" | "manuell";

export interface ZeitOverrides {
  /** FkW → Abteilung in Minuten (Session-Override) */
  fkwMin?: number;
  /** Stade → Abteilung in Minuten (Session-Override) */
  stadeMin?: number;
}

let zeitModus: ZeitrechnungsModus = "automatisch";
let zeitOverrides: ZeitOverrides = {};

export function setZeitrechnung(modus: ZeitrechnungsModus, overrides: ZeitOverrides): void {
  zeitModus = modus;
  zeitOverrides = overrides;
}

/** HW-Paar für die Matrix-Pfade — im manuellen Modus bewusst keins, dann
 *  greifen überall die festen Offsets bzw. Pauschalen. */
function hwFuerRechnung(): HwBrb | undefined {
  return zeitModus === "automatisch" ? hwBrbAktuell : undefined;
}

function zuOffset(minuten: number): { stunden: number; minuten: number } {
  return { stunden: Math.floor(minuten / 60), minuten: minuten % 60 };
}

/** Settings mit den Session-Overrides der Zeitrechnungs-Kachel. */
export function effektiveSettings(basis: AbteilzeitSettings): AbteilzeitSettings {
  if (zeitOverrides.fkwMin === undefined && zeitOverrides.stadeMin === undefined) return basis;
  return {
    ...basis,
    fkwAbteilung: zeitOverrides.fkwMin !== undefined ? zuOffset(zeitOverrides.fkwMin) : basis.fkwAbteilung,
    stadeAbteilung: zeitOverrides.stadeMin !== undefined ? zuOffset(zeitOverrides.stadeMin) : basis.stadeAbteilung,
  };
}

export function zuCoreJob(eintrag: JobEintrag): Job {
  if (eintrag.liste === "hamburg") {
    return {
      jobNr: eintrag.id,
      // Bützfleth nutzt die BÜTZ-Formel: gepl. Abgang + 29 min + Stade-Offset
      // (der Abgang läuft dafür über das FkW/Ticker-Feld des core-Jobs).
      routentyp: eintrag.buetzfleth ? "BÜTZ" : "HH",
      hhHoltenau: eintrag.hh,
      fkwTickerAbgang: eintrag.buetzfleth ? eintrag.geplAbgang : eintrag.fkw,
      stadeKuden: eintrag.stade,
      abteilungManuell: eintrag.abtZeitManuell,
      geschwindigkeitsklasse: eintrag.geschwindigkeitsklasse,
    };
  }
  if (eintrag.liste === "nok") {
    return {
      jobNr: eintrag.id,
      routentyp: "NOK",
      hhHoltenau: eintrag.holt,
      fkwTickerAbgang: eintrag.ticker,
      stadeKuden: eintrag.kuden,
      abteilungManuell: eintrag.abtZeitManuell,
    };
  }
  return {
    jobNr: eintrag.id,
    routentyp: eintrag.typ ?? "Anmeldung",
    abteilungManuell: eintrag.abtZeitManuell,
  };
}

/** NOK-Sonderregel "gepl. Bunkern": solange das Schiff bunkert, ist offen,
 *  wann es weiterfährt — es hat KEINE Abt.Zeit, bekommt keinen Lotsen
 *  zugeteilt und steht dezent am Listenende. Erst wenn der Haken wieder
 *  raus ist (und der User die Zeiten neu einträgt), läuft es normal mit.
 *  Gilt NUR für die NOK-Liste — Bütz-Bunkern in der HH-Liste bleibt wie
 *  gehabt (dort verschiebt sich nur die Vergabe, siehe listenvergabe.ts). */
export function istBunkernPausiert(eintrag: JobEintrag): boolean {
  return eintrag.liste === "nok" && Boolean(eintrag.geplBunkern);
}

export function abteilzeitVon(eintrag: JobEintrag, settings: AbteilzeitSettings): Date | undefined {
  if (istBunkernPausiert(eintrag)) return undefined;
  return berechneAbteilzeit(zuCoreJob(eintrag), effektiveSettings(settings), hwFuerRechnung());
}

/** Abteilzeit eines AG-Jobs aus seinem Trägerschiff: dieselbe Zeit plus eine
 *  Sekunde. Ein Träger muss zwingend VOR seiner AG abgeteilt werden — bei
 *  exakt gleicher Zeit wäre die Reihenfolge in der Einsatzplanung dagegen
 *  zufällig (siehe sortiereEintraege). Die Sekunde ist in der
 *  Minuten-Anzeige unsichtbar und hält die Sortierung eindeutig. */
export function agAbteilzeitVon(traeger: JobEintrag, settings: AbteilzeitSettings): Date | undefined {
  const abteilzeit = abteilzeitVon(traeger, settings);
  return abteilzeit ? new Date(abteilzeit.getTime() + 1000) : undefined;
}

/** Matrixbasierte Brb-Prognose (Ankunft Brücke + Fahrzeit) für die Anzeige;
 *  undefined, solange kein HW-Paar eingegeben ist oder der Eintrag kein
 *  HH-Job mit FkW-/Stade-Meldung ist. */
export function brbPrognoseVon(eintrag: JobEintrag): BrbPrognose | undefined {
  const hw = hwFuerRechnung();
  if (!hw) return undefined;
  return berechneBrbPrognose(zuCoreJob(eintrag), hw);
}

export interface SeeReiseInfo {
  herkunft: SeeHerkunft;
  klasse?: Geschwindigkeitsklasse;
}

/**
 * Woher/womit die Lotsen dieses Jobs nach der Abteilung zur Seestation
 * fahren — Grundlage der Brb>>SEE-Matrix. undefined = pauschale Anfahrt:
 * Tender-AG (fester 3,5-Std.-Wert bleibt), verwaiste AG und die
 * Vergabe-Typen ohne V-Nr. (fahren gar nicht zur Seestation).
 */
export function seeReiseInfoVon(eintrag: JobEintrag, alleJobs: JobEintrag[]): SeeReiseInfo | undefined {
  if (eintrag.liste === "hamburg") return { herkunft: "HH", klasse: eintrag.geschwindigkeitsklasse };
  if (eintrag.liste === "nok") return { herkunft: "NOK", klasse: eintrag.geschwindigkeitsklasse };
  // klassische AG: fährt mit dem Trägerschiff → dessen Herkunft + Speed
  if (eintrag.typ === "AG") {
    const traeger = alleJobs.find((j) => j.id === eintrag.agJobId);
    return traeger ? seeReiseInfoVon(traeger, alleJobs) : undefined;
  }
  if (eintrag.typ === "AG (Tender)" || istOhneVNrJob(eintrag)) return undefined;
  return { herkunft: "VNR", klasse: eintrag.geschwindigkeitsklasse };
}

/** Matrixbasierte ETA Seestation ab Abteilzeitpunkt; undefined ohne
 *  HW-Paar oder ohne See-Reise-Info → Aufrufer nutzt die Pauschale. */
export function etaSeestationMatrix(
  abteilZeit: Date,
  herkunft: SeeHerkunft | undefined,
  klasse: Geschwindigkeitsklasse | undefined
): Date | undefined {
  const hw = hwFuerRechnung();
  if (!hw || !herkunft) return undefined;
  return berechneSeePrognose(abteilZeit, herkunft, klasse, hw).ankunftSee;
}

/** Anzeige für die Spalte "Von / Type": Herkunftsliste bzw. Anmeldungs-Typ.
 *  Sonderradar/Nebelradar/AG (Tender) werden abgekürzt, damit die Spalte
 *  schmal bleibt. */
export function vonTypeLabel(eintrag: JobEintrag): string {
  if (eintrag.liste === "hamburg") return eintrag.buetzfleth ? "Bütz" : "HH";
  if (eintrag.liste === "nok") return "NOK";
  if (eintrag.typ === "Sonderradar") return "SoRa";
  if (eintrag.typ === "Nebelradar") return "NeRa";
  if (eintrag.typ === "AG (Tender)") return "AG-T";
  return eintrag.typ ?? "?";
}

/** Listenvergabe, die von Cuxhaven-Seite bedient wird (Brb/Cux-Schalter im
 *  Andere-Jobs-Formular): der Job bleibt in der Liste sichtbar (grün),
 *  fließt aber in KEINE Berechnung ein — als wäre er nicht da. */
export function istCuxVergabe(eintrag: JobEintrag): boolean {
  return eintrag.liste === "andere" && istListenvergabeTyp(eintrag.typ) && Boolean(eintrag.vergabeCux);
}

/** AG-Jobs im weiteren Sinn: klassische AG (an einen Trägerjob gehängt)
 *  und AG (Tender) mit eigenem Tender — beide zählen agLotsenAnzahl und
 *  erlauben den Lots.-Quick-Edit in der Einsatzplanung. */
export function istAgJob(eintrag: JobEintrag): boolean {
  return eintrag.liste === "andere" && (eintrag.typ === "AG" || eintrag.typ === "AG (Tender)");
}

/** Anzahl benötigter Lotsen (Einsatzplanung, Spalte "Lots."). Jeder Job
 *  braucht standardmäßig genau einen Lotsen — Ausnahme AG/AG (Tender),
 *  dort zählt agLotsenAnzahl (einstellbar im Job-Formular oder per
 *  Quick-Edit in der Einsatzplanung — beide schreiben dasselbe Feld). */
export function benoetigteLotsenAnzahl(eintrag: JobEintrag): number {
  if (istAgJob(eintrag)) return eintrag.agLotsenAnzahl ?? 1;
  return 1;
}

/** Anmeldungs-Typen, für die zugewiesene Lotsen keine V-Nr. bekommen — sie
 *  landen beim Abteilen auf der Vergabe-Liste und fahren NICHT zur
 *  Seestation. */
export const OHNE_V_NR_TYPEN = new Set(["Sonderradar", "Nebelradar", "2+2", "1+1", "HuLo", "WB", "WR"]);

export function istOhneVNrJob(job: JobEintrag): boolean {
  return job.liste === "andere" && job.typ !== undefined && OHNE_V_NR_TYPEN.has(job.typ);
}

/** True, wenn ein AG-Job auf einen inzwischen gelöschten Hamburg/NOK-Job
 *  verweist — seine Abteilzeit wird dann nicht mehr über die
 *  updateJob-Kaskade aktualisiert (siehe DataContext). */
export function istVerwaisterAgJob(eintrag: JobEintrag, alleJobs: JobEintrag[]): boolean {
  if (eintrag.liste !== "andere" || eintrag.typ !== "AG" || eintrag.agJobId === undefined) return false;
  return !alleJobs.some((j) => j.id === eintrag.agJobId);
}

export interface EintragMitAbteilzeit {
  eintrag: JobEintrag;
  abteilzeit: Date | undefined;
}

/** Einheitliche Warteschlange: alle Einträge nach Abteilzeit aufsteigend,
 *  Einträge ohne berechenbare Abteilzeit ans Ende.
 *
 *  Ein AG-Job muss zwingend NACH seinem Trägerschiff stehen — die
 *  Sekunden-Reserve aus agAbteilzeitVon() erreicht das normalerweise durch
 *  eine (in der Minuten-Anzeige unsichtbare) minimal spätere Abteilzeit.
 *  Diese Reserve geht aber verloren, sobald der Wert über ein nur
 *  minutengenaues Formularfeld läuft (z.B. beim erneuten Speichern der
 *  Trägerschiff-Auswahl im AG-Formular) — dann sind beide Zeiten exakt
 *  gleich, und ohne expliziten Tie-Break entschiede die zufällige
 *  Array-Reihenfolge der Jobs. Der Vergleich erzwingt die Reihenfolge
 *  deshalb zusätzlich explizit über die AG-Verknüpfung. */
export function sortiereEintraege(eintraege: JobEintrag[], settings: AbteilzeitSettings): EintragMitAbteilzeit[] {
  return eintraege
    .map((eintrag) => ({ eintrag, abteilzeit: abteilzeitVon(eintrag, settings) }))
    .sort((a, b) => {
      if (!a.abteilzeit && !b.abteilzeit) return 0;
      if (!a.abteilzeit) return 1;
      if (!b.abteilzeit) return -1;
      if (a.eintrag.agJobId === b.eintrag.id && a.abteilzeit.getTime() <= b.abteilzeit.getTime()) return 1;
      if (b.eintrag.agJobId === a.eintrag.id && b.abteilzeit.getTime() <= a.abteilzeit.getTime()) return -1;
      return a.abteilzeit.getTime() - b.abteilzeit.getTime();
    });
}
